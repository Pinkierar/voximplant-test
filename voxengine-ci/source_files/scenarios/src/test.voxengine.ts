// TypeScript file test.voxengine.ts here:
// https://github.com/Pinkierar/voximplant-test/blob/master/voxengine-ci/source_files/scenarios/src/test.voxengine.ts

/// region TS FIXES

/**
 * Recursively unwraps the "awaited type" of a type. Non-promise "thenables" should resolve to `never`. This emulates the behavior of `await`.
 * @fix Missing, but used inside the lib.d.ts
 */
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Awaited<T> = T extends null | undefined
  ? T
  : T extends object & { then(onfulfilled: infer F, ...args: infer _): any }
    ? F extends (value: infer V, ...args: infer _) => any
      ? Awaited<V>
      : never
    : T;

/**
 * @fix The original _ASREvents interface contains keys without the "ASR." prefix, but the event names in the ASREvents enum contain them.
 */
interface _ASREvents {
  'ASR.Error': _ASRErrorEvent;
  'ASR.Started': _ASREvent;
  'ASR.CaptureStarted': _ASREvent;
  'ASR.SpeechCaptured': _ASREvent;
  'ASR.Result': _ASRResultEvent;
  'ASR.InterimResult': _ASRInterimResultEvent;
  'ASR.Stopped': _ASRStoppedEvent;
}

/// endregion TS FIXES

require(Modules.ASR);

/// region PREPARATION

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

// /**
//  * Wait for first resolve or last reject
//  */
// function waitResolve<Result>(promises: Promise<Result>[]): Promise<Result> {
//   return new Promise((resolve, reject) => {
//     let rejectedCount = 0;
//
//     for (const promise of promises) {
//       promise.catch((e) => {
//         rejectedCount++;
//
//         if (rejectedCount === promises.length) {
//           reject(e);
//         }
//       });
//
//       promise.then(resolve);
//     }
//   });
// }

