# API SOURCE OF TRUTH

This document is the **single authoritative contract** for all endpoints in the Document Intelligence RAG API.

---

## Key Conventions & Rules

1. **JSON Property Naming**: All API JSON request and response field names are strictly `snake_case`.
2. **Validation**: All endpoints strictly enforce request payload, URL parameter, and query parameter validation using Joi schemas.
3. **Enum Enforcement**: Any field supporting an enum (e.g. `sort`, `order`, `status`, `mime_type`) is strictly validated against permitted enum values.

---

## Standard Response Format

### Success Response Structure
```json
{
  "success": true,
  "status": 200,
  "message": "Human readable success message.",
  "data": { ... }
}
```

### Error Response Structure
```json
{
  "success": false,
  "status": 400,
  "message": "Human readable error message.",
  "error": {
    "code": "ERROR_CODE_STRING"
  }
}
```

---

## Authentication & Authorization

All endpoints except `/api/auth/register` and `/api/auth/login` require HTTP Bearer Authentication header:

```http
Authorization: Bearer <your_jwt_token>
```

---

## Error Codes Catalog

| Error Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body, parameter, or query parameter validation failed |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `EMAIL_ALREADY_EXISTS` | 409 | User with this email already registered |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid Authorization header |
| `INVALID_TOKEN` | 401 | Expired or unparseable JWT token |
| `FORBIDDEN` | 403 | Attempted to access a resource owned by another user |
| `NO_FILE_PROVIDED` | 400 | Upload request missing `file` multipart field |
| `INVALID_FILE_TYPE` | 400 | Extension or MIME type not supported |
| `NO_INDEXABLE_TEXT` | 400 | Uploaded file contains no parseable text |
| `DOCUMENT_NOT_FOUND` | 404 | Document ID does not exist |
| `NO_RELEVANT_CONTENT` | 200 / 404 | Vector similarity search returned no results |

---

## Complete Endpoints Catalog

### 1. Authentication

#### `POST /api/auth/register`
- **Auth**: Public
- **Validation Rules**: `name` (required, string, 2-100 chars), `email` (required, valid email), `password` (required, string, 6-128 chars)
- **Request Body**:
  ```json
  {
    "name": "Krishna Goyani",
    "email": "krishna@example.com",
    "password": "Password123!"
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "success": true,
    "status": 201,
    "message": "User registered successfully.",
    "data": {
      "user": {
        "id": "uuid",
        "name": "Krishna Goyani",
        "email": "krishna@example.com",
        "created_at": "2026-10-01T05:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### `POST /api/auth/login`
- **Auth**: Public
- **Validation Rules**: `email` (required, valid email), `password` (required, string)
- **Request Body**:
  ```json
  {
    "email": "krishna@example.com",
    "password": "Password123!"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "status": 200,
    "message": "Login successful.",
    "data": {
      "user": {
        "id": "uuid",
        "name": "Krishna Goyani",
        "email": "krishna@example.com",
        "created_at": "2026-10-01T05:00:00.000Z"
      },
      "token": "JWT_STRING"
    }
  }
  ```

---

### 2. Document Management

#### `POST /api/documents/upload`
- **Auth**: Bearer Token (Required)
- **Content-Type**: `multipart/form-data`
- **Form Data Field**: `file` (Required, PDF/DOCX/DOC/TXT, max 20MB)
- **Success Response (201)**:
  ```json
  {
    "success": true,
    "status": 201,
    "message": "Document uploaded and processed successfully.",
    "data": {
      "id": "uuid",
      "user_id": "uuid",
      "original_name": "sample.pdf",
      "filename": "1712345678-sample.pdf",
      "mime_type": "application/pdf",
      "size": 1048576,
      "status": "READY",
      "processed_at": "2026-10-01T05:00:05.000Z",
      "error_message": null,
      "uploaded_at": "2026-10-01T05:00:00.000Z"
    }
  }
  ```

#### `GET /api/documents`
- **Auth**: Bearer Token (Required)
- **Validation / Query Parameters**:
  - `page`: integer (min 1, default 1)
  - `limit`: integer (min 1, max 100, default 20)
  - `search`: string (optional)
  - `sort`: enum (`uploaded_at`, `original_name`, `size`, default `uploaded_at`)
  - `order`: enum (`asc`, `desc`, default `desc`)
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "status": 200,
    "message": "Documents retrieved successfully.",
    "data": {
      "documents": [
        {
          "id": "uuid",
          "user_id": "uuid",
          "original_name": "sample.pdf",
          "filename": "1712345678-sample.pdf",
          "mime_type": "application/pdf",
          "size": 1048576,
          "status": "READY",
          "processed_at": "2026-10-01T05:00:05.000Z",
          "error_message": null,
          "uploaded_at": "2026-10-01T05:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "total_pages": 1
      }
    }
  }
  ```

