import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from '@/modules/auth/auth.routes';
import documentRoutes from '@/modules/document/document.routes';
import ragRoutes from '@/modules/rag/rag.routes';
import { errorHandler } from '@/common/middlewares/error-handler';
import { logger } from '@/config/logger';
import APIError from '@/common/errors/api-error';
import httpStatus from 'http-status';

import { setupSwagger } from '@/config/swagger';

const app = express();

// 1. Security Headers (Helmet)
app.use(helmet());

// 2. Register Swagger UI documentation route at /api-docs
setupSwagger(app);

// 3. Middleware: Parse incoming JSON and URL-encoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Middleware: Custom Request Logger
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(
      `[HTTP] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} | Duration: ${duration}ms`,
    );
  });
  next();
});

// 5. Middleware: CORS Headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 6. Rate Limiter: Authentication endpoints (10 requests per minute per IP)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    status: 429,
    message: 'Too many authentication attempts. Please try again in a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 7. API Routes Registration
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/documents', documentRoutes);

// 8. Fallback: Route Not Found (404)
app.use((req, res, next) => {
  next(
    new APIError(
      `Requested resource "${req.method} ${req.originalUrl}" was not found.`,
      httpStatus.NOT_FOUND as number,
      true,
    ),
  );
});

// 9. Global Exception Handler (must be registered last)
app.use(errorHandler);

export default app;
