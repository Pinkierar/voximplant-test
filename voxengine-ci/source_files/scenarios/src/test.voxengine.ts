/// region ==== PREPARATION ================================

// region includes

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

function log(...messages: any[]) {
  const log = messages
    .map((message) => {
      if (typeof message === 'object') {
        try {
          return JSON.stringify(message, null, 2);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-empty
        } catch (e) {}
      }

      return String(message);
    })
    .join(' ');

  Logger.write(`[Лог сценария] ${log}`);
}

// endregion includes

// region PromiseControl

class ControlledPromise<Result> {
  public readonly promise: Promise<Result>;
  private onResolve!: (result: Result) => void;
  private onReject!: (error: unknown) => void;

  public constructor() {
    this.promise = new Promise<Result>((resolve, reject) => {
      this.onResolve = resolve;
      this.onReject = reject;
    });
  }

  private _onBeforeFinally?: () => void;

  public set onBeforeFinally(value: () => void) {
    this._onBeforeFinally = value;
  }

  public resolve(result: Result): void {
    this._onBeforeFinally?.();
    this.onResolve(result);
  }

  public reject(error: unknown): void {
    this._onBeforeFinally?.();
    this.onReject(error);
  }
}

class PromiseControl<Result, Args extends any[] = []> {
  private controlledPromise: ControlledPromise<Result> | null = null;

  public constructor(
    private readonly description: string,
    private readonly handlersFactory: (controlledPromise: ControlledPromise<Result>) => {
      promiseCreatedHandler: (...args: Args) => void;
      promiseFinallyHandler: () => void;
    },
  ) {}

  public run(...args: Args): Promise<Result> {
    log(`Промис "${this.description}" создаётся...`, { args });

    if (this.controlledPromise) throw new ErrorInfo('PromiseControl.run', `Промис "${this.description}" уже создан`);

    this.controlledPromise = new ControlledPromise<Result>();

    const { promiseCreatedHandler, promiseFinallyHandler } = this.handlersFactory(this.controlledPromise);

    log(`Промис "${this.description}" создан`);
    promiseCreatedHandler(...args);

    this.controlledPromise.onBeforeFinally = () => {
      log(`Промис "${this.description}" завершён`);
      promiseFinallyHandler();

      this.controlledPromise = null;
    };

    return this.controlledPromise.promise;
  }

  public reject(error: unknown): void {
    if (!this.controlledPromise) return;

    log(`Промис "${this.description}" принудительно отклоняется`);

    this.controlledPromise.reject(error);
  }

  public resolve(result: Result): void {
    if (!this.controlledPromise) return;

    log(`Промис "${this.description}" принудительно завершается`);

    this.controlledPromise.resolve(result);
  }
}

// endregion PromiseControl

// region Sleeper

class Sleeper {
  private promiseControl: PromiseControl<void, [number]>;

  public constructor() {
    this.promiseControl = new PromiseControl<void, [number]>('sleeper', (controlledPromise) => {
      const eventListener = () => {
        controlledPromise.resolve();
      };

      let timeout: NodeJS.Timeout;

      return {
        promiseCreatedHandler: (delay) => {
          timeout = setTimeout(eventListener, delay);
        },
        promiseFinallyHandler: () => {
          if (timeout !== undefined) {
            clearTimeout(timeout);
          }
        },
      };
    });
  }

  /**
   * Wait the specified number of milliseconds
   */
  public sleep(delay: number): Promise<void> {
    return this.promiseControl.run(delay);
  }

  /**
   * Stop waiting
   */
  public wakeUp(): void {
    this.promiseControl.resolve();
  }

  /**
   * Reject waiting with exception
   */
  public scareUp(error: unknown): void {
    this.promiseControl.reject(error);
  }
}

// endregion Sleeper

// region EventAwaiter

interface IEventTarget<EventsMap extends Record<string, any>, EventName extends keyof EventsMap> {
  addEventListener(eventName: EventName, handler: (event: EventsMap[EventName]) => void): void;

