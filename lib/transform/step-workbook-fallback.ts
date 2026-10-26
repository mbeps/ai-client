import * as xlsx from "xlsx";
import { getLogger } from "@/lib/logger";
import type { AttachmentRow } from "@/lib/transform/build-file-context";
import { extractDownloadFilePayload } from "@/lib/transform/extract-download-file-payload";
import { persistTransformArtifact } from "@/lib/transform/persist-artifact";

const log = getLogger(["app", "transform", "steps"]);

/**
 * Builds spreadsheet artifact structure from base64 workbook content.
 * @author Maruf Bepary
 */
function buildWorkbookFallbackArtifact(
  fileContent: string,
  stepIndex: number,
  stepName: string,
  attachmentName: string,
  runId: string,
): Record<string, unknown> | null {
  try {
    const buf = Buffer.from(fileContent, "base64");
    const wb = xlsx.read(buf, { type: "buffer" });
    const sheets = wb.SheetNames.map((name) => {
      const rawData = xlsx.utils.sheet_to_json(wb.Sheets[name], {
        header: 1,
      }) as any[][];
      return { name, data: rawData.slice(0, 500) };
    });
    return {
      id: `step-${stepIndex}-wb`,
      type: "spreadsheet",
      title: `${stepName} - ${attachmentName}`,
      content: JSON.stringify({ sheets }),
      messageId: `step-${stepIndex}`,
    };
  } catch (parseErr) {
    log.warn(
      "Failed to build spreadsheet artifact from downloaded workbook (runId: {runId}, stepIndex: {stepIndex}): {error}",
      {
        runId,
        stepIndex,
        error: (parseErr as Error).message,
      },
    );
    return null;
  }
}

function isStepToolExecutable(
  name: string,
  runToolSourceMap: Record<string, string>,
  stepServerNames: Set<string>,
  runMcpTools: Record<string, any>,
): boolean {
  const src = runToolSourceMap[name];
  return Boolean(
    src &&
      stepServerNames.has(src) &&
      typeof runMcpTools[name]?.execute === "function",
  );
}

/**
 * Finds the first allowed and callable MCP download tool matching preferred names or regex.
 * @author Maruf Bepary
 */
function resolveStepDownloadToolName(
  runToolSourceMap: Record<string, string>,
  stepServerNames: Set<string>,
  runMcpTools: Record<string, any>,
): string | null {
  const preferred = [
    "download_file",
    "download",
    "get_file",
    "export_file",
    "read_file",
    "get_file_content",
    "fetch_file",
  ];

  for (const name of preferred) {
    if (
      isStepToolExecutable(name, runToolSourceMap, stepServerNames, runMcpTools)
    ) {
      return name;
    }
  }

  for (const name of Object.keys(runMcpTools)) {
    if (
      /download|export|get_file/i.test(name) &&
      isStepToolExecutable(name, runToolSourceMap, stepServerNames, runMcpTools)
    ) {
      return name;
    }
  }

  return null;
}

/**
 * Invokes download MCP tool and persists returned workbook file.
 * @author Maruf Bepary
 */
async function executeWorkbookDownloadFallback(
  currentWorkbookPath: string,
  stepIndex: number,
  stepName: string,
  userId: string,
  runId: string,
  defaultFilename: string,
  runMcpTools: Record<string, any>,
  runToolSourceMap: Record<string, string>,
  stepServerNames: Set<string>,
) {
  const downloadToolName = resolveStepDownloadToolName(
    runToolSourceMap,
    stepServerNames,
    runMcpTools,
  );
  if (!downloadToolName) {
    return null;
  }

  const downloadTool = runMcpTools[downloadToolName] as {
    execute: (args: Record<string, string>) => Promise<unknown>;
  };

  try {
    const downloaded = await downloadTool.execute({
      file_path: currentWorkbookPath,
      path: currentWorkbookPath,
    });
    const downloadPayload = extractDownloadFilePayload(downloaded);
    if (!downloadPayload) return null;

    const persisted = await persistTransformArtifact(
      {
        kind: "download",
        fileContent: downloadPayload.fileContent,
        filename: downloadPayload.filename || defaultFilename,
        stepIndex,
      },
      userId,
      runId,
    );

    if (!persisted) return null;

    const fallbackArtifact = buildWorkbookFallbackArtifact(
      downloadPayload.fileContent,
      stepIndex,
      stepName,
      persisted.attachmentRow.name,
      runId,
    );

    log.info(
      "Persisted step output from download_file fallback (runId: {runId}, stepIndex: {stepIndex})",
      { runId, stepIndex, userId },
    );

    return { persisted, fallbackArtifact };
  } catch (downloadErr) {
    log.warn(
      "download_file fallback persistence failed (runId: {runId}, stepIndex: {stepIndex})",
      {
        error:
          downloadErr instanceof Error
            ? downloadErr.message
            : String(downloadErr),
        runId,
        stepIndex,
        userId,
      },
    );
    return null;
  }
}

/**
 * Invokes download fallback when active workbook path exists.
 * @author Maruf Bepary
 */
async function tryDownloadFallback(
  currentWorkbookPath: string | null,
  stepIndex: number,
  stepName: string,
  userId: string,
  runId: string,
  defaultFilename: string,
  runMcpTools: Record<string, any>,
  runToolSourceMap: Record<string, string>,
  stepServerNames: Set<string>,
) {
  if (!currentWorkbookPath) {
    return null;
  }

  return executeWorkbookDownloadFallback(
    currentWorkbookPath,
    stepIndex,
    stepName,
    userId,
    runId,
    defaultFilename,
    runMcpTools,
    runToolSourceMap,
    stepServerNames,
  );
}

export interface ApplyDownloadFallbackParams {
  shouldTry: boolean;
  currentWorkbookPath: string | null;
  stepIndex: number;
  stepName: string;
  userId: string;
  runId: string;
  defaultFilename: string;
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  stepServerNames: Set<string>;
  currentOutputIds: string[];
  artifact: Record<string, unknown> | null;
  applyPersistedOutput: (
    persisted: { attachmentRow: AttachmentRow; outputAttachmentIds: string[] },
    currentOutputIds: string[],
  ) => {
    currentOutputIds: string[];
    currentRows: AttachmentRow[];
    stepOutputAttachmentId: string;
  };
}

/**
 * Executes fallback download when mutations occurred without explicit manage_artifact persistence.
 * @author Maruf Bepary
 */
export async function applyDownloadFallbackIfMutated(
  params: ApplyDownloadFallbackParams,
): Promise<{
  currentOutputIds: string[];
  currentRows: AttachmentRow[];
  stepOutputAttachmentId: string;
  artifact: Record<string, unknown> | null;
} | null> {
  if (!params.shouldTry) {
    return null;
  }

  const fallback = await tryDownloadFallback(
    params.currentWorkbookPath,
    params.stepIndex,
    params.stepName,
    params.userId,
    params.runId,
    params.defaultFilename,
    params.runMcpTools,
    params.runToolSourceMap,
    params.stepServerNames,
  );

  if (!fallback) return null;

  const applied = params.applyPersistedOutput(
    fallback.persisted,
    params.currentOutputIds,
  );

  return {
    ...applied,
    artifact:
      !params.artifact && fallback.fallbackArtifact
        ? fallback.fallbackArtifact
        : params.artifact,
  };
}
