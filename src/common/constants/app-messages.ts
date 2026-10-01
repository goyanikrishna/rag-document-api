export const ErrMessages = {
  // ─── Authentication ───────────────────────────────────────────────────────
  invalidCredentials: 'Invalid email or password.',
  emailAlreadyExists: 'An account with this email address already exists.',

  // ─── Authorization ────────────────────────────────────────────────────────
  documentAccessForbidden: 'You do not have permission to access this document.',
  documentQueryForbidden: 'You do not have permission to query this document.',

  // ─── File Upload ─────────────────────────────────────────────────────────
  noFileProvided: 'No document file was provided in the upload request.',
  invalidFileType:
    'Invalid file type. Only PDF (.pdf), DOCX (.docx), and TXT (.txt) files are allowed.',
  unsupportedFileType: 'Unsupported file type. Only PDF, DOCX, and TXT documents are supported.',

  // ─── Document ────────────────────────────────────────────────────────────
  documentNotFound: 'Document not found.',
  pdfParseFailed: 'Failed to parse PDF document.',
  docxParseFailed: 'Failed to parse DOCX document.',
  noIndexableText: 'The uploaded document does not contain any indexable text.',

  // ─── RAG ─────────────────────────────────────────────────────────────────
  noRelevantContent:
    'No relevant content sections were found in the document to answer the question.',
  notFoundInDocument: "I couldn't find that information in the uploaded document.",
  notFoundInUserDocuments: "I couldn't find that information in your uploaded documents.",
};

export const SuccessMessages = {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  userRegistered: 'User registered successfully.',
  loginSuccessful: 'Login successful.',

  // ─── Document ────────────────────────────────────────────────────────────
  documentUploaded: 'Document uploaded and processed successfully.',
  documentsRetrieved: 'Documents retrieved successfully.',
  documentRetrieved: 'Document retrieved successfully.',
  documentDeleted: 'Document and its vector segments deleted successfully.',

  // ─── RAG ─────────────────────────────────────────────────────────────────
  queryProcessed: 'Query processed successfully.',
};
