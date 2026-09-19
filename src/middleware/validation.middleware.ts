import type { Request, Response, NextFunction } from 'express';

/**
 * Sanitizes an input string to remove null bytes, escape HTML to prevent XSS,
 * and neutralize dangerous javascript: pseudo-protocols.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return input
    .replace(/\0/g, '') // Remove null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Strip iframes
    .replace(/javascript:[^"'>\s]*/gi, '') // Strip javascript: URLs
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Strip inline event handlers like onerror=...
    .replace(/on\w+\s*=\s*[^"'>\s]+/gi, '')
    .replace(/</g, '&lt;') // HTML escape brackets
    .replace(/>/g, '&gt;')
    .trim();
}

/**
 * Sanitizes user input by trimming whitespace, stripping null bytes, and escaping HTML.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body as Record<string, unknown>);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query as Record<string, unknown>);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params as Record<string, unknown>);
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === 'string') {
      obj[key] = sanitizeHtml(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'string') {
          value[index] = sanitizeHtml(item);
        } else if (typeof item === 'object' && item !== null) {
          sanitizeObject(item as Record<string, unknown>);
        }
      });
    }
  }
}


/**
 * Validates Content-Type for POST/PUT/PATCH requests.
 */
export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.includes('application/json')) {
      res.status(415).json({ error: 'Content-Type must be application/json' });
      return;
    }
  }

  next();
}

/**
 * Request size validation - blocks suspiciously large payloads.
 * Express has built-in limits but this provides custom messaging.
 */
export function validateRequestSize(limit: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength, 10) > limit) {
      res.status(413).json({
        error: 'Request payload too large',
        maxSize: `${limit} bytes`,
      });
      return;
    }

    next();
  };
}

/**
 * Validates common ID parameters (UUIDs).
 */
export function validateId(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];

    if (!id) {
      res.status(400).json({ error: `Missing required parameter: ${paramName}` });
      return;
    }

    // CUID pattern (starts with 'c', 25 chars total)
    const cuidPattern = /^c[a-z0-9]{24}$/;

    if (!cuidPattern.test(id)) {
      res.status(400).json({
        error: `Invalid ${paramName} format`,
        detail: 'Expected a valid CUID',
      });
      return;
    }

    next();
  };
}

/**
 * Security headers middleware.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  next();
}
