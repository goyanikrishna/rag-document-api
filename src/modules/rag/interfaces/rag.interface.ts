export interface IChunkResult {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

export interface ISimilarChunkResult {
  content: string;
  pageNumber: number | null;
  similarity: number;
}

export interface IQueryResponse {
  answer: string;
  sources: {
    pageNumber: number | null;
    content: string;
    similarity: number;
  }[];
}
