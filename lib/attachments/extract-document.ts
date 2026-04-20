const MAX_DOCUMENT_CHARS = 50_000;

export async function extractPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({ disableNormalization: false });

    let pageText = "";
    let lastY: number | null = null;

    for (const item of content.items) {
      if ("str" in item) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += "\n";
        }
        pageText += item.str;
        lastY = item.transform[5];
      }
    }

    pageTexts.push(pageText.trim());
  }

  const fullText = pageTexts.join("\n\n");
  return fullText.slice(0, MAX_DOCUMENT_CHARS);
}

export async function extractPlainText(file: File): Promise<string> {
  const text = await file.text();
  return text.slice(0, MAX_DOCUMENT_CHARS);
}