function flatten<T>(array: T[][]): T[] {
  const result: T[] = [];

  for (const item of array) {
    for (const nestedItem of item) {
      result.push(nestedItem);
    }
  }

  return result;
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
    log(`Промис "${this.description}" создаётся...`);

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

// endregion PromiseControl

// region services

interface HttpRequestResult {
  code: number;
  error?: string;
}

class CallListService {
  private static enabled: boolean = false;

  public static init(): void {
    try {
      const data = VoxEngineService.getCustomDataAsObject();
      if (!('url_callback' in data)) return;

      CallListService.enabled = true;
      log('CallListService активирован');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-empty
    } catch (e) {}
  }

  public static async reportError(e: unknown): Promise<void> {
    if (!CallListService.enabled) return;

    const { message } = ErrorInfo.from(e);

    log('Отправка ошибки в CallList...');

    // @ts-ignore CallList.reportErrorAsync(error: string | object): Promise<HttpRequestResult>
    const { code, error }: HttpRequestResult = await CallList.reportErrorAsync(message);

    if (error) throw new ErrorInfo('CallListService.reportError', 'Ошибка запроса', { code, error });
  }

  public static async reportResult(result: string | object): Promise<void> {
    if (!CallListService.enabled) return;

    log('Отправка результата в CallList...');

    // @ts-ignore CallList.reportResultAsync(result: string | object): Promise<HttpRequestResult>
    const { code, error }: HttpRequestResult = await CallList.reportResultAsync(result);

    if (error) throw new ErrorInfo('CallListService.reportResult', 'Ошибка запроса', { code, error });
  }
}

class VoxEngineService {
  private static customDataAsObject?: object;

  public static getCustomDataAsObject(): object {
    if (!VoxEngineService.customDataAsObject) {
      VoxEngineService.customDataAsObject = VoxEngineService.readCustomDataAsObject();
    }

    return VoxEngineService.customDataAsObject;
  }

  private static readCustomDataAsObject(): object {
    const customData = VoxEngine.customData();

    if (!customData) {
      throw new ErrorInfo('VoxEngineService.readCustomDataAsObject', 'customData не указан', { customData });
    }

    let data;
    try {
      data = JSON.parse(customData);
    } catch (e) {
      throw new ErrorInfo(
        'VoxEngineService.readCustomDataAsObject',
        'Не удалось прочитать customData, как объект',
        { customData },
        ErrorInfo.from(e).stack,
      );
    }

    log('Прочитан customData:', data);

    return data;
  }
}

// endregion services

// region Scenario

class ScenarioException<StopObject> extends Error {
  public constructor(public readonly stopObject: StopObject) {
    super('scenario stopped');
  }
}

class ScenarioTimeoutException extends ScenarioException<string> {
  public constructor() {
    super('timeout');
  }
}

class ScenarioInterruptionException extends ScenarioException<string> {
  public constructor() {
    super('interruption');
  }
}

class RelatedScenarioHasResultException extends ScenarioException<string> {
  public constructor() {
    super('ended');
  }
}

async function runScenario<Result>(
  name: string,
  scenario: (setResult: (value: Result) => void) => Promise<void>,
): Promise<Result> {
  let result: { value: Result } | undefined;

  const setResult = (newResult: Result) => {
    result = { value: newResult };
  };

  try {
    log(`Сценарий "${name}" запущен`);
    await scenario(setResult);
  } catch (e) {
    if (e instanceof ScenarioException) {
      if (!result) {
        throw new ErrorInfo(
          'runScenario',
          `Результат не был получен, однако сценарий "${name}" остановлен`,
          e.stopObject,
          e.stack,
        );
      }

      return result.value;
    }

    throw e;
  } finally {
    log(`Сценарий "${name}" завёршён`);
  }

  if (!result) {
    throw new ErrorInfo('runScenario', `Результат не был получен, однако сценарий "${name}" завершился`);
  }

  return result.value;
}

type InterruptibleScenarioOptions<Args extends any[]> = {
  onBeforeStart?: (...args: Args) => void;
  onBeforeStop?: (stopObject: unknown) => void;
  children?: InterruptibleScenario<any[], any>[];
};

abstract class InterruptibleScenario<Args extends any[], Result> {
  public readonly name: string;
  private conflicting: InterruptibleScenario<any[], any>[] = [];
  private children: InterruptibleScenario<any[], any>[] = [];
  private readonly onBeforeStart?: (...args: Args) => void;
  private readonly onBeforeStop?: (stopObject: unknown) => void;

  private running: boolean = false;

  protected constructor(name: string, options: InterruptibleScenarioOptions<Args> = {}) {
    const { onBeforeStart, onBeforeStop, children = [] } = options;

    this.name = name;
    this.children = children;
    this.onBeforeStart = onBeforeStart;
    this.onBeforeStop = onBeforeStop;
  }

  public start(...args: Args): Promise<Result> {
    this.onBeforeStart?.(...args);

    const runningConflicting = this.conflicting.find((scenario) => {
      if (!scenario.running) return false;
      if (scenario.children.includes(this)) return false;

      return true;
    });

    if (runningConflicting) {
      throw new ErrorInfo(
        'InterruptibleScenario.start',
        `Не удаётся запустить сценарий "${this.name}", так как работает конфликтующий сценарий "${runningConflicting.name}"`,
      );
    }

    return runScenario<Result>(this.name, async (setResult) => {
      this.running = true;

      await this.onStart(setResult, ...args).finally(() => {
        this.running = false;
      });
    });
  }

  public stop(stopObject: unknown = new ScenarioInterruptionException()) {
    if (!this.running) return;

    log(`Сценарий "${this.name}" прерывается...`);

    this.onBeforeStop?.(stopObject);

    this.onStop(stopObject);

    // if (this.running) throw new ErrorInfo('InterruptibleScenario.stop', `Сценарий "${this.name}" не прервался`);
  }

  protected addConflicting(conflicting: InterruptibleScenario<any[], any>): void {
    if (!this.conflicting.includes(conflicting)) {
      this.conflicting.push(conflicting);
    }

    if (!conflicting.conflicting.includes(this)) {
      conflicting.addConflicting(this);
    }
  }

  protected abstract onStart(setResult: (value: Result) => void, ...args: Args): Promise<void>;

  protected abstract onStop(stopObject: unknown): void;
}

// endregion Scenario

class SpeechManager extends InterruptibleScenario<[text: string], void> {
  private readonly call: Call;
  private readonly playbackFinishedAwaiter: EventAwaiter<_CallEvents, CallEvents.PlaybackFinished>;

  public constructor(call: Call, onBeforeStart: () => void) {
    super('Speaking', { onBeforeStart });

    this.call = call;

    this.playbackFinishedAwaiter = new EventAwaiter<_CallEvents, CallEvents.PlaybackFinished>(
      'PlaybackFinished',
      this.call,
      CallEvents.PlaybackFinished,
    );
  }

  protected async onStart(setResult: () => void, text: string): Promise<void> {
    setResult();

    log(`Вызываемому абоненту говорится: "${text}"`);
    this.call.say(text, { language: VoiceList.Google.ru_RU_Standard_D });

    await this.playbackFinishedAwaiter.wait();
  }

  protected onStop(stopObject: unknown): void {
    this.playbackFinishedAwaiter.reject(stopObject);

    this.call.stopPlayback();
  }
}

// region ToneReadingManager

interface ToneReaderOptions {
  timeout?: number;
  length?: number;
}

const enum ToneReaderStatus {
  Empty,
  Result,
}

type ToneReaderResult =
  | {
      tone: string;
      status: ToneReaderStatus.Result;
    }
  | {
      tone?: never;
      status: ToneReaderStatus.Empty;
    };

class ToneReadingManager extends InterruptibleScenario<[options: ToneReaderOptions], ToneReaderResult> {
  private readonly call: Call;
  private toneReaderTimeout?: NodeJS.Timeout;
  private readonly toneReceivedAwaiter: EventAwaiter<_CallEvents, CallEvents.ToneReceived>;

  public constructor(call: Call, onBeforeStart: () => void) {
    super('ToneReading', { onBeforeStart });

    this.call = call;

    this.toneReceivedAwaiter = new EventAwaiter<_CallEvents, CallEvents.ToneReceived>(
      'ToneReceived',
      this.call,
      CallEvents.ToneReceived,
    );
  }

  protected async onStart(setResult: (value: ToneReaderResult) => void, options: ToneReaderOptions): Promise<void> {
    this.call.handleTones(true);

    setResult({ status: ToneReaderStatus.Empty });

    log('Ожидание ввода с цифровой клавиатуры');

    if (options.timeout != null) {
      log(`Установлено ограничение по времени для ввода с клавиатуры: ${options.timeout}ms`);

      this.toneReaderTimeout = setTimeout(() => {
        log('Ожидание ввода с клавиатуры отменяется из-за ограничения по времени...');

        this.toneReceivedAwaiter.reject(new ScenarioTimeoutException());
      }, options.timeout);
    }

    const { tone } = await this.toneReceivedAwaiter.wait();
    clearTimeout(this.toneReaderTimeout);

    log(`Получен текст с цифровой клавиатуры: "${tone}"`);

    let limited = tone;
    if (options.length) {
      limited = tone.slice(0, options.length);
      log(`Длина текста с цифровой клавиатуры ограничена до ${options.length}: "${limited}"`);
    }

    setResult({ status: ToneReaderStatus.Result, tone: limited });
  }

  protected onStop(stopObject: unknown): void {
    if (this.toneReaderTimeout) clearTimeout(this.toneReaderTimeout);
    log('toneReceivedAwaiter.reject');
    this.toneReceivedAwaiter.reject(stopObject);
    this.call.handleTones(false);
  }
}

// endregion ToneReadingManager

// region AsrManager

class AsrStoppedException extends ScenarioException<_ASRStoppedEvent> {}

const enum AsrStatus {
  Silence,
  NotRecognized,
  Result,
}

interface AsrOptions {
  timeout?: number;
  phraseHints?: string[];
}

type AsrResult =
  | {
      text: string;
      status: AsrStatus.Result;
    }
  | {
      text?: never;
      status: AsrStatus.Silence | AsrStatus.NotRecognized;
    };

class AsrControl {
  public static readonly MinimumConfidence = 15;

  private endObject?: unknown;
  private mediaFromCallEnabled = false;

  private timeout?: NodeJS.Timeout;
  private resultAwaiter: EventAwaiter<_ASREvents, ASREvents.Result>;

  private constructor(
    private readonly call: Call,
    private readonly asr: ASR,
  ) {
    this.resultAwaiter = new EventAwaiter<_ASREvents, ASREvents.Result>('ASR Result', this.asr, ASREvents.Result);

    this.startCompletionHandling();

    this.startMediaFromCall();
    this.asr.addEventListener(ASREvents.SpeechCaptured, () => {
      this.stopMediaFromCall();
    });

    log('Создано управление распознаванием речи');
  }

  public static createAsr(call: Call, phraseHints?: string[]): AsrControl {
    log('Создаётся и запускается распознавание речи...');
    const asr = VoxEngine.createASR({
      profile: ASRProfileList.Google.ru_RU,
      singleUtterance: true,
      phraseHints: phraseHints,
    } as ASRParameters);

    return AsrControl.from(call, asr);
  }

  public static from(call: Call, asr: ASR): AsrControl {
    return new AsrControl(call, asr);
  }

  /**
   * Reject all current actions.
   */
  public rejectAll(endObject: unknown): void {
    if (this.endObject) return;

    this.stopMediaFromCall();

    clearTimeout(this.timeout);
    this.resultAwaiter.reject(endObject);

    this.endObject = endObject;

    log('Распознавание речи завершено');
  }

  public stop(): void {
    if (this.endObject) throw this.endObject;

    log('Распознавание речи завершается...');
    this.asr.stop();
  }

  public setSpeechRecognitionTimeout(ms: number): void {
    if (this.endObject) throw this.endObject;

    log(`Для распознавания речи установлено ограничение по времени: ${ms}ms`);

    this.timeout = setTimeout(() => {
      log('Распознавание речи завершается из-за ограничения по времени...');
      this.asr.stop();
    }, ms);
  }

  public async recognizeSpeech(): Promise<_ASRResultEvent> {
    if (this.endObject) throw this.endObject;

    return await this.resultAwaiter.wait();
  }

  private startMediaFromCall(): void {
    if (this.mediaFromCallEnabled) return;

    log('Звук звонка направляется в распознавание речи...');
    this.call.sendMediaTo(this.asr as VoxMediaUnit);

    this.mediaFromCallEnabled = true;
  }

  private stopMediaFromCall() {
    if (!this.mediaFromCallEnabled) return;

    log('Звук звонка отключается от распознавания речи...');
    this.call.stopMediaTo(this.asr as VoxMediaUnit);

    this.mediaFromCallEnabled = false;
  }

  private startCompletionHandling(): void {
    this.asr.addEventListener<'Stopped'>(ASREvents.Stopped, (event) => {
      this.rejectAll(new AsrStoppedException(event));
    });

    this.asr.addEventListener<'ASRError'>(ASREvents.ASRError, ({ error }) => {
      this.rejectAll(new ErrorInfo('AsrControl.startCompletionHandling', 'Ошибка распознавания речи', { error }));
    });
  }
}

class AsrManager extends InterruptibleScenario<[options: AsrOptions], AsrResult> {
  private readonly call: Call;
  private asrControl?: AsrControl;

  public constructor(call: Call, onBeforeStart: () => void) {
    super('SpeechRecognition', { onBeforeStart });

    this.call = call;
  }

  protected async onStart(setResult: (value: AsrResult) => void, options: AsrOptions): Promise<void> {
    const asrControl = AsrControl.createAsr(this.call, options.phraseHints);

    if (options.timeout != null) {
      asrControl.setSpeechRecognitionTimeout(options.timeout);
    }

    this.asrControl = asrControl;

    setResult({ status: AsrStatus.Silence });

    const { confidence, text } = await asrControl.recognizeSpeech();

    if (confidence > AsrControl.MinimumConfidence) {
      log(`Результат распознавания: "${text}". Точность: ${confidence}`);
      setResult({ status: AsrStatus.Result, text });
    } else {
      log(`Распознавание речи дало слишком неоднозначный результат: "${text}". Точность: ${confidence}`);
      setResult({ status: AsrStatus.NotRecognized });
    }

    asrControl.stop();
  }

  protected onStop(stopObject: unknown): void {
    if (this.asrControl) this.asrControl.rejectAll(stopObject);
  }
}

// endregion AsrManager

// region DigitReadingManager

class Digit {
  private static readonly list = [
    new Digit(0, ['0', 'ноль']),
    new Digit(1, ['1', 'один']),
    new Digit(2, ['2', 'два']),
    new Digit(3, ['3', 'три']),
    new Digit(4, ['4', 'четыре']),
    new Digit(5, ['5', 'пять']),
    new Digit(6, ['6', 'шесть']),
    new Digit(7, ['7', 'семь']),
    new Digit(8, ['8', 'восемь']),
    new Digit(9, ['9', 'девять']),
  ];

  private constructor(
    public readonly value: number,
    public readonly variants: string[],
  ) {}

  public static getByVariant(variant: string): Digit | undefined {
    return Digit.list.find(({ variants }) => variants.includes(variant));
  }

  public static getAllVariants(): string[] {
    return flatten(Digit.list.map(({ variants }) => variants));
  }
}

interface DigitReaderOptions {
  timeout?: number;
}

const enum DigitReaderStatus {
  Empty,
  Result,
  BadValue,
}

type DigitReaderResult =
  | {
      value: Digit['value'];
      text: string;
      status: DigitReaderStatus.Result;
    }
  | {
      value?: never;
      text?: never;
      status: DigitReaderStatus.Empty;
    }
  | {
      value?: never;
      text: string;
      status: DigitReaderStatus.BadValue;
    };

class DigitReadingManager extends InterruptibleScenario<[options?: DigitReaderOptions], DigitReaderResult> {
  public readonly readTone: ToneReadingManager;
  public readonly recognizeSpeech: AsrManager;
  private timeout?: NodeJS.Timeout;

  public constructor(readTone: ToneReadingManager, recognizeSpeech: AsrManager, onBeforeStart: () => void) {
    super('DigitReading', { onBeforeStart, children: [readTone, recognizeSpeech] });

    this.readTone = readTone;
    this.recognizeSpeech = recognizeSpeech;

    this.addConflicting(readTone);
    this.addConflicting(recognizeSpeech);
  }

  protected async onStart(
    setResult: (result: DigitReaderResult) => void,
    options: DigitReaderOptions = {},
  ): Promise<void> {
    setResult({ status: DigitReaderStatus.Empty });

    if (options.timeout) {
      log(`Для сценария "${this.name}" установлено ограничение по времени: ${options.timeout}ms`);

      this.timeout = setTimeout(() => {
        log(`Сценарий "${this.name}" завершается из-за ограничения по времени...`);
        this.stop();
      }, options.timeout);
    }

    const setResultFromText = (text: string): void => {
      const digit = Digit.getByVariant(text);

      if (digit) {
        setResult({ status: DigitReaderStatus.Result, text, value: digit.value });
      } else {
        setResult({ status: DigitReaderStatus.BadValue, text });
      }

      this.stop(new RelatedScenarioHasResultException());
    };

    await Promise.all([
      this.readTone.start({ timeout: options.timeout, length: 1 }).then((result) => {
        if (result.status === ToneReaderStatus.Result) {
          setResultFromText(result.tone);
        }
      }),
      this.recognizeSpeech.start({ timeout: options.timeout, phraseHints: Digit.getAllVariants() }).then((result) => {
        if (result.status === AsrStatus.Result) {
          setResultFromText(result.text);
        }
      }),
    ]);
  }

  protected onStop(stopObject: unknown): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.readTone.stop(stopObject);
    this.recognizeSpeech.stop(stopObject);
  }
}

