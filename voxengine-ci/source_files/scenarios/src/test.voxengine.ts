class ErrorInfo extends Error {
  public sender: string;
  public info: unknown;

  public constructor(sender?: string | null, message?: string | null, info?: unknown, stack?: string | null) {
    super();

    this.message = message ?? 'unknown error';
    this.sender = sender ?? 'unknown sender';
    this.info = info ?? null;
    this.stack = stack ?? this.stack;
  }

  public static from(error: unknown): ErrorInfo {
    if (error instanceof ErrorInfo) return error;

    if (error && typeof error === 'object') {
      const obj: Partial<{
        [Key in Extract<keyof ErrorInfo, 'message' | 'sender' | 'info' | 'stack'>]: ErrorInfo[Key];
      }> = {};

      if ('sender' in error && typeof error.sender === 'string') {
        obj.sender = error.sender;
      }

      if ('info' in error) {
        obj.info = error.info;
      }

      if ('stack' in error && typeof error.stack === 'string') {
        obj.stack = error.stack;
      }

      return new ErrorInfo(obj.sender, obj.message, obj.info, obj.stack);
    }

    if (['string', 'number', 'boolean'].includes(typeof error)) {
      return ErrorInfo.from({ message: String(error) });
    }

    return ErrorInfo.from({ info: error });
  }

  public toJSON() {
    return {
      sender: this.sender,
      message: this.message,
      info: this.info,
      stack: this.stack,
    };
  }

  public override toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}

interface EventTargetObject<EventsMap extends Record<string, any>, EventName extends keyof EventsMap> {
  addEventListener(eventName: EventName, handler: (event: EventsMap[EventName]) => void): void;

  removeEventListener(eventName: EventName, handler: (event: EventsMap[EventName]) => void): void;
}

interface EventSubscription<EventsMap extends Record<string, any>, EventName extends keyof EventsMap> {
  resolve(event: EventsMap[EventName]): void;

  reject(error: unknown): void;
}

class EventWaiter<EventsMap extends Record<string, any>, EventName extends keyof EventsMap> {
  public static readonly CancelSignal = Symbol('CancelSignal');

  private readonly obj: EventTargetObject<EventsMap, EventName>;
  private readonly eventName: EventName;

  private subscription: EventSubscription<EventsMap, EventName> | null = null;

  public constructor(obj: EventTargetObject<EventsMap, EventName>, eventName: EventName) {
    this.obj = obj;
    this.eventName = eventName;
  }

  public wait(
    resolve: (event: EventsMap[EventName]) => void,
    reject: (error: unknown) => void,
    canceling?: () => void,
  ): void;
  public wait(): Promise<EventsMap[EventName]>;
  public wait(
    resolve?: (event: EventsMap[EventName]) => void,
    reject?: (error: unknown) => void,
    canceling?: () => void,
  ): Promise<EventsMap[EventName]> | void {
    const promise = new Promise(this.subscribe.bind(this));

    if (resolve && reject) {
      promise.then(resolve).catch((error) => {
        if (error === EventWaiter.CancelSignal) {
          canceling?.();
        } else {
          reject(error);
        }
      });
    } else if (!resolve && !reject && !canceling) {
      return promise;
    } else {
      throw new ErrorInfo('EventWaiter.wait', 'Invalid parameters');
    }
  }

  public cancel(): void {
    if (!this.subscription) return;

    this.subscription.reject(EventWaiter.CancelSignal);
  }

  private success(resolve: (event: EventsMap[EventName]) => void, event: EventsMap[EventName]): void {
    this.unsubscribe();
    resolve(event);
  }

  private fail(reject: (error: unknown) => void, error: unknown): void {
    this.unsubscribe();
    reject(error);
  }

  private subscribe(resolve: (event: EventsMap[EventName]) => void, reject: (error: unknown) => void): void {
    if (this.subscription) {
      this.cancel();
    }

    this.subscription = {
      resolve: this.success.bind(this, resolve),
      reject: this.fail.bind(this, reject),
    };

    this.obj.addEventListener(this.eventName, this.subscription.resolve);
  }

  private unsubscribe(): void {
    if (!this.subscription) return;

    this.obj.removeEventListener(this.eventName, this.subscription.resolve);

    this.subscription = null;
  }
}

class CallListService {
  private static enabled: boolean = false;

  public static enable(): void {
    CallListService.enabled = true;

    Logger.write('CallListService активирован');
  }

  public static reportError(error: unknown): Promise<void> {
    if (!CallListService.enabled) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const { sender, message } = ErrorInfo.from(error);

      new CallList().reportError(`${sender}: ${message}`, resolve);
    });
  }
}

