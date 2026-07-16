# RAG Document API

A Document Intelligence API built with Node.js, Express, TypeScript, PostgreSQL + pgvector, and Google Gemini AI. Upload PDF or DOCX files and ask natural language questions — the system retrieves the most relevant sections and generates grounded AI answers with page references.

---

## Prerequisites

Make sure the following are installed before setting up the project:

| Tool | Version | Notes |
|---|---|---|
| Node.js | v20+ | [nodejs.org](https://nodejs.org) |
| Yarn | v1.x | `npm install -g yarn` |
| PostgreSQL | v14+ | With `pgvector` extension |
| Google Gemini API Key | — | [ai.google.dev](https://ai.google.dev) |

### Install pgvector extension

After installing PostgreSQL, enable the extension in your database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd rag-document-api
yarn install
```

---

### 2. Create environment file

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/ai_extract?schema=public"

# Google Gemini
GEMINI_API_KEY="your-gemini-api-key-here"
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# File Upload
UPLOAD_PATH="uploads"
MAX_UPLOAD_SIZE=20971520

# Chunking
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K_RESULTS=5
```

> **Required:** `DATABASE_URL` and `GEMINI_API_KEY` — the server will exit on startup if either is missing.

---

### 3. Set up the database

Generate the Prisma client and run migrations:

```bash
# Generate Prisma client
yarn prisma:generate

# Run database migrations
yarn prisma:migrate
```

When prompted for a migration name, enter something like `init`.

---

### 4. Start the development server

```bash
yarn dev
```

The server starts at `http://localhost:3000` with hot reload via `tsx watch`.

---

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | Start development server with hot reload |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Start production server from `dist/server.js` |
| `yarn format` | Format all source files with Prettier |
| `yarn prisma:generate` | Regenerate Prisma client after schema changes |
| `yarn prisma:migrate` | Run pending database migrations |
| `yarn prisma:studio` | Open Prisma Studio (database GUI) |

---

## API Reference

Base URL: `http://localhost:3000/api`

### Documents

#### Upload a document
```
POST /api/documents/upload
Content-Type: multipart/form-data

Body:
  file  →  PDF (.pdf) or DOCX (.docx), max 20MB
```

#### List all documents
```
GET /api/documents
```

#### Get a document
```
GET /api/documents/:id
```

#### Delete a document
```
DELETE /api/documents/:id
```

---

### Query (RAG)

#### Ask a question about a document
```
POST /api/documents/:id/query
Content-Type: application/json

Body:
{
  "question": "What is the contract renewal period?",
  "stream": false   ← optional, omit for streaming (default)
}
```

**Streaming response (default — `stream` omitted or `true`)**

Responses are streamed as Server-Sent Events (SSE):

```
event: metadata
data: {"sources": [{"pageNumber": 3, "content": "...", "similarity": 0.91}]}

event: content
data: {"text": "The contract renewal period is "}

event: content
data: {"text": "30 days before expiry."}

event: done
data: [DONE]
```

**Standard JSON response (`stream: false`)**

```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "answer": "The contract renewal period is 30 days before expiry.",
    "sources": [
      {
        "pageNumber": 3,
        "content": "...",
        "similarity": 0.91
      }
    ]
  }
}
```

---

## Project Structure

```
src/
├── app.ts                          # Express app setup, middleware, routes
├── server.ts                       # HTTP server, graceful shutdown
│
├── config/
│   ├── env.ts                      # Environment variable loading & validation
│   └── logger.ts                   # Winston logger configuration
│
├── database/
│   └── client.ts                   # Prisma client with pg adapter
│
├── common/
│   ├── constants/
│   │   └── app-messages.ts         # Centralized error and success messages
│   ├── errors/
│   │   └── api-error.ts            # Custom APIError class
│   └── middlewares/
│       ├── error-handler.ts        # Global error handler
│       └── file-upload.ts          # Multer upload middleware
│
├── modules/
│   ├── document/
│   │   ├── controllers/            # Request handling
│   │   ├── services/               # Business logic & ingestion pipeline
│   │   ├── repositories/           # Database queries
│   │   ├── validators/             # Joi validation schemas
│   │   ├── interfaces/             # TypeScript interfaces
│   │   └── document.routes.ts      # Route definitions
│   │
│   └── rag/
│       ├── controllers/            # Query request handling
│       ├── services/               # RAG pipeline & chunker
│       ├── repositories/           # Vector similarity search
│       ├── validators/             # Joi validation schemas
│       ├── interfaces/             # TypeScript interfaces
│       └── rag.routes.ts           # Route definitions
│
└── providers/
    ├── embedding/                  # Gemini Embedding API integration
    ├── llm/                        # Gemini LLM integration (generate + stream)
    └── parser/                     # PDF and DOCX parsers + factory
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | LLM model for answer generation |
| `GEMINI_EMBEDDING_MODEL` | No | `gemini-embedding-001` | Model for vector embeddings |
| `UPLOAD_PATH` | No | `uploads` | Local directory for uploaded files |
| `MAX_UPLOAD_SIZE` | No | `20971520` | Max file size in bytes (20MB) |
| `CHUNK_SIZE` | No | `1000` | Characters per document chunk |
| `CHUNK_OVERLAP` | No | `200` | Overlap between adjacent chunks |
| `TOP_K_RESULTS` | No | `5` | Number of chunks retrieved per query |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL + pgvector |
| AI — LLM | Google Gemini (`gemini-2.5-flash`) |
| AI — Embeddings | Google Gemini (`gemini-embedding-001`) |
| File Parsing | pdf-parse (PDF), mammoth (DOCX) |
| Validation | Joi + express-validation |
| Logging | Winston |
| Package Manager | Yarn |

---

## Author

**Krishna Goyani**
