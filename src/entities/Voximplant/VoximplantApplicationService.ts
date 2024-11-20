import type { ApplicationInfo, RuleInfo } from '@voximplant/apiclient-nodejs/dist/Structures';
import { ErrorInfo } from '#includes/ErrorInfo';
import { pick } from '#includes/pick';
import type { VoximplantApiClient } from './VoximplantApiClient';
import type { AddRuleRequest } from '@voximplant/apiclient-nodejs/dist/Interfaces';

export class VoximplantApplicationService {
  private readonly applicationRequest;

  public constructor(
    private readonly client: VoximplantApiClient,
    private readonly application: ApplicationInfo,
  ) {
    this.applicationRequest = pick(this.application, ['applicationId', 'applicationName']);
  }

  public async findRuleByName(ruleName: string): Promise<RuleInfo | null> {
    const rules = await this.client.Rules.getRules({
      ...this.applicationRequest,
      ruleName,
    });

    const rule = rules.result.find((rule) => rule.ruleName === ruleName);

    return rule || null;
  }

  public async setRuleByName(ruleName: string, rulePattern: string): Promise<RuleInfo> {
    const existRule = await this.findRuleByName(ruleName);
    if (!existRule) {
      return this.createRule(ruleName, rulePattern);
    }

    return await this.setRulePattern(existRule, rulePattern);
  }

  private async findRuleById(ruleId: number): Promise<RuleInfo | null> {
    const {
      result: [rule],
    } = await this.client.Rules.getRules({
      ...this.applicationRequest,
      ruleId,
    });

    return rule || null;
  }

  private async setRulePattern(rule: RuleInfo, rulePattern: string): Promise<RuleInfo> {
    if (rule.rulePattern === rulePattern) return rule;

    const { result: ruleId } = await this.client.Rules.setRuleInfo({
      ruleId: rule.ruleId,
      rulePattern,
    });

    const updatedRule = await this.findRuleById(ruleId);
    if (!updatedRule) {
      throw new ErrorInfo('VoximplantApplicationService.setRulePattern', 'Updated role not found', { rule, ruleId });
    }

    return updatedRule;
  }

  private async createRule(ruleName: string, rulePattern: string): Promise<RuleInfo> {
    // @ts-ignore scenario not required
    const scenarioRequest: Pick<AddRuleRequest, 'scenarioId' | 'scenarioName'> = {};

    const { ruleId } = await this.client.Rules.addRule({
      ...this.applicationRequest,
      ...scenarioRequest,
      ruleName,
      rulePattern,
    });

    const createdRule = await this.findRuleById(ruleId);
    if (!createdRule) {
      throw new ErrorInfo('VoximplantApplicationService.createRule', 'Created role not found', { ruleName, ruleId });
    }

    return createdRule;
  }
}
