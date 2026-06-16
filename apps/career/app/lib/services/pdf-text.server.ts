import { Buffer } from 'node:buffer';

import PDFParser from 'pdf2json';

export async function extractPdfText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return new Promise<string>((resolve, reject) => {
    const parser = new PDFParser(undefined, true);
    parser.on('pdfParser_dataError', (data) => {
      const error = data instanceof Error ? data : data.parserError;
      reject(error);
    });
    parser.on('pdfParser_dataReady', () => {
      try {
        resolve(parser.getRawTextContent());
      } catch (error) {
        reject(error);
      }
    });
    parser.parseBuffer(buffer);
  });
}
