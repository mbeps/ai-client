const GENERATIVE_UI_LANGS = new Set(["spec", "ui"]);

interface FenceSpan {
  lang: string;
  startLine: number;
  endLine: number | null;
}

interface ActiveFence {
  char: string;
  length: number;
  lang: string;
  startLine: number;
}

const OPEN_FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const CLOSE_FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

function isGenerativeUiLang(lang: string): boolean {
  return GENERATIVE_UI_LANGS.has(lang);
}

/**
 * Scans top-level CommonMark fenced code blocks, tracking fence character and
 * backtick/tilde length so nested fences (e.g. ```spec inside ````markdown)
 * are treated as literal content rather than top-level UI blocks.
 */
function scanTopLevelFences(lines: string[]): FenceSpan[] {
  const spans: FenceSpan[] = [];
  let active: ActiveFence | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (active !== null) {
      const closeMatch = CLOSE_FENCE_RE.exec(line);
      if (
        closeMatch &&
        closeMatch[1][0] === active.char &&
        closeMatch[1].length >= active.length
      ) {
        spans.push({
          lang: active.lang,
          startLine: active.startLine,
          endLine: i,
        });
        active = null;
      }
      continue;
    }

    const openMatch = OPEN_FENCE_RE.exec(line);
    if (!openMatch) {
      continue;
    }

    const fence = openMatch[1];
    const info = openMatch[2];
    if (fence[0] === "`" && info.includes("`")) {
      continue;
    }

    const lang = info.trim().split(/\s+/)[0].toLowerCase();
    active = {
      char: fence[0],
      length: fence.length,
      lang,
      startLine: i,
    };
  }

  if (active !== null) {
    spans.push({
      lang: active.lang,
      startLine: active.startLine,
      endLine: null,
    });
  }

  return spans;
}

/**
 * Returns true if `content` contains any top-level ```` ```spec ```` or ```` ```ui ```` fence.
 */
export function hasGenerativeUIBlocks(content: string): boolean {
  const spans = scanTopLevelFences(content.split("\n"));
  return spans.some((span) => isGenerativeUiLang(span.lang));
}

/**
 * Returns true only when the final open fence in `content` is an unclosed
 * top-level `spec` or `ui` fence (used to show a streaming skeleton).
 */
export function hasUnclosedGenerativeUIFence(content: string): boolean {
  const spans = scanTopLevelFences(content.split("\n"));
  const last = spans.at(-1);
  return (
    last !== undefined && last.endLine === null && isGenerativeUiLang(last.lang)
  );
}

export interface TrailingUnclosedGenerativeUIFence {
  /** 1-based line number of the opening fence, matching mdast/hast `node.position.start.line`. */
  startLine: number;
  body: string;
}

/**
 * Returns the 1-based opening line and raw body of the trailing unclosed top-level
 * `spec` or `ui` fence, or `null` when no such unclosed trailing fence exists.
 */
export function getTrailingUnclosedGenerativeUIFence(
  content: string,
): TrailingUnclosedGenerativeUIFence | null {
  const lines = content.split("\n");
  const last = scanTopLevelFences(lines).at(-1);
  if (!last || last.endLine !== null || !isGenerativeUiLang(last.lang)) {
    return null;
  }
  return {
    startLine: last.startLine + 1,
    body: lines
      .slice(last.startLine + 1)
      .join("\n")
      .replace(/\n$/, ""),
  };
}

/**
 * Replaces top-level `spec` and `ui` fenced blocks with `[Interactive UI omitted]`
 * so copying a chat message or Markdown artifact yields clean readable prose.
 */
export function prepareMarkdownForCopy(content: string): {
  text: string;
  hadInteractiveUI: boolean;
} {
  const lines = content.split("\n");
  const uiSpans = scanTopLevelFences(lines).filter((span) =>
    isGenerativeUiLang(span.lang),
  );

  if (uiSpans.length === 0) {
    return { text: content, hadInteractiveUI: false };
  }

  const out: string[] = [];
  let spanIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const currentSpan = uiSpans[spanIdx];
    if (currentSpan && i === currentSpan.startLine) {
      out.push("[Interactive UI omitted]");
      i = currentSpan.endLine ?? lines.length - 1;
      spanIdx++;
      continue;
    }
    out.push(lines[i]);
  }

  return {
    text: out.join("\n"),
    hadInteractiveUI: true,
  };
}
