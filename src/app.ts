import express, { type Request, type Response, type NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import routes from './routes';
import webhookRoutes from './routes/webhook.routes';
import {
  generalLimiter,
  authLimiter,
  webhookLimiter,
  writeLimiter,
} from './middleware/rateLimit.middleware';
import { requestLogger } from './middleware/logging.middleware';
import {
  sanitizeInput,
  validateContentType,
  validateRequestSize,
  securityHeaders,
} from './middleware/validation.middleware';

const app = express();

// Security headers
app.use(securityHeaders);

// Structured JSON request logging
app.use(requestLogger);

// JSON + form parsing with size limits
// Use verify callback to capture raw body for webhook signature verification
app.use(
  express.json({
    limit: '1mb',
    verify: (
      req: Request & { rawBody?: Buffer },
      _res: Response,
      buf: Buffer,
      _encoding: string,
    ) => {
      if (buf && buf.length) {
        req.rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request validation
app.use(validateContentType);
app.use(validateRequestSize(1024 * 1024)); // 1MB max
app.use(sanitizeInput);

// Health endpoint (no rate limit)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'chainbounty-backend',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ChainBounty API Docs',
  }),
);

// Webhook routes with webhook-specific rate limiter
app.use('/webhooks', webhookLimiter, webhookRoutes);

// Auth routes with strict rate limiter
app.use('/api/v1/auth', authLimiter);

// Write operations rate limiter for mutating endpoints
app.use(
  [
    '/api/v1/bounties/:id/claim',
    '/api/v1/bounties/:id/submit',
    '/api/v1/bounties/:id/approve',
    '/api/v1/bounties/:id/reject',
  ],
  writeLimiter,
);

// General API rate limiter
app.use('/api/v1', generalLimiter);

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
});

export default app;