// endregion DigitReadingManager

class SilenceManager extends InterruptibleScenario<[ms: number], void> {
  private readonly silentSleeper = new Sleeper();

  public constructor(onBeforeStart: () => void) {
    super('Silence', { onBeforeStart });
  }

  protected async onStart(setResult: () => void, ms: number): Promise<void> {
    setResult();

    log(`Ничего не происходит ${ms}ms`);

    await this.silentSleeper.sleep(ms);
  }

  protected onStop(stopObject: unknown): void {
    this.silentSleeper.scareUp(stopObject);
  }
}

// region CallControl

class CallDisconnectedException extends ScenarioException<_DisconnectedEvent> {}

class CallControl {
  private readonly call: Call;
  private endObject?: unknown;

  private callTimeout?: NodeJS.Timeout;

  public readonly say: SpeechManager;
  public readonly silent: SilenceManager;
  public readonly readTone: ToneReadingManager;
  public readonly recognizeSpeech: AsrManager;
  public readonly digitReading: DigitReadingManager;

  private constructor(call: Call) {
    this.call = call;

    const boundThrowIfEnded = this.throwIfEnded.bind(this);

    this.say = new SpeechManager(this.call, boundThrowIfEnded);
    this.silent = new SilenceManager(boundThrowIfEnded);
    this.readTone = new ToneReadingManager(this.call, boundThrowIfEnded);
    this.recognizeSpeech = new AsrManager(this.call, boundThrowIfEnded);
    this.digitReading = new DigitReadingManager(this.readTone, this.recognizeSpeech, boundThrowIfEnded);

    this.startCompletionHandling();

    log('Создано управление звонком');
  }

