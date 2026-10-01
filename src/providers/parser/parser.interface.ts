export interface IParsedPage {
  content: string;
  page_number: number;
}

export interface IParsedDocument {
  text: string;
  pages: IParsedPage[];
}

export interface IDocumentParser {
  parse(fileBuffer: Buffer): Promise<IParsedDocument>;
}
