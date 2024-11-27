import { pick } from '#includes/pick';

export class ErrorInfo extends Error {
  public readonly sender: string;
  public readonly info: Record<string, any> | null;

  public constructor(sender: string, message: string, info?: unknown, stack?: string) {
    super(message);

    this.sender = sender;
    this.info = info || null;

    if (stack) this.stack = stack;
  }

  public static from(error: unknown): ErrorInfo {
    if (error == null) return new ErrorInfo('Unknown sender', 'Unknown error');

    if (typeof error === 'string') return new ErrorInfo('Unknown sender', error);

    if (error instanceof ErrorInfo) return error;

    if (error instanceof Error) return new ErrorInfo('Unknown sender', error.message, undefined, error.stack);

    const message = ErrorInfo.getMessage(error) || 'Unknown error';

    return new ErrorInfo('Unknown sender', message, error);
  }

  private static getMessage(error: unknown): string | null {
    if (error == null) return null;
    if (typeof error !== 'object') return null;

    if (!('message' in error)) return null;
    const message = error.message;

    if (typeof message !== 'string') return null;

    return message;
  }

  public toJSON(): Record<string, any> {
    return pick(this, ['sender', 'message', 'info', 'stack']);
  }
}