  private throwIfEnded(): void {
    if (this.endObject) throw this.endObject;
  }

  /**
   * Call the specified number and wait for a successful connection
   */
  public static async callPSTN(phone: string): Promise<CallControl> {
    log(`Вызов по номеру телефона: "${phone}"`);
    const call = VoxEngine.callPSTN(phone, 'default');

    return await CallControl.from(call);
  }

  /**
   * Wait for a successful connection and create instance
   */
  public static from(call: Call): Promise<CallControl> {
    if (call.state() === 'CONNECTED') {
      throw new ErrorInfo('CallControl.from', 'Соединение с вызываемым абонентом уже установлено');
    }

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

        resolve(new CallControl(call));
      });
    });
  }

  /**
   * End the call immediately after time has expired
   */
  public setCallTimeout(ms: number): void {
    this.throwIfEnded();

    log(`Установлено ограничение по времени: ${ms}ms`);

    this.callTimeout = setTimeout(() => {
      log('Звонок завершается из-за ограничения по времени');

      this.call.hangup();
    }, ms);
  }

  /**
   * Reject all current actions.
   */
  public rejectAll(endObject: unknown): void {
    if (this.endObject) return;

    if (this.callTimeout) clearTimeout(this.callTimeout);

    this.say.stop(endObject);
    this.silent.stop(endObject);
    this.recognizeSpeech.stop(endObject);
    this.readTone.stop(endObject);
    this.digitReading.stop(endObject);

    this.endObject = endObject;

    log('Звонок завершён');
  }

  /**
   * End the call
   */
  public hangup(): void {
    if (this.endObject) throw this.endObject;

    log('Звонок завершается');

    this.call.hangup();
  }

  private startCompletionHandling() {
    this.call.addEventListener(CallEvents.Failed, (event) => {
      this.rejectAll(new ErrorInfo('CallScript.call', 'Ошибка звонка', event));
    });

    this.call.addEventListener(CallEvents.Disconnected, (event) => {
      this.rejectAll(new CallDisconnectedException(event));
    });
  }
}

