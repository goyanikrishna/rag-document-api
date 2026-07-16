export interface IParsedPage {
  content: string;
  pageNumber: number;
}

export interface IParsedDocument {
  text: string;
  pages: IParsedPage[];
}

export interface IDocumentParser {
  parse(fileBuffer: Buffer): Promise<IParsedDocument>;
}
