import { IDocumentParser, IParsedDocument } from './parser.interface';

/**
 * Plain Text (.txt) File Parser
 */
class TxtParser implements IDocumentParser {
  async parse(fileBuffer: Buffer): Promise<IParsedDocument> {
    const textContent = fileBuffer.toString('utf-8');

    return {
      text: textContent,
      pages: [
        {
          page_number: 1,
          content: textContent,
        },
      ],
    };
  }
}

export default new TxtParser();