#### `GET /api/documents/:id`
- **Auth**: Bearer Token (Required — ownership checked)
- **Validation Rules**: `id` (required, valid UUID)
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "status": 200,
    "message": "Document retrieved successfully.",
    "data": {
      "id": "uuid",
      "user_id": "uuid",
      "original_name": "sample.pdf",
      "filename": "1712345678-sample.pdf",
      "mime_type": "application/pdf",
      "size": 1048576,
      "status": "READY",
      "processed_at": "2026-10-01T05:00:05.000Z",
      "error_message": null,
      "uploaded_at": "2026-10-01T05:00:00.000Z"
    }
  }
  ```

#### `DELETE /api/documents/:id`
- **Auth**: Bearer Token (Required — ownership checked)
- **Validation Rules**: `id` (required, valid UUID)
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "status": 200,
    "message": "Document and its vector segments deleted successfully.",
    "data": null
  }
  ```

---

### 3. RAG Q&A Querying

#### `POST /api/documents/query` (Global Search Across All User Files)
- **Auth**: Bearer Token (Required)
- **Validation Rules**: `question` (required, string, 1-1000 chars), `stream` (optional boolean, default `false`)
- **Request Body**:
  ```json
  {
    "question": "What is our Q3 financial performance?",
    "stream": false
  }
  ```
- **Success Response (200 - Non-streaming)**:
  ```json
  {
    "success": true,
    "status": 200,
    "message": "Query processed successfully.",
    "data": {
      "answer": "According to financial_q3.pdf, revenue grew by 18%...",
      "sources": [
        {
          "document_id": "uuid",
          "document_name": "financial_q3.pdf",
          "page_number": 2,
          "content": "Q3 revenue grew by 18% compared to Q2...",
          "similarity": 0.88
        }
      ]
    }
  }
  ```

#### `POST /api/documents/:id/query` (Single Document Query)
- **Auth**: Bearer Token (Required — ownership checked)
- **Validation Rules**: `id` (required, valid UUID), `question` (required, string, 1-1000 chars), `stream` (optional boolean, default `false`)
- **Request Body**:
  ```json
  {
    "question": "What are the key terms in this agreement?",
    "stream": false
  }
  ```
- **Success Response (200 - Non-streaming)**:
  ```json
  {
    "success": true,
    "status": 200,
    "message": "Query processed successfully.",
    "data": {
      "answer": "The key terms include...",
      "sources": [ ... ]
    }
  }
  ```

---

## Server-Sent Events (SSE) Streaming Protocol

When `stream: true` is sent in `POST /api/documents/query` or `POST /api/documents/:id/query`:

Response header: `Content-Type: text/event-stream`

### SSE Event Stream Sequence:
```
event: metadata
data: {"sources":[{"document_id":"uuid","document_name":"doc.pdf","page_number":1,"content":"...","similarity":0.85}]}

event: content
data: {"text":"According to "}

event: content
data: {"text":"doc.pdf..."}

event: done
data: [DONE]
```

If an error occurs mid-stream:
```
event: error
data: {"message":"Human-readable error description"}
```
