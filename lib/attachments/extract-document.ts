import { extractText, getDocumentProxy } from "unpdf";

const MAX_DOCUMENT_CHARS = 50_000;

export async function extractPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
  const { text } = await extractText(pdf, { mergePages: true });

  return text.slice(0, MAX_DOCUMENT_CHARS);
}


export async function extractPlainText(file: File): Promise<string> {
  const text = await file.text();
  return text.slice(0, MAX_DOCUMENT_CHARS);
}
