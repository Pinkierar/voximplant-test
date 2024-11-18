import express, { type ErrorRequestHandler } from 'express';
import { HttpError, HttpStatus } from '#includes/Http';

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
