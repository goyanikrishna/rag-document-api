import { Request, Response, NextFunction } from 'express';
// common
import { SuccessMessages } from '@/common/constants/app-messages';
// modules
import ragService from '@/modules/rag/services/rag.service';

/**
 * Queries a single document using similarity search and RAG engine.
 * Enforces ownership — only the document's owner can query it.
 */
async function queryDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { question, stream } = req.body;

    // req.user is guaranteed by authenticateUser middleware
    const userId = req.user!.id;

    if (stream === true) {
      try {
        const { stream: textStream, sources } = await ragService.queryDocumentStream(
          id,
          userId,
          question,
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Handle client disconnect to avoid writing to a closed stream
        let clientDisconnected = false;
        req.on('close', () => {
          clientDisconnected = true;
        });

        res.write(`event: metadata\ndata: ${JSON.stringify({ sources })}\n\n`);

        for await (const chunk of textStream) {
          if (clientDisconnected) break;
          res.write(`event: content\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
        }

        if (!clientDisconnected) {
          res.write(`event: done\ndata: [DONE]\n\n`);
        }
      } catch (streamError: any) {
        if (!res.headersSent) {
          return next(streamError);
        }
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: streamError.message || 'An error occurred while processing your query.',
            error_code: streamError.errorCode || 'TOO_MANY_REQUESTS',
          })}\n\n`,
        );
      } finally {
        if (res.headersSent) {
          res.end();
        }
      }
      return;
    }

    // Non-streaming (default): return complete JSON response
    const response = await ragService.queryDocument(id, userId, question);

    res.status(200).json({
      success: true,
      status: 200,
      message: SuccessMessages.queryProcessed,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Queries across ALL documents belonging to the authenticated user.
 */
async function queryUserDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.user is guaranteed by authenticateUser middleware
    const userId = req.user!.id;
    const { question, stream } = req.body;

    if (stream === true) {
      try {
        const { stream: textStream, sources } = await ragService.queryUserDocumentsStream(
          userId,
          question,
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Handle client disconnect to avoid writing to a closed stream
        let clientDisconnected = false;
        req.on('close', () => {
          clientDisconnected = true;
        });

        res.write(`event: metadata\ndata: ${JSON.stringify({ sources })}\n\n`);

        for await (const chunk of textStream) {
          if (clientDisconnected) break;
          res.write(`event: content\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
        }

        if (!clientDisconnected) {
          res.write(`event: done\ndata: [DONE]\n\n`);
        }
      } catch (streamError: any) {
        if (!res.headersSent) {
          return next(streamError);
        }
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: streamError.message || 'An error occurred while processing your query.',
            error_code: streamError.errorCode || 'TOO_MANY_REQUESTS',
          })}\n\n`,
        );
      } finally {
        if (res.headersSent) {
          res.end();
        }
      }
      return;
    }

    // Non-streaming (default): return complete JSON response
    const response = await ragService.queryUserDocuments(userId, question);

    res.status(200).json({
      success: true,
      status: 200,
      message: SuccessMessages.queryProcessed,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves paginated Q&A query history for the authenticated user.
 * Supports filtering by optional query parameter document_id.
 */
async function getQueryHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { document_id, page, limit } = req.query;

    const response = await ragService.getQueryHistory(userId, {
      document_id: document_id ? String(document_id) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json({
      success: true,
      status: 200,
      message: SuccessMessages.historyRetrieved,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  queryDocument,
  queryUserDocuments,
  getQueryHistory,
};
