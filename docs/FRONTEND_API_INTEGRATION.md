# Frontend API Integration Guide

This guide is designed for frontend developers integrating with the **Document Intelligence RAG API**.

---

## Quick Reference

- **Base URL**: `http://localhost:3000/api`
- **Interactive Swagger Docs**: `http://localhost:3000/api-docs`
- **OpenAPI JSON Spec**: `http://localhost:3000/api-docs.json`

---

## Key Rules & Naming Conventions

1. **JSON Key Naming**: All API JSON payload and response keys are strictly formatted in **`snake_case`**.
2. **Validation**: All endpoints strictly enforce request validation via Joi. Invalid payloads return HTTP `400 Bad Request` with `error.code: "VALIDATION_ERROR"`.
3. **Enum Values**: Enum fields (such as `sort` query parameter) only accept valid values defined in the contract (`uploaded_at`, `original_name`, `size`).

---

## Authentication Flow

1. Register user via `POST /api/auth/register` or login via `POST /api/auth/login`.
2. Store the returned `token` in secure storage (e.g. `localStorage` or `sessionStorage`).
3. Include the token in all subsequent requests via HTTP Header:
   ```
   Authorization: Bearer <your_token_here>
   ```

---

## Response Formats

### Standard Success Response
All endpoints return a uniform envelope:
```json
{
  "success": true,
  "status": 200,
  "message": "Documents retrieved successfully.",
  "data": { ... }
}
```

### Standard Error Response
All non-streaming error responses return a uniform error envelope:
```json
{
  "success": false,
  "status": 400,
  "message": "Invalid file type.",
  "error": {
    "code": "INVALID_FILE_TYPE"
  }
}
```

---

## Pagination & Search Guide (`GET /api/documents`)

When listing documents, frontend developers can pass pagination, search, and sorting query parameters:

```http
GET /api/documents?page=1&limit=20&search=report&sort=uploaded_at&order=desc
```

### Parameters:
- `page` (number, default: `1`): Current page number.
- `limit` (number, default: `20`, max: `100`): Documents per page.
- `search` (string, optional): Search string matched against original filename.
- `sort` (string enum: `uploaded_at`, `original_name`, `size`, default: `uploaded_at`): Field to sort by.
- `order` (string enum: `asc`, `desc`, default: `desc`): Sort direction.

### Response Data Structure:
```json
{
  "success": true,
  "status": 200,
  "message": "Documents retrieved successfully.",
  "data": {
    "documents": [
      {
        "id": "c39a82e1-4567-4e32-a1b2-123456789abc",
        "user_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        "original_name": "q3_report.pdf",
        "filename": "1712345678-q3_report.pdf",
        "mime_type": "application/pdf",
        "size": 1048576,
        "status": "READY",
        "processed_at": "2026-10-01T05:01:00.000Z",
        "error_message": null,
        "uploaded_at": "2026-10-01T05:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "total_pages": 3
    }
  }
}
```

---

## SSE Streaming Integration Example (EventSource / fetch)

To stream LLM responses in real-time (`stream: true`):

```javascript
async function queryWithStreaming(question, documentId = null) {
  const url = documentId
    ? `http://localhost:3000/api/documents/${documentId}/query`
    : `http://localhost:3000/api/documents/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ question, stream: true })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n\n');

    for (const line of lines) {
      if (line.startsWith('event: metadata')) {
        const metadata = JSON.parse(line.replace('event: metadata\ndata: ', ''));
        console.log('Sources:', metadata.sources);
      } else if (line.startsWith('event: content')) {
        const content = JSON.parse(line.replace('event: content\ndata: ', ''));
        process.stdout.write(content.text);
      } else if (line.startsWith('event: error')) {
        const error = JSON.parse(line.replace('event: error\ndata: ', ''));
        console.error('Stream Error:', error.message);
      } else if (line.includes('[DONE]')) {
        console.log('\n--- Stream Complete ---');
      }
    }
  }
}
```
