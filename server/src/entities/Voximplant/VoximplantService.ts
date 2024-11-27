import type { ApplicationInfo } from '@voximplant/apiclient-nodejs/dist/Structures';
import { ErrorInfo } from '#includes/ErrorInfo';
import { VoximplantApiClient } from './VoximplantApiClient';

export class VoximplantService {
  public constructor(private readonly client: VoximplantApiClient) {}

  /**
   * Gets the account's application by id.
   */
  public async getApplicationById(applicationId: number): Promise<ApplicationInfo | null> {
    const {
      result: [application],
    } = await this.client.Applications.getApplications({
      applicationId,
      count: 1,
    }).then(VoximplantApiClient.errorHandler);

    return application || null;
  }

  /**
   * Gets the account's application by name.
   */
  public async getApplicationByName(applicationName: string): Promise<ApplicationInfo | null> {
    const { result: applications } = await this.client.Applications.getApplications({
      applicationName,
    }).then(VoximplantApiClient.errorHandler);

    const application = applications.find((application) => application.applicationName.startsWith(applicationName));

    return application || null;
  }

  /**
   * Gets or adds a new account's application by name.
   */
  public async getOrAddApplicationByName(applicationName: string): Promise<ApplicationInfo> {
    const existApplication = await this.getApplicationByName(applicationName);
    if (existApplication) return existApplication;

    return await this.addApplication(applicationName);
  }

  private async addApplication(applicationName: string): Promise<ApplicationInfo> {
    const { applicationId } = await this.client.Applications.addApplication({
      applicationName,
    }).then(VoximplantApiClient.errorHandler);

    const createdApplication = await this.getApplicationById(applicationId);
    if (!createdApplication) {
      throw new ErrorInfo('VoximplantService.addApplication', 'Created application not found', {
        applicationName,
        applicationId,
      });
    }

    return createdApplication;
  }
}
