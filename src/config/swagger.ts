import { Express, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from '@/config/env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Document Intelligence RAG API',
      version: '1.0.0',
      description:
        'A Document Intelligence API built with Node.js, Express, TypeScript, PostgreSQL + pgvector, and Google Gemini AI.\n\n' +
        '### Key Features:\n' +
        '- **User Authentication**: JWT Register & Login endpoints.\n' +
        '- **Document Ingestion**: Upload PDF (.pdf), Word (.docx, .doc), and Text (.txt) documents per user with processing status lifecycle.\n' +
        '- **Vector Store**: Automatic text chunking and vector embedding generation using Gemini (`text-embedding-004`), stored in PostgreSQL via `pgvector`.\n' +
        '- **Multi-Document RAG Querying**: Search across ALL uploaded files for a user with attribution to document filenames.\n' +
        '- **Streaming & Non-Streaming**: Supports Server-Sent Events (SSE) streaming or JSON output.',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT || 3000}`,
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from /api/auth/register or /api/auth/login.',
        },
      },
      schemas: {
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', example: 'Krishna Goyani' },
            email: { type: 'string', format: 'email', example: 'krishna@example.com' },
            password: { type: 'string', format: 'password', example: 'Password123!' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'krishna@example.com' },
            password: { type: 'string', format: 'password', example: 'Password123!' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            status: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'Login successful.' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      format: 'uuid',
                      example: 'c39a82e1-4567-4e32-a1b2-123456789abc',
                    },
                    name: { type: 'string', example: 'Krishna Goyani' },
                    email: { type: 'string', example: 'krishna@example.com' },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
              },
            },
          },
        },
        DocumentMetadata: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'c39a82e1-4567-4e32-a1b2-123456789abc' },
            user_id: {
              type: 'string',
              format: 'uuid',
              example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
              nullable: true,
            },
            original_name: { type: 'string', example: 'sample_document.pdf' },
            filename: { type: 'string', example: '1712345678-sample_document.pdf' },
            mime_type: { type: 'string', example: 'application/pdf' },
            size: { type: 'integer', example: 1048576 },
            status: {
              type: 'string',
              enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'],
              example: 'READY',
            },
            processed_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2026-09-30T14:51:00.000Z',
            },
            error_message: { type: 'string', nullable: true, example: null },
            uploaded_at: {
              type: 'string',
              format: 'date-time',
              example: '2026-09-30T14:50:00.000Z',
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 45 },
            total_pages: { type: 'integer', example: 3 },
          },
        },
        DocumentListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            status: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'Documents retrieved successfully.' },
            data: {
              type: 'object',
              properties: {
                documents: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DocumentMetadata' },
                },
                pagination: { $ref: '#/components/schemas/PaginationMeta' },
              },
            },
          },
        },
        DocumentSingleResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            status: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'Document retrieved successfully.' },
            data: { $ref: '#/components/schemas/DocumentMetadata' },
          },
        },
        QueryRequest: {
          type: 'object',
          required: ['question'],
          properties: {
            question: {
              type: 'string',
              example: 'What are the main findings across all my uploaded documents?',
              description: 'Natural language question to ask.',
            },
            stream: {
              type: 'boolean',
              default: false,
              example: false,
              description:
                'If set to true, streams response as Server-Sent Events (SSE). Default is false (JSON response).',
            },
          },
        },
        QuerySource: {
          type: 'object',
          properties: {
            document_id: {
              type: 'string',
              format: 'uuid',
              example: 'c39a82e1-4567-4e32-a1b2-123456789abc',
            },
            document_name: { type: 'string', example: 'sales_report_2024.pdf' },
            page_number: { type: 'integer', nullable: true, example: 3 },
            content: {
              type: 'string',
              example: 'Extracted segment text matching the similarity query...',
            },
            similarity: { type: 'number', example: 0.89 },
          },
        },
        QueryResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            status: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'Query processed successfully.' },
            data: {
              type: 'object',
              properties: {
                answer: {
                  type: 'string',
                  example:
                    'According to sales_report_2024.pdf, revenue grew by 15%. According to company_policy.txt, remote work rules apply...',
                },
                sources: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/QuerySource' },
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            status: { type: 'integer', example: 400 },
            message: {
              type: 'string',
              example:
                'Invalid file type. Only PDF (.pdf), DOCX (.docx), and Text (.txt) documents are allowed.',
            },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INVALID_FILE_TYPE' },
              },
            },
          },
        },
      },
    },
    paths: {
      '/api/auth/register': {
        post: {
          summary: 'Register a new user',
          description:
            'Creates a new user account with hashed password and returns a JWT authentication token.',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'User registered successfully.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' },
                },
              },
            },
            '409': {
              description: 'Email already registered.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'Login user',
          description: 'Authenticates a user with email and password, returning a JWT token.',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login successful.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' },
                },
              },
            },
            '401': {
              description: 'Invalid credentials.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/documents/upload': {
        post: {
          summary: 'Upload a document',
          description:
            'Uploads a PDF (.pdf), Word (.docx, .doc), or Text (.txt) file (up to 20MB). Extracts text, chunks content, generates Gemini vector embeddings, and stores document metadata and vectors.',
          tags: ['Documents'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary',
                      description: 'The document file (.pdf, .docx, .doc, .txt) to upload.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Document uploaded and indexed successfully.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DocumentSingleResponse' },
                },
              },
            },
            '400': {
              description: 'Bad Request (No file provided or unsupported file format).',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/documents': {
        get: {
          summary: 'List user documents (Paginated)',
          description:
            'Retrieves metadata for all documents uploaded by the authenticated user with pagination, search, and sorting support.',
          tags: ['Documents'],
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'page',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 1 },
              description: 'Page number (default 1)',
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 20 },
              description: 'Number of items per page (default 20, max 100)',
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Case-insensitive search string for original filename',
            },
            {
              name: 'sort',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['uploaded_at', 'original_name', 'size'],
                default: 'uploaded_at',
              },
              description: 'Field to sort results by',
            },
            {
              name: 'order',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
              description: 'Sort order (asc or desc)',
            },
          ],
          responses: {
            '200': {
              description: 'Paginated list of document metadata.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DocumentListResponse' },
                },
              },
            },
          },
        },
      },
      '/api/documents/query': {
        post: {
          summary: 'Multi-Document Query (Search across ALL user files)',
          description:
            'Queries across ALL uploaded files belonging to the authenticated user. Performs vector similarity search across all documents and generates a grounded AI response. If information is found in multiple documents, facts are attributed to their document filenames.',
          tags: ['RAG Query'],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QueryRequest' },
              },
            },
          },
          responses: {
            '200': {
              description:
                'Multi-document answer generated successfully with document sources & filenames.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/QueryResponse' },
                },
              },
            },
          },
        },
      },
      '/api/documents/{id}/query': {
        post: {
          summary: 'Query a single specific document',
          description: 'Queries a specific document by its UUID.',
          tags: ['RAG Query'],
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Document UUID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QueryRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Answer generated successfully.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/QueryResponse' },
                },
              },
            },
          },
        },
      },
      '/api/documents/{id}': {
        get: {
          summary: 'Get single document metadata',
          description: 'Retrieves metadata for a specific document by its UUID.',
          tags: ['Documents'],
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DocumentSingleResponse' },
                },
              },
            },
          },
        },
        delete: {
          summary: 'Delete a document',
          description: 'Deletes a document by ID and removes its vector embeddings.',
          tags: ['Documents'],
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Document deleted successfully.',
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
