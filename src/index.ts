import './config';
import { VoximplantApiClient, VoximplantApplicationService, VoximplantService } from '#entities/Voximplant';
import express, { type ErrorRequestHandler } from 'express';
import { HttpStatus } from '#includes/HttpStatus';
import { HttpError } from '#includes/HttpError';
import { VOXIMPLANT_CREDENTIALS } from './config';

const port = 3000;

const app = express();

app.get('/api/execute', async (_req, res, next) => {
  try {
    res.json({
      someAnswer: 'это я',
    });
  } catch (e) {
    next(e);
  }
});

app.all('*', async (req, _res, next) => {
  next(new HttpError('app.all *', HttpStatus.NotFound, 'Entrypoint not found', { originalUrl: req.originalUrl }));
});

app.use(((rawError, _req, res, _next) => {
  const error = HttpError.from(rawError);

  res.status(error.status).json(error.toJSON());
}) satisfies ErrorRequestHandler);

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});

async function main() {
  const serverPrefix = 'pr-test-1';

  const applicationName = 'work';
  const ruleName = 'any';
  const rulePattern = '.*';

  const client = await VoximplantApiClient.createInstance(VOXIMPLANT_CREDENTIALS);
  const voximplantService = new VoximplantService(client);
  const application = await voximplantService.findOrCreateApplicationByName(`${serverPrefix}-${applicationName}`);
  const voximplantApplicationService = new VoximplantApplicationService(client, application);
  const rule = await voximplantApplicationService.setRuleByName(`${serverPrefix}-${ruleName}`, rulePattern);
  console.log({
    application,
    rule,
  });
  // await client.Rules.getRules({});
  // const l = await client.CallLists.createCallList({
  //   name: 'test-1 ',
  //   ruleId: 7712374,
  //   fileContent: Buffer.from('f', 'utf8'),
  //   numAttempts: 1,
  //   priority: 1,
  //   maxSimultaneous: 1,
  // });
  // console.log(l);
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.log('Error in main function:', e);
  }
})();
