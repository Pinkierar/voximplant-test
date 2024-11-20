import VoximplantApiClientBase from '@voximplant/apiclient-nodejs';

export class VoximplantApiClient extends VoximplantApiClientBase {
  public static createInstance(pathToCredentials?: string, host?: string): Promise<VoximplantApiClient> {
    return new Promise((resolve) => {
      const client = new VoximplantApiClient(pathToCredentials, host);

      client.onReady = () => {
        resolve(client);
      };
    });
  }
}
