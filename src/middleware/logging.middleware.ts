import { type Request, type Response, type NextFunction } from 'express';

export interface StructuredRequestLog {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip?: string;
  userAgent?: string;
  contentLength?: string;
}

/**
 * Structured JSON logging middleware for all API requests.
 * Records method, path, timestamp, response status code, and execution time.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime();
  const requestTimestamp = new Date().toISOString();

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationMs = parseFloat(((diff[0] * 1e3) + (diff[1] * 1e-6)).toFixed(2));

    const logEntry: StructuredRequestLog = {
      timestamp: requestTimestamp,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      contentLength: res.get('content-length'),
    };

    // Output structured JSON for log aggregation engines
    if (process.env.NODE_ENV !== 'test') {
      console.info(JSON.stringify(logEntry));
    }
  });

  next();
}
