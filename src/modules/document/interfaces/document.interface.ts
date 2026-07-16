export interface ICreateDocumentInput {
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ICreateChunkInput {
  documentId: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  embedding: number[];
}