// endregion CallControl

/// endregion PREPARATION

/// region MAIN

// region main

interface CallResult {
  name: string;
  client_answer: string | null;
  rating: number | null;
  status: boolean;
}

async function main(): Promise<void> {
  CallListService.init();
  const data = VoxEngineService.getCustomDataAsObject();
  const { name, phone } = createCalledUserData(data);
  // const { name, phone } = createCalledUserData({ name: 'Гриша Романов', phone: '+79585477508' });

  const callControl = await CallControl.callPSTN(phone);
  callControl.setCallTimeout(60000);

  const result = await runScenario<CallResult>('Call', async (setResult) => {
    const state: {
      lastRecognizedText: CallResult['client_answer'];
      lastRating: CallResult['rating'];
    } = {
      lastRecognizedText: null,
      lastRating: null,
    };
    const setResultFromStorage = () => {
      setResult({
        name,
        status: state.lastRating != null,
        rating: state.lastRating,
        client_answer: state.lastRecognizedText,
      });
    };

    await callControl.silent.start(500);

    for (let i = 0; i <= 1; i++) {
      // await callControl.say.start('Добрый день! Оцените, пожалуйста, работу сервиса по пятибалльной шкале.');
      await callControl.say.start('ну');

      const userRating = await callControl.digitReading.start({ timeout: 6000 });

      if (userRating.status === DigitReaderStatus.Result) {
        state.lastRecognizedText = userRating.text;

        if (1 <= userRating.value && userRating.value <= 5) {
          state.lastRating = userRating.value;
          setResultFromStorage();

          // await callControl.say.start('Спасибо за оценку! Всего доброго!');
          await callControl.say.start('да');

          return callControl.hangup();
        }
      } else if (userRating.status === DigitReaderStatus.BadValue) {
        state.lastRecognizedText = userRating.text;
        setResultFromStorage();
      }
    }

    await callControl.say.start('нет');
    // await callControl.say.start('Не смог распознать ваш ответ! Всего доброго!');

    return callControl.hangup();
  });

  return await saveResult(result);
}