  removeEventListener(eventName: EventName, handler: (event: EventsMap[EventName]) => void): void;
}

class EventAwaiter<EventsMap extends Record<string, any>, EventName extends keyof EventsMap> {
  private promiseControl: PromiseControl<EventsMap[EventName]>;

  public constructor(description: string, obj: IEventTarget<EventsMap, EventName>, eventName: EventName) {
    this.promiseControl = new PromiseControl<EventsMap[EventName]>(description, (controlledPromise) => {
      const eventListener = controlledPromise.resolve.bind(controlledPromise);

      return {
        promiseCreatedHandler() {
          obj.addEventListener(eventName, eventListener);
        },
        promiseFinallyHandler() {
          obj.removeEventListener(eventName, eventListener);
        },
      };
    });
  }

  public wait(): Promise<EventsMap[EventName]> {
    return this.promiseControl.run();
  }

  public reject(error: unknown): void {
    return this.promiseControl.reject(error);
  }
}

// endregion EventAwaiter

// region services

class CallListService {
  private static enabled: boolean = false;

  public static enable(): void {
    CallListService.enabled = true;

    log('CallListService активирован');
  }

  public static reportError(error: unknown): Promise<void> {
    if (!CallListService.enabled) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const { sender, message } = ErrorInfo.from(error);

      new CallList().reportError(`${sender}: ${message}`, resolve);
    });
  }
}

class VoxEngineService {
  public static getCustomData(): unknown {
    const customData = VoxEngine.customData();

    if (!customData) {
      throw new ErrorInfo('VoxEngineService.getCustomData', 'customData не указан', { customData });
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

    log('Прочитан customData:', data);

    return data;
  }
}

// endregion services

// region CallControl

class CallDisconnectedException extends Error {
  public constructor(public readonly event: _DisconnectedEvent) {
    super(event.reason);
  }
}

class CallControl {
  private readonly call: Call;
  private readonly sleeper = new Sleeper();
  private timeout?: NodeJS.Timeout;
  private endObject?: unknown;

  private playbackFinishedAwaiter: EventAwaiter<_CallEvents, CallEvents.PlaybackFinished>;

  private constructor(call: Call) {
    this.call = call;

    this.startCompletionHandling();

    this.playbackFinishedAwaiter = new EventAwaiter<_CallEvents, CallEvents.PlaybackFinished>(
      'PlaybackFinished',
      this.call,
      CallEvents.PlaybackFinished,
    );

    log('Создано управление звонком');
  }

  /**
   * Call the specified number and wait for a successful connection
   */
  public static async callPSTN(phone: string): Promise<CallControl> {
    log('Вызов по номеру телефона', { phone });
    const call = VoxEngine.callPSTN(phone, 'default');

    return await CallControl.reach(call);
  }

  /**
   * Wait for a successful connection
   */
  private static async reach(call: Call): Promise<CallControl> {
    return new Promise((resolve, reject) => {
      const errorHandler = (event: unknown) => {
        reject(new ErrorInfo('CallScript.call', 'Не удалось дозвониться', event));
      };

      call.addEventListener(CallEvents.Failed, errorHandler);
      call.addEventListener(CallEvents.Disconnected, errorHandler);

      call.addEventListener(CallEvents.Connected, () => {
        log('Соединение с вызываемым абонентом установлено');

        call.removeEventListener(CallEvents.Failed, errorHandler);
        call.removeEventListener(CallEvents.Disconnected, errorHandler);

        const callControl = new CallControl(call);

        resolve(callControl);
      });
    });
  }

  /**
   * End the call immediately after time has expired
   */
  public setCallTimeout(ms: number) {
    if (this.endObject) throw this.endObject;
    log(`Установлено ограничение по времени: ${ms}ms`);

    this.timeout = setTimeout(() => {
      log('Звонок завершается из-за ограничения по времени');

      this.call.hangup();
    }, ms);
  }

