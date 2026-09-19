import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { requestLogger, type StructuredRequestLog } from '../src/middleware/logging.middleware';

describe('Structured Request Logging Middleware (Issue #14)', () => {
  let app: express.Express;
  let loggedEntries: StructuredRequestLog[];
  let originalConsoleInfo: typeof console.info;

  beforeEach(() => {
    loggedEntries = [];
    originalConsoleInfo = console.info;
    console.info = (message?: any, ...optionalParams: any[]) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed && parsed.method && parsed.path) {
          loggedEntries.push(parsed);
        }
      } catch {
        // Not a JSON log
      }
    };

    app = express();
    // Enable logging in test for verification
    const testLogger = (req: Request, res: Response, next: any) => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      requestLogger(req, res, () => {
        process.env.NODE_ENV = oldEnv;
        next();
      });
    };
    app.use(testLogger);

    app.get('/test/success', (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    app.post('/test/created', (_req: Request, res: Response) => {
      res.status(201).json({ created: true });
    });

    app.get('/test/error', (_req: Request, res: Response) => {
      res.status(500).json({ error: 'Server error' });
    });
  });

  afterEach(() => {
    console.info = originalConsoleInfo;
  });

  it('should log incoming GET request with method, path, timestamp, status, and duration', async () => {
    await request(app).get('/test/success').expect(200);

    expect(loggedEntries.length).toBeGreaterThan(0);
    const entry = loggedEntries[0];
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/test/success');
    expect(entry.statusCode).toBe(200);
    expect(typeof entry.durationMs).toBe('number');
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
  });

  it('should log POST requests with correct status code 201', async () => {
    await request(app).post('/test/created').expect(201);

    expect(loggedEntries.length).toBeGreaterThan(0);
    const entry = loggedEntries[0];
    expect(entry.method).toBe('POST');
    expect(entry.path).toBe('/test/created');
    expect(entry.statusCode).toBe(201);
  });

  it('should log 404 responses for nonexistent routes', async () => {
    await request(app).get('/test/nonexistent').expect(404);

    expect(loggedEntries.length).toBeGreaterThan(0);
    const entry = loggedEntries[0];
    expect(entry.path).toBe('/test/nonexistent');
    expect(entry.statusCode).toBe(404);
  });

  it('should format logs in valid structured JSON', async () => {
    await request(app).get('/test/error').expect(500);

    expect(loggedEntries.length).toBeGreaterThan(0);
    const entry = loggedEntries[0];
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('method');
    expect(entry).toHaveProperty('path');
    expect(entry).toHaveProperty('statusCode');
    expect(entry).toHaveProperty('durationMs');
    expect(entry.statusCode).toBe(500);
  });
});
