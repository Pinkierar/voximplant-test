import VoximplantApiClient from '@voximplant/apiclient-nodejs';
import type { ApplicationInfo } from '@voximplant/apiclient-nodejs/dist/Structures';
import { ErrorInfo } from '#includes/ErrorInfo';

export class VoximplantService {
  public constructor(private readonly client: VoximplantApiClient) {}

  public async findApplicationByName(applicationName: string): Promise<ApplicationInfo | null> {
    const { result: applications } = await this.client.Applications.getApplications({ applicationName });

    const application = applications.find((application) => application.applicationName.startsWith(applicationName));

    return application || null;
  }

  public async findOrCreateApplicationByName(applicationName: string): Promise<ApplicationInfo> {
    const existApplication = await this.findApplicationByName(applicationName);
    if (existApplication) return existApplication;

    return await this.createApplication(applicationName);
  }

  private async createApplication(applicationName: string): Promise<ApplicationInfo> {
    await this.client.Applications.addApplication({ applicationName });

    const createdApplication = await this.findApplicationByName(applicationName);
    if (createdApplication) return createdApplication;

    throw new ErrorInfo('VoximplantService.createApplication', 'Created application not found', { applicationName });
  }
}