  /**
   * Tell the subscriber
   */
  public async tell(text: string): Promise<void> {
    if (this.endObject) throw this.endObject;

    log('Вызываемому абоненту говорится:', { text });
    this.call.say(text, { language: VoiceList.Google.ru_RU_Standard_D });
    await this.playbackFinishedAwaiter.wait();
  }

  /**
   * Wait the specified number of milliseconds
   */
  public async silent(delay: number): Promise<void> {
    if (this.endObject) throw this.endObject;

    log(`Ничего не происходит ${delay}ms`);

    await this.sleeper.sleep(delay);
  }

  /**
   * Wait for a response from the subscriber
   */
  public async waitAnswer(): Promise<string> {
    if (this.endObject) throw this.endObject;

    return 'test';
  }

  /**
   * End the call
   */
  public async hangup(): Promise<void> {
    if (this.endObject) throw this.endObject;

    log('Звонок завершается');

    setTimeout(() => {
      this.call.hangup();
    });

    await this.sleeper.sleep(60000);

    throw new ErrorInfo('CallControl.hangup', 'Событие Disconnected не вызвалось в течении минуты');
  }

  private startCompletionHandling() {
    const errorHandler = (error: unknown) => {
      this.endObject = error;

      log('Звонок завершён');

      clearTimeout(this.timeout);
      this.playbackFinishedAwaiter.reject(error);
      this.sleeper.scareUp(error);
    };

    this.call.addEventListener(CallEvents.Failed, (event) => {
      errorHandler(new ErrorInfo('CallScript.call', 'Ошибка звонка', event));
    });

    this.call.addEventListener(CallEvents.Disconnected, (event) => {
      errorHandler(new CallDisconnectedException(event));
    });
  }
}

// endregion CallControl

/// endregion ==== PREPARATION ================================

interface CalledUserData {
  readonly name: string;
  readonly phone: string;
}

function createCalledUserData(data: unknown): CalledUserData {
  if (!data || typeof data !== 'object') {
    throw new ErrorInfo('CalledUser.from', 'Данные вызываемого абонента не удалось прочитать', { data });
  }

  if (!('phone' in data) || !data.phone || typeof data.phone !== 'string') {
    throw new ErrorInfo('CalledUser.from', 'Номер телефона вызываемого абонента не удалось прочитать', { data });
  }
  const phone = data.phone;

  if (!('name' in data) || !data.name || typeof data.name !== 'string') {
    throw new ErrorInfo('CalledUser.from', 'Имя вызываемого абонента не удалось прочитать', { data });
  }
  const name = data.name;

  const calledUserData = { name, phone };

  log('Создан вызываемый абонент:', calledUserData);

  return calledUserData;
}

interface CallResult {
  client_answer: string; // Последний ответ
  rating: number | null;
  status: boolean;
}

async function scriptEnd(result: CallResult) {
  log('Результат звонка:', result);
  VoxEngine.terminate();
}

async function main(): Promise<void> {
  const data = VoxEngineService.getCustomData();
  const { name, phone } = createCalledUserData(data);

  const callControl = await CallControl.callPSTN(phone);
  callControl.setCallTimeout(8000);

  let result: string = '';

  try {
    const answer = await callControl.waitAnswer();
    result = 'Дела идут хорошо';
    await callControl.tell(answer || 'пок');

    await callControl.hangup();
  } catch (e) {
    if (e instanceof CallDisconnectedException) {
      if (!result) throw new ErrorInfo('main', `Результат не был получен, однако звонок завершён`, e.event, e.stack);

      return await scriptEnd({ client_answer: result, status: true, rating: null });
    }

    throw e;
  }
}

async function errorHandler(e: unknown): Promise<void> {
  const error = ErrorInfo.from(e);

  log('Error:', error);

  await CallListService.reportError(error);

  VoxEngine.terminate();
}

async function startedHandler(): Promise<void> {
  try {
    await main();
  } catch (e) {
    await errorHandler(e);
  }
}

VoxEngine.addEventListener(AppEvents.Started, startedHandler);
