import type { CallList, RuleInfo } from '@voximplant/apiclient-nodejs/dist/Structures';
import { ErrorInfo } from '#includes/ErrorInfo';
import { VoximplantApiClient } from './VoximplantApiClient';
import {
  type BindPhoneNumberToApplicationRequest,
  type CreateCallListRequest as VoximplantCreateCallListRequest,
} from '@voximplant/apiclient-nodejs/dist/Interfaces';

type CreateCallListRequest = Omit<VoximplantCreateCallListRequest, 'ruleId' | 'name'>;

export class VoximplantRuleService {
  public constructor(
    private readonly client: VoximplantApiClient,
    private readonly rule: RuleInfo,
  ) {}

  /**
   * Get call list by id.
   */
  public async getCallListById(callListId: number): Promise<CallList | null> {
    const {
      result: [callList],
    } = await this.client.CallLists.getCallLists({
      applicationId: this.rule.applicationId,
      listId: callListId,
      count: 1,
    }).then(VoximplantApiClient.errorHandler);

    return callList || null;
  }

  /**
   * Get call list by name.
   */
  public async getCallListByName(callListName: string): Promise<CallList | null> {
    const { result: callLists } = await this.client.CallLists.getCallLists({
      applicationId: this.rule.applicationId,
      name: callListName,
    }).then(VoximplantApiClient.errorHandler);

    const callList = callLists.find((callList) => callList.listName === callListName);

    return callList || null;
  }

  /**
   * Get or adds a new call list by name.
   * @see VoximplantApiClient.CallLists.createCallList
   */
  public async getOrAddRuleByName(callListName: string, request: CreateCallListRequest): Promise<CallList> {
    const existCallList = await this.getCallListByName(callListName);
    if (existCallList) return existCallList;

    return await this.addCallList(callListName, request);
  }

  /**
   * Bind the phone number to the application.
   */
  public async bindPhoneNumber(phoneNumber: string): Promise<void> {
    // @ts-ignore no other arguments required
    const request: Omit<BindPhoneNumberToApplicationRequest, 'ruleId' | 'phoneNumber'> = {};

    await this.client.PhoneNumbers.bindPhoneNumberToApplication({
      ...request,
      ruleId: this.rule.ruleId,
      phoneNumber,
    }).then(VoximplantApiClient.errorHandler);
  }

  private async addCallList(callListName: string, request: CreateCallListRequest): Promise<CallList> {
    const { listId: callListId } = await this.client.CallLists.createCallList({
      ruleId: this.rule.ruleId,
      name: callListName,
      ...request,
    }).then(VoximplantApiClient.errorHandler);

    const createdCallList = await this.getCallListById(callListId);
    if (!createdCallList) {
      throw new ErrorInfo('VoximplantCallListService.addCallList', 'Created callList not found', {
        callListName,
        callListId,
      });
    }

    return createdCallList;
  }
}
