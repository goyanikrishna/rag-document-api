export interface IChunkResult {
  content: string;
  page_number: number;
  chunk_index: number;
}

export interface ISimilarChunkResult {
  content: string;
  page_number: number | null;
  similarity: number;
  document_id?: string;
  document_name?: string;
}

export interface IQueryResponse {
  answer: string;
  sources: {
    document_id?: string;
    document_name?: string;
    page_number: number | null;
    content: string;
    similarity: number;
  }[];
}

export interface IQueryHistoryItemResponse {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  created_at: Date;
}

export interface IQueryHistoryQueryParams {
  document_id?: string;
  page?: number;
  limit?: number;
}

export interface IPaginatedQueryHistoryResponse {
  history: IQueryHistoryItemResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