async function saveResult(result: CallResult): Promise<void> {
  log('Результат звонка:', result);

  try {
    await CallListService.reportResult(result);
  } catch (e) {
    const error = ErrorInfo.from(e);
    log('Ошибка при отправки результата в CallList', error);
  }

  VoxEngine.terminate();
}

async function errorHandler(e: unknown): Promise<void> {
  const error = ErrorInfo.from(e);

  log('errorHandler:', error);

  try {
    await CallListService.reportError(error);
  } catch (e) {
    const error = ErrorInfo.from(e);
    log('Ошибка при отправки ошибки в CallList', error);
  }

  throw new Error(`${error.sender}: ${error.message}`);
}

// endregion main

// region CalledUserData

interface CalledUserData {
  readonly name: string;
  readonly phone: string;
}

function createCalledUserData(data: object): CalledUserData {
  if (!('phone' in data) || !data.phone || typeof data.phone !== 'string') {
    throw new ErrorInfo('CalledUser.from', 'Номер телефона вызываемого абонента не удалось прочитать', { data });
  }
  const phone = data.phone;

  if (!('name' in data) || !data.name || typeof data.name !== 'string') {
    throw new ErrorInfo('CalledUser.from', 'Имя вызываемого абонента не удалось прочитать', { data });
  }
  const name = data.name;

  const calledUserData: CalledUserData = { name, phone };

  log('Создан вызываемый абонент:', calledUserData);

  return calledUserData;
}

// endregion CalledUserData

// region Started

VoxEngine.addEventListener(AppEvents.Started, startedHandler);

async function startedHandler(): Promise<void> {
  try {
    await main();
  } catch (e) {
    await errorHandler(e);
  }
}

// endregion Started

/// endregion MAIN
