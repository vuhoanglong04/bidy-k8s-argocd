import express from 'express';
import cors from 'cors';

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';

import { corsConfig } from './config/cors.config';
import {
  securityHeaders,
  rateLimiters,
  securityLogger,
} from './middlewares/security.middleware';

import { indexRouter } from './routes/index';
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/error.middleware';

const app = express();
app.disable('x-powered-by');

// Configure trust proxy according to your specific deployment topology
// e.g., 1 if you are behind a single reverse proxy (Nginx, Cloudflare, etc.)
app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(cors(corsConfig));
app.use(securityLogger);
app.use(rateLimiters.general);

app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  }),
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Bare path (not under /api/v1): this is what the Docker healthcheck and
// nginx's /health location block both target.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(indexRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;