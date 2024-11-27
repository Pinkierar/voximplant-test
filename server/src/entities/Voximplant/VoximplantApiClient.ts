import VoximplantApiClientBase from '@voximplant/apiclient-nodejs';
import type { APIError } from '@voximplant/apiclient-nodejs/dist/Structures';
import { ErrorInfo } from '#includes/ErrorInfo';

interface VoximplantResponseBase {
  error?: APIError;
}

export class VoximplantApiClient extends VoximplantApiClientBase {
  public static createInstance(pathToCredentials?: string, host?: string): Promise<VoximplantApiClient> {
    return new Promise((resolve) => {
      const client = new VoximplantApiClient(pathToCredentials, host);

      client.onReady = () => {
        resolve(client);
      };
    });
  }

  public static errorHandler<T extends VoximplantResponseBase>(response: T): Omit<T, 'error'> {
    if (response.error) {
      throw new ErrorInfo('VoximplantApiClient.errorHandler', response.error.msg, { code: response.error.code });
    }

    return response;
  }
}
