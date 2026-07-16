export const ErrMessages = {
  // document
  noFileProvided: 'No document file was provided in the upload request.',
  documentNotFound: 'Document not found.',
  invalidFileType: 'Invalid file type. Only PDF (.pdf) and DOCX (.docx) files are allowed.',
  unsupportedFileType:
    'Unsupported file type. Only PDF (.pdf) and DOCX (.docx) documents are supported.',
  pdfParseFailed: 'Failed to parse PDF document.',
  docxParseFailed: 'Failed to parse DOCX document.',
  noIndexableText: 'The uploaded document does not contain any indexable text.',

  // rag
  noRelevantContent:
    'No relevant content sections were found in the document to answer the question.',
  notFoundInDocument: "I couldn't find that information in the uploaded document.",
};

export const SuccessMessages = {
  // document
  documentDeleted: 'Document and its vector segments deleted successfully.',
};
