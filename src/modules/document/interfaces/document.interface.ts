export interface ICreateDocumentInput {
  userId?: string;
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

export interface IPreparedChunkInput {
  pageNumber: number;
  content: string;
}

export interface IDocumentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'uploaded_at' | 'original_name' | 'size';
  order?: 'asc' | 'desc';
}

export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface IPaginatedResult<T> {
  items: T[];
  pagination: IPaginationMeta;
}
