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
