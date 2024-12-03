import express, { type ErrorRequestHandler } from 'express';
import { HttpStatus } from '#includes/HttpStatus';
import { HttpError } from '#includes/HttpError';
import { VoximplantApiClient } from '#entities/Voximplant';
import { VOXIMPLANT_CREDENTIALS } from './config';
import bodyParser from 'body-parser';

type CallListDataRow = [phone: string, name: string];

const port = 3000;

const app = express();

app.use(bodyParser.json());

app.post('/api/call-lists', async (req, res, next) => {
  try {
    const { name, ruleId, list } = req.body;

    if (!name || typeof name !== 'string') {
      throw new HttpError(
        '/api/call-lists',
        HttpStatus.BadRequest,
        'Имя списка обзвона не указано, или имеет неверный формат',
        { name },
      );
    }

    if (!ruleId || typeof ruleId !== 'number') {
      throw new HttpError('/api/call-lists', HttpStatus.BadRequest, 'ID правила не указан, или имеет неверный формат', {
        ruleId,
      });
    }

    if (!list || typeof list !== 'object' || !Array.isArray(list) || list.length === 0) {
      throw new HttpError(
        '/api/call-lists',
        HttpStatus.BadRequest,
        'Список данных для списка обзвона не указан, или имеет неверный формат',
        { list },
      );
    }

    list.forEach((row, index) => {
      if (!row || typeof row !== 'object' || !Array.isArray(row) || row.length !== 2) {
        throw new HttpError(
          '/api/call-lists',
          HttpStatus.BadRequest,
          'Список данных для списка обзвона имеет неверный формат',
          { row, index, list },
        );
      }

      if (!row[0] || typeof row[0] !== 'string') {
        throw new HttpError(
          '/api/call-lists',
          HttpStatus.BadRequest,
          'Номер телефона не указан, или имеет неверный формат',
          { phone: row[0], row, index, list },
        );
      }

      if (!row[1] || typeof row[1] !== 'string') {
        throw new HttpError(
          '/api/call-lists',
          HttpStatus.BadRequest,
          'Имя вызываемого абонента не указано, или имеет неверный формат',
          { name: row[1], row, index, list },
        );
      }

      return false;
    });

    const callListData: CallListDataRow[] = list;

    const fullCallListData: CallListDataRow[] = [['phone', 'name'], ...callListData];
    const callListDataCvs = fullCallListData.map((row) => row.join(';')).join('\n');
    const client = await VoximplantApiClient.createInstance(VOXIMPLANT_CREDENTIALS);

    await client.CallLists.createCallList({
      ruleId,
      name,
      fileContent: Buffer.from(callListDataCvs, 'utf8'),
      numAttempts: 3,
      priority: 1,
      maxSimultaneous: 1,
      intervalSeconds: 300 /* 5min */,
    }).then(VoximplantApiClient.errorHandler);

    // const serverPrefix = 'pr-test-1';
    //
    // const applicationName = 'work';
    // const workingPhoneNumber = '699118451';
    //
    // const ruleName = 'any';
    // const rulePattern = '.*';
    //
    // const callListName = 'my'; //
    // const callListData: CallListDataRow[] = [['79585477508', 'Гриша Романов']]; //
    //
    // const client = await VoximplantApiClient.createInstance(VOXIMPLANT_CREDENTIALS);
    //
    // const voximplantService = new VoximplantService(client);
    // const fullApplicationName = `${serverPrefix}-${applicationName}`;
    // const application = await voximplantService.getOrAddApplicationByName(fullApplicationName);
    // console.log({ application });
    //
    // const voximplantApplicationService = new VoximplantApplicationService(client, application);
    // const rule = await voximplantApplicationService.getRuleByName(ruleName);
    // console.log({ rule });
    //
    // const voximplantRuleService = new VoximplantRuleService(client, rule);
    // const fullCallListData: CallListDataRow[] = [['phone', 'name'], ...callListData];
    // const callListDataCvs = fullCallListData.map((row) => row.join(';')).join('\n');
    // const callList = await voximplantRuleService.getOrAddCallListByName(callListName, {
    //   fileContent: Buffer.from(callListDataCvs, 'utf8'),
    //   numAttempts: 3,
    //   priority: 1,
    //   maxSimultaneous: 1,
    //   intervalSeconds: 300 /* 5min */,
    // });
    // console.log({ callList });
    //
    // await voximplantRuleService.bindPhoneNumber(workingPhoneNumber);

    res.status(200).json({
      result: 'CallList создан',
    });
  } catch (e) {
    next(e);
  }
});

app.all('*', async (req, _res, next) => {
  next(new HttpError('app.all *', HttpStatus.NotFound, 'Entrypoint not found', { originalUrl: req.originalUrl }));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(((rawError, _req, res, _next) => {
  const error = HttpError.from(rawError);

  res.status(error.status).json(error.toJSON());
}) satisfies ErrorRequestHandler);

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
