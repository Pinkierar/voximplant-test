import { ErrorInfo } from '#includes/ErrorInfo';
import { HttpStatus, httpStatuses } from '#includes/Http';

export class HttpError extends ErrorInfo {
  public readonly status: HttpStatus;

  public constructor(sender: string, status: HttpStatus, message: string, info?: unknown, stack?: string) {
    super(sender, message, info, stack);

    this.status = status;
  }

  public static override from(error: unknown): HttpError {
    const { sender, message, info, stack } = ErrorInfo.from(error);
    const status = HttpError.getStatus(error) || HttpStatus.InternalServerError;

    return new HttpError(sender, status, message, info, stack);
  }

  private static getStatus(error: unknown): HttpStatus | null {
    if (error == null) return null;
    if (typeof error !== 'object') return null;

    if (!('status' in error)) return null;
    const status = error.status;

    if (typeof status !== 'number') return null;
    if (!httpStatuses.includes(status)) return null;

    return status;
  }

  public override toJSON(): Record<string, any> {
    return {
      status: this.status,
      ...super.toJSON(),
    };
  }
}
