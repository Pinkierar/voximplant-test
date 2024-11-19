import express, { type ErrorRequestHandler } from 'express';
import { HttpError, HttpStatus } from '#includes/Http';
import { JwtService } from '#entities/Jwt';
import { ACCOUNT_ID, KEY_ID, PRIVATE_KEY } from './config';

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
  next(new HttpError('route *', HttpStatus.NotFound, 'Entry point not found', { originalUrl: req.originalUrl }));
});

app.use(((rawError, _req, res, _next) => {
  const error = HttpError.from(rawError);

  res.status(error.status).json(error.toJSON());
}) satisfies ErrorRequestHandler);

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});

// // app.js on client
// // Please, change this data before go.
//
// const appName = 'VOXAPPLICATION';
// const account = 'ACCOUNT';
// const username = `${appUser}@${appName}.${account}.voximplant.com`;
//
// const voximplant = Voximplant.getInstance();
//
async function main() {
  // await voximplant.init({
  //   node: ConnectionNode.NODE_11,
  // });
  //
  // // Connect to the cloud and request a key
  // voximplant.connect().then(() => voximplant.requestOneTimeLoginKey(username));
  //
  // // Listen to the server response
  // voximplant.addEventListener(Voximplant.Events.AuthResult, (e) => {
  //   console.log(`AuthResult: ${e.result}`);
  //   console.log(`Auth code: ${e.code}`);
  //   if (e.result) {
  //     // Login is successful
  //   } else if (e.code == 302) {
  //     console.log(e.key);
  //     // IMPORTANT: You should always calculate the token on your backend!
  //     $.post(
  //       'https://your.backend.com/',
  //       {
  //         key: e.key,
  //       },
  //       (token) => {
  //         voximplant.loginWithOneTimeKey(username, token);
  //       },
  //       'text',
  //     );
  //   }
  // });

  const token = await JwtService.createJwt(PRIVATE_KEY, 3600, {
    kid: KEY_ID,
    iss: ACCOUNT_ID,
  });

  console.log(token);
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.log('error', e);
  }
})();
