import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env';
import { accessLogger, errorHandler, notFound } from './middleware/errorHandler';
import { idempotency } from './middleware/idempotency';
import { requestContext } from './middleware/requestContext';
import { v1Router } from './routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed =
        origin === env.corsOrigin ||
        (env.nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
      callback(allowed ? null : new Error('Origin not allowed'), allowed);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext);
  app.use(accessLogger);
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded.',
          requestId: _req.requestId,
        },
      });
    },
  }));
  app.use(idempotency);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'rupsa-next-api', version: 'v1' });
  });

  const v1 = v1Router();
  app.use('/api/v1', v1);
  app.use('/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
