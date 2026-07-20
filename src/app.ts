import express from 'express';
import helmet from 'helmet';
import documentRoutes from '@/modules/document/document.routes';
import ragRoutes from '@/modules/rag/rag.routes';
import { errorHandler } from '@/common/middlewares/error-handler';
import { logger } from '@/config/logger';
import APIError from '@/common/errors/api-error';
import httpStatus from 'http-status';

const app = express();

app.use(helmet());

// 1. Middleware: Parse incoming JSON payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Middleware: Custom Request Logger
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

// 3. Middleware: Custom CORS Headers (removes dependency on external package)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 4. API Routes Registration
app.use('/api/documents', documentRoutes);
app.use('/api/documents', ragRoutes);

// 5. Fallback: Route Not Found (404)
app.use((req, res, next) => {
  next(
    new APIError(
      `Requested resource "${req.method} ${req.originalUrl}" was not found.`,
      httpStatus.NOT_FOUND as number,
      true,
    ),
  );
});

// 6. Global Exception Handler (must be registered last)
app.use(errorHandler);

export default app;
