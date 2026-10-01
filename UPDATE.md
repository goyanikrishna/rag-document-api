Hi,

Following are the updates for AI-Extract Backend (Project Implementation).

Total Development Effort: (08:45 Hrs)

1. Project Initialization
----------------------------------------------------------------------
- Set up Node.js + TypeScript project with Express, Prettier using Yarn and @/* path aliases for clean imports.
- Environment variables loaded via dotenv and validated with a Joi schema before the server starts.
- Built a Winston-based logger with 5 levels and colorized console output for development.
- Database connected via Prisma using a pg driver adapter for PostgreSQL with pgvector enabled.
- Defined two schema models — Document and DocumentChunk — with proper relations and indexes.
- Standard middleware stack (body parsing, request logging, CORS) with routes handler and global error handler.
- Centralized all error/success messages into a single constants file for consistency.
- Implemented a global error handler — catches validation errors and generic errors.
- Built the upload API: file validation (type, extension, size) via Multer, text extraction via PDF/DOCX parsers, chunking with sliding-window overlap, batch embedding generation via Gemini, and transactional DB insert with rollback on failure.
- Manage validation, and validate via express-validation.
- Built the query API: input validation, parallel document lookup + question embedding, pgvector cosine similarity search for top matching chunks, prompt assembly with source labels, and grounded response generation via Gemini.

----------------------------------------------------------------------
2. Schema Definition
----------------------------------------------------------------------
- Two models defined: Document and DocumentChunk.
- Standard middleware stack (JSON/URL parsing, request logging, CORS) followed by document and RAG routes mounted under /api/documents.
- Unmatched routes are caught by a 404 handler that forwards a structured error with the method and path.
- Global error handler registered last to catch everything passed via next().

----------------------------------------------------------------------
3. Upload API — Full Flow
----------------------------------------------------------------------
Route: POST /api/documents/upload
File: src/modules/document/document.routes.ts
Middleware chain: uploadMiddleware.single('file') → documentController.uploadDocument

Step 1 — Multer middleware (src/common/middlewares/file-upload.ts):
- Checks UPLOAD_DIR exists on startup; creates it recursively if not.
- Disk storage: saves file to UPLOAD_DIR with filename = timestamp + random 9-digit number + sanitized originalname (only alphanumeric and dots kept).
- fileFilter: validates MIME type against [application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document] AND extension against [.pdf, .docx]. Rejects with APIError(400) if either check fails.
- File size limit: env.MAX_UPLOAD_SIZE (default 20MB). Multer throws if exceeded.

Step 2 — Controller (src/modules/document/controllers/document.controller.ts):
- uploadDocument checks req.file — throws APIError(400, ErrMessages.noFileProvided) if missing.
- Calls documentService.uploadAndProcess(req.file).
- Returns 201 with document metadata: id, originalName, filename, mimeType, size, uploadedAt.

Step 3 — Service: uploadAndProcess (src/modules/document/services/document.service.ts):
- Reads file buffer from disk (file.buffer || fs.readFileSync(file.path)).
- Calls parserFactory.getParser(file.mimetype) to resolve the correct parser.
- Parser returns { pages: [{ content, pageNumber }] }.
- Saves Document record to DB via documentRepository.create().
- Loops through each page, calls chunkerService.splitPageText(content, pageNumber, globalIndex).
- If total chunks === 0, throws APIError(400, ErrMessages.noIndexableText) and rolls back the document record.
- Calls embeddingProvider.generateEmbeddings(allChunkTexts) — batches all chunk texts in one API call.
- Calls documentRepository.createChunksWithEmbeddings(chunks) — inserts all chunks in a single Prisma $transaction.
- If any step after document creation fails, the document DB record is deleted in the catch block (manual rollback).

Step 4 — Parser Factory (src/providers/parser/parser-factory.ts):
- getParser(mimeType) switches on MIME type and returns pdfParser or docxParser.
- Throws APIError(400) for any unrecognized MIME type.

Step 5 — Chunker (src/modules/rag/services/chunker.service.ts):
- cleanText() normalizes CRLF → LF, collapses multiple spaces and blank lines.
- splitPageText(): if cleaned text length ≤ CHUNK_SIZE, returns single chunk.
- Otherwise, sliding window: moves start forward by (chunkSize - chunkOverlap) each iteration.
- End boundary adjusted backward up to 20% of chunk size to avoid splitting mid-word.
- Safety break if start or end exceeds text length.

Step 6 — Embedding (src/providers/embedding/langchain-gemini-embeddings-provider.ts):
- generateEmbeddings(): calls model.batchEmbedContents() with all chunk texts.
- outputDimensionality: 768 specified per request (as any cast due to SDK typing).
- Returns array of number[] — one 768-float array per chunk.

Step 7 — Repository insert (src/modules/document/repositories/document.repository.ts):
- createChunksWithEmbeddings(): runs inside prisma.$transaction([...]).
- Each chunk uses prisma.$executeRaw with CAST(${JSON.stringify(embedding)} AS vector) to write pgvector data (Prisma ORM does not natively support the vector type).
- Each chunk gets a fresh uuidv4() as its id.

----------------------------------------------------------------------
8. Query API — Full Flow
----------------------------------------------------------------------
Route: POST /api/documents/:id/query
File: src/modules/rag/rag.routes.ts
Middleware chain: validate(ragParams.queryDocument) → ragController.queryDocument

Step 1 — Validation (src/modules/rag/validators/rag.validator.ts):
- params: id must be a valid UUID string (required).
- body.question: string, trimmed, min 1 char, max 500 chars, required.
- body.stream: boolean, optional. Absence defaults to streaming on.

Step 2 — Controller (src/modules/rag/controllers/rag.controller.ts):
- Reads id from req.params and { question, stream } from req.body.
- If stream !== false → SSE streaming path.
- If stream === false → blocking JSON path.

Streaming path (stream !== false, default):
- Sets headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive, X-Accel-Buffering: no.
- Calls res.flushHeaders() to open the SSE connection immediately.
- Calls ragService.queryDocumentStream(id, question).
- Writes event: metadata with JSON-stringified sources before streaming starts.
- Iterates async generator from LLM, writes event: content for each text chunk.
- Writes event: done with [DONE], then calls res.end().

Blocking path (stream: false):
- Calls ragService.queryDocument(id, question).
- Returns 200 with { status, message, data: { answer, sources } }.

Step 3 — RAG Service (src/modules/rag/services/rag.service.ts):
Both queryDocument and queryDocumentStream run Steps A and B in parallel via Promise.all:
  A. documentRepository.findById(id) — verifies document exists.
  B. embeddingProvider.generateEmbedding(question) — embeds the question.
- If document not found, throws APIError(404, ErrMessages.documentNotFound).
- Calls ragRepository.findSimilarChunks(id, queryEmbedding, TOP_K_RESULTS).
- If no chunks returned, returns fallback answer: ErrMessages.notFoundInDocument with empty sources.
- buildPrompt() assembles context string with [Chunk N | Source: Page X] labels and appends the user question.
- For non-streaming: llmProvider.generateResponse(prompt, SYSTEM_INSTRUCTION) → returns full text.
- For streaming: llmProvider.generateResponseStream(prompt, SYSTEM_INSTRUCTION) → returns AsyncGenerator<string>.

Step 4 — Vector Search (src/modules/rag/repositories/rag.repository.ts):
- findSimilarChunks() runs a raw SQL query using pgvector cosine distance operator (<=>).
- Similarity score: 1.0 - (embedding <=> query_vector) → 1.0 = perfect match.
- Filtered by document_id, ordered by distance ASC, limited to TOP_K_RESULTS rows.

Step 5 — LLM (src/providers/llm/gemini-provider.ts):
- generateResponse(): calls model.generateContent(prompt) — waits for full response.
- generateResponseStream(): calls model.generateContentStream(prompt) — returns an AsyncGenerator that yields text chunks as they arrive from Gemini.
- Both use env.GEMINI_MODEL as the model name and pass SYSTEM_INSTRUCTION as systemInstruction.

----------------------------------------------------------------------
9. Global Error Handler (src/common/middlewares/error-handler.ts)
----------------------------------------------------------------------
- Registered as the last middleware in app.ts — only called when next(error) is invoked.
- If res.headersSent is true, delegates to Express default (avoids double-response crash).
- Step 1: If error is ExpressValidationError (from express-validation) — flattens all field-level detail messages into a single comma-separated string, wraps into APIError(400, isPublic: true).
- Step 2: If error is a generic Error (not already an APIError) — wraps into APIError(500, isPublic: false).
- Extracts statusCode from error.status or defaults to 500.
- Logging: statusCode >= 500 → logger.error with stack trace. statusCode < 500 → logger.warn with message only.
- Response message: if isPublic and status !== 500 → send error.message. Otherwise → send generic HTTP status text (e.g. "Internal Server Error").
- Response body: { status, message } — no stack trace, no internal details, no field-level errors exposed.

----------------------------------------------------------------------
10. Centralized Messages (src/common/constants/app-messages.ts)
----------------------------------------------------------------------
ErrMessages:
- noFileProvided — triggered when req.file is missing after multer
- documentNotFound — 404 on missing document by ID
- invalidFileType / unsupportedFileType — file type rejection messages
- pdfParseFailed / docxParseFailed — parser failure messages
- noIndexableText — document produced zero chunks
- noRelevantContent — no chunks retrieved from similarity search
- notFoundInDocument — LLM fallback when no chunks returned

SuccessMessages:
- documentDeleted — returned in data on successful delete

----------------------------------------------------------------------
11. Code Quality
----------------------------------------------------------------------
- All console.log debug statements removed from the RAG pipeline.
- APIError cleaned up — removed isError and errors properties that were defined but never read anywhere in the codebase.
- Prisma query logger line commented out (can be re-enabled for debugging).
- All files pass Prettier formatting.
- TypeScript build (tsc && tsc-alias) completes with zero errors.