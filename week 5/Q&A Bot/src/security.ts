import express from 'express';
import { logger } from './logger.js';

/**
 * Security and Production-Ready Utilities for Phase 8
 */

/**
 * Request ID middleware
 * Assigns unique ID to each request for tracking
 */
export function requestIdMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const requestId = logger.constructor.name === 'Logger' 
    ? `req-${Date.now()}-${Math.random().toString(36).substring(7)}`
    : `req-${Date.now()}`;
  
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

/**
 * Rate limiting middleware (simple version)
 */
const requestCounts = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

export function rateLimitMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip)!;
  const recentRequests = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= RATE_LIMIT_MAX) {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Please try again later'
    });
    return;
  }

  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);

  next();
}

/**
 * Timeout middleware
 */
export function timeoutMiddleware(timeoutMs: number = 30000) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          requestId: (req as any).requestId
        });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

/**
 * Request/Response logging middleware
 */
export function loggingMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const startTime = Date.now();
  const requestId = (req as any).requestId;

  // Log request
  logger.debug(`${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query
  });

  // Capture response
  const originalJson = res.json;
  res.json = function (data: any) {
    const duration = Date.now() - startTime;
    logger.logRequest(req.method, req.path, res.statusCode, duration);
    return originalJson.call(this, data);
  };

  next();
}

/**
 * CORS middleware
 */
export function corsMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['localhost:3000', 'localhost:3001'];
  const origin = req.headers.origin || '';

  if (allowedOrigins.some(allowed => origin.includes(allowed))) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.header('Content-Security-Policy', "default-src 'self'");
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

/**
 * Input sanitization
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/script/gi, '')
    .trim()
    .substring(0, 1000);
}

/**
 * Validate API key
 */
export function validateApiKey(req: express.Request): boolean {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    // If no API key configured, allow all
    return true;
  }

  return apiKey === expectedKey;
}

/**
 * API Key middleware
 */
export function apiKeyMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (process.env.API_KEY && !validateApiKey(req)) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
    return;
  }

  next();
}
