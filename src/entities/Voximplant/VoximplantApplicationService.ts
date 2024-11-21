import type { ApplicationInfo, RuleInfo } from '@voximplant/apiclient-nodejs/dist/Structures';
import { ErrorInfo } from '#includes/ErrorInfo';
import { pick } from '#includes/pick';
import { VoximplantApiClient } from './VoximplantApiClient';
import type {
  AddRuleRequest as VoximplantAddRuleRequest,
  SetRuleInfoRequest,
} from '@voximplant/apiclient-nodejs/dist/Interfaces';

type AddRuleRequest = Partial<Pick<VoximplantAddRuleRequest, 'scenarioId' | 'scenarioName'>> &
  Omit<VoximplantAddRuleRequest, 'applicationId' | 'applicationName' | 'ruleName' | 'scenarioId' | 'scenarioName'>;
type UpdateRuleRequest = Omit<SetRuleInfoRequest, 'ruleId' | 'ruleName'>;

export class VoximplantApplicationService {
  public constructor(
    private readonly client: VoximplantApiClient,
    private readonly application: ApplicationInfo,
  ) {}

  /**
   * Gets the rule by id.
   */
  public async getRuleById(ruleId: number): Promise<RuleInfo | null> {
    const {
      result: [rule],
    } = await this.client.Rules.getRules({
      applicationId: this.application.applicationId,
      applicationName: this.application.applicationName,
      ruleId,
      count: 1,
    }).then(VoximplantApiClient.errorHandler);

    return rule || null;
  }

  /**
   * Gets the rule by name.
   */
  public async getRuleByName(ruleName: string): Promise<RuleInfo | null> {
    const { result: rules } = await this.client.Rules.getRules({
      applicationId: this.application.applicationId,
      applicationName: this.application.applicationName,
      ruleName,
    }).then(VoximplantApiClient.errorHandler);

    const rule = rules.find((rule) => rule.ruleName === ruleName);

    return rule || null;
  }

  /**
   * Gets and edits a rule if existed by name.
   */
  public async getAndUpdateRuleByName(ruleName: string, request: UpdateRuleRequest): Promise<RuleInfo | null> {
    const rule = await this.getRuleByName(ruleName);
    if (!rule) return null;

    return await this.updateRule(rule, request);
  }

  /**
   * Edits or adds a new rule for the current application by name.
   */
  public async getAndUpdateOrAddRuleByName(ruleName: string, request: AddRuleRequest): Promise<RuleInfo> {
    const existRule = await this.getAndUpdateRuleByName(
      ruleName,
      pick(request, ['rulePattern', 'rulePatternExclude', 'bindKeyId', 'videoConference']),
    );

    if (existRule) return existRule;

    return this.addRule(ruleName, request);
  }

  private async updateRule(rule: RuleInfo, request: UpdateRuleRequest): Promise<RuleInfo> {
    if (!VoximplantApplicationService.isDifferentRoleData(rule, request)) return rule;

    const ruleId = rule.ruleId;

    await this.client.Rules.setRuleInfo({
      ruleId,
      ...request,
    }).then(VoximplantApiClient.errorHandler);

    const updatedRule = await this.getRuleById(ruleId);
    if (!updatedRule) {
      throw new ErrorInfo('VoximplantApplicationService.updateRule', 'Updated role not found', { rule, ruleId });
    }

    return updatedRule;
  }

  private async addRule(ruleName: string, request: AddRuleRequest): Promise<RuleInfo> {
    // @ts-ignore scenario not required
    const scenarioRequest: Pick<VoximplantAddRuleRequest, 'scenarioId' | 'scenarioName'> = null;

    const { ruleId: createdRuleId } = await this.client.Rules.addRule({
      ...scenarioRequest,
      applicationId: this.application.applicationId,
      applicationName: this.application.applicationName,
      ruleName,
      ...request,
    }).then(VoximplantApiClient.errorHandler);

    const createdRule = await this.getRuleById(createdRuleId);
    if (!createdRule) {
      throw new ErrorInfo('VoximplantApplicationService.addRule', 'Created role not found', {
        ruleName,
        createdRuleId,
      });
    }

    return createdRule;
  }

  private static isDifferentRoleData(rule: RuleInfo, request: UpdateRuleRequest): boolean {
    if (request.rulePattern !== rule.rulePattern) return true;
    if (request.rulePatternExclude !== rule.rulePatternExclude) return true;
    if (request.bindKeyId !== undefined) return true;
    if (request.videoConference !== rule.videoConference) return true;

    return false;
  }
}
