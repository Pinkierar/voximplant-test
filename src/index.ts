// import express, { type ErrorRequestHandler } from 'express';
// import { HttpStatus } from '#includes/HttpStatus';
// import { HttpError } from '#includes/HttpError';
//
// const port = 3000;
//
// const app = express();
//
// app.get('/api/execute', async (_req, res, next) => {
//   try {
//     res.json({
//       someAnswer: 'это я',
//     });
//   } catch (e) {
//     next(e);
//   }
// });
//
// app.all('*', async (req, _res, next) => {
//   next(new HttpError('app.all *', HttpStatus.NotFound, 'Entrypoint not found', { originalUrl: req.originalUrl }));
// });
//
// app.use(((rawError, _req, res, _next) => {
//   const error = HttpError.from(rawError);
//
//   res.status(error.status).json(error.toJSON());
// }) satisfies ErrorRequestHandler);
//
// app.listen(port, () => {
//   console.log(`Listening on ${port}`);
// });

import {
  VoximplantApiClient,
  VoximplantApplicationService,
  VoximplantRuleService,
  VoximplantService,
} from '#entities/Voximplant';
import { VOXIMPLANT_CREDENTIALS } from './config';

type CallListDataRow = [phone: string, name: string];

async function main() {
  const serverPrefix = 'pr-test-1';

  const applicationName = 'work';

  const ruleName = 'any';
  const rulePattern = '.*';

  const callListName = 'my';
  const callListData: CallListDataRow[] = [['79585477508', 'Гриша Романов']];

  const client = await VoximplantApiClient.createInstance(VOXIMPLANT_CREDENTIALS);

  const voximplantService = new VoximplantService(client);
  const fullApplicationName = `${serverPrefix}-${applicationName}`;
  const application = await voximplantService.getOrAddApplicationByName(fullApplicationName);
  console.log({ application });

  const voximplantApplicationService = new VoximplantApplicationService(client, application);
  const rule = await voximplantApplicationService.getAndUpdateOrAddRuleByName(ruleName, { rulePattern });
  console.log({ rule });

  const voximplantRuleService = new VoximplantRuleService(client, rule);
  const fullCallListData: CallListDataRow[] = [['phone', 'name'], ...callListData];
  const callListDataCvs = fullCallListData.map((row) => row.join(';')).join('\n');
  const callList = await voximplantRuleService.getOrAddRuleByName(callListName, {
    fileContent: Buffer.from(callListDataCvs, 'utf8'),
    numAttempts: 3,
    priority: 1,
    maxSimultaneous: 1,
    intervalSeconds: 300 /* 5min */,
  });
  console.log({ callList });

  // await this.client.PhoneNumbers.bindPhoneNumberToApplication({
  //   applicationName,
  //   applicationId,
  //
  // });
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.log('Error in main function:', e);
  }
})();
