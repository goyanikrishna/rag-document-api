import { Request, Response, NextFunction } from 'express';
// modules
import ragService from '@/modules/rag/services/rag.service';

/**
 * Queries a document using the similarity search and RAG engine.
 */
async function queryDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { question, stream } = req.body;

    // Default behaviour: stream the response as Server-Sent Events (SSE)
    // Pass { stream: false } in the request body to receive a single JSON response instead.
    if (stream !== false) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Prevent proxy buffering
      res.flushHeaders();

      const { stream: textStream, sources } = await ragService.queryDocumentStream(id, question);

      // Send similarity sources metadata as the first event
      res.write(`event: metadata\ndata: ${JSON.stringify({ sources })}\n\n`);

      // Stream the text chunks as they arrive
      for await (const chunk of textStream) {
        res.write(`event: content\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      // Send end event
      res.write(`event: done\ndata: [DONE]\n\n`);
      res.end();
      return;
    }

    // Non-streaming: wait for full response and return as JSON
    const response = await ragService.queryDocument(id, question);

    res.status(200).json({
      status: 200,
      message: 'Success',
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  queryDocument,
};
