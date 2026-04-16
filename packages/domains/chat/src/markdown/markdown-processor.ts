import {
  MarkdownTextSplitter,
  type RecursiveCharacterTextSplitterParams,
} from '@langchain/textsplitters';

export interface Document<Metadata extends Record<string, unknown> = Record<string, unknown>> {
  pageContent: string;
  metadata: Metadata;
}

export async function splitMarkdown(
  content: string,
  options?: Partial<RecursiveCharacterTextSplitterParams>,
): Promise<Document[]> {
  const splitter = MarkdownTextSplitter.fromLanguage('markdown', {
    chunkSize: 512,
    chunkOverlap: 50,
    ...options,
  });
  return await splitter.createDocuments([content]);
}