class CalledUser {
  public constructor(
    public readonly name: string,
    public readonly phone: string,
  ) {
    Logger.write(`Создан вызываемый абонент: ${JSON.stringify({ name, phone }, null, 2)}`);
  }

  public static from(data: unknown): CalledUser {
    if (!data || typeof data !== 'object') {
      throw new ErrorInfo('CalledUser.from', 'Данные вызываемого абонента не удалось прочитать', { data });
    }

    if (!('phone' in data) || typeof data.phone !== 'string' || data.phone === '') {
      throw new ErrorInfo('CalledUser.from', 'Номер телефона вызываемого абонента не удалось прочитать', { data });
    }

    if (!('name' in data) || typeof data.name !== 'string' || data.name === '') {
      throw new ErrorInfo('CalledUser.from', 'Имя вызываемого абонента не удалось прочитать', { data });
    }

    return new CalledUser(data.name, data.phone);
  }
}

class CallController {
  private readonly call: Call;

  private failedEvent: EventWaiter<_CallEvents, CallEvents.Failed>;
  private disconnectedEvent: EventWaiter<_CallEvents, CallEvents.Disconnected>;
  private connectedEvent: EventWaiter<_CallEvents, CallEvents.Connected>;
  private playbackFinishedEvent: EventWaiter<_CallEvents, CallEvents.PlaybackFinished>;

  public constructor(call: Call) {
    this.call = call;

    this.failedEvent = new EventWaiter<_CallEvents, CallEvents.Failed>(this.call, CallEvents.Failed);
    this.disconnectedEvent = new EventWaiter<_CallEvents, CallEvents.Disconnected>(this.call, CallEvents.Disconnected);
    this.connectedEvent = new EventWaiter<_CallEvents, CallEvents.Connected>(this.call, CallEvents.Connected);
    this.playbackFinishedEvent = new EventWaiter<_CallEvents, CallEvents.PlaybackFinished>(
      this.call,
      CallEvents.PlaybackFinished,
    );
  }

  /**
   * Call the specified number and wait for a successful connection
   */
  public static async callPSTN(phone: string, callerId: string = 'default'): Promise<CallController> {
    const call = VoxEngine.callPSTN(phone, callerId);
    const callController = new CallController(call);

    return new Promise((resolve, reject) => {
      call.addEventListener(CallEvents.Failed, (event) => {
        reject(new ErrorInfo('CallScript.call', 'Не удалось дозвониться (failed)', event));
      });

      call.addEventListener(CallEvents.Disconnected, (event) => {
        // reject не отклонит промис, если сработало событие CallEvents.Connected, где промис был решён
        reject(new ErrorInfo('CallScript.call', 'Не удалось дозвониться (disconnected)', event));
      });

      call.addEventListener(CallEvents.Connected, () => {
        resolve(callController);
      });
    });
  }

  /**
   * Tell the subscriber
   */
  public say(text: string): void {
    this.call.say(text, { language: VoiceList.Amazon.ru_RU_Tatyana });
  }

  /**
   * Wait for a response from the subscriber
   */
  public async waitAnswer(): Promise<string> {
    return 'test';
  }

  /**
   * End call
   */
  public end() {
    this.call.hangup();
  }
}

type CallResult = {
  client_answer: string; // Последний ответ
  rating: number | null;
  status: boolean;
};

class VoxEngineService {
  public static getCustomData(): unknown {
    const customData = VoxEngine.customData();

    if (!customData) {
      throw new ErrorInfo('VoxEngineService.getCustomData', 'customData не указан');
    }

    let data;
    try {
      data = JSON.parse(customData);
    } catch (e) {
      throw new ErrorInfo(
        'VoxEngineService.getCustomData',
        'Не удалось прочитать customData',
        { customData },
        ErrorInfo.from(e).stack,
      );
    }

    if ('callback_url' in data) {
      CallListService.enable();
    }

    Logger.write(`Прочитан customData: ${JSON.stringify(data, null, 2)}`);

    return data;
  }
}

async function main(): Promise<void> {
  const data = VoxEngineService.getCustomData();
  const calledUser = CalledUser.from(data);

  const callController = await CallController.callPSTN(calledUser.phone);
  callController.say(`Привет, ${calledUser.name}`);
  callController.end();
}

async function handleError(e: unknown): Promise<void> {
  const error = ErrorInfo.from(e);

  Logger.write(`Error: ${error.toString()}`);

  await CallListService.reportError(error);

  VoxEngine.terminate();
}

async function handleStarted(): Promise<void> {
  try {
    await main();
  } catch (e) {
    await handleError(e);
  }
}

VoxEngine.addEventListener(AppEvents.Started, handleStarted);
