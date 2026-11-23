import * as xlsx from "xlsx";
import { getLogger } from "@/lib/logger";
import type { AttachmentRow } from "@/lib/workflows/build-file-context";
import { extractDownloadFilePayload } from "@/lib/workflows/extract-download-file-payload";
import { persistWorkflowArtifact } from "@/lib/workflows/persist-artifact";

const log = getLogger(["app", "workflows", "workbook-fallback"]);

function buildWorkbookFallbackArtifact(
  fileContent: string,
  stepIndex: number,
  stepName: string,
  attachmentName: string,
): Record<string, unknown> | null {
  try {
    const buf = Buffer.from(fileContent, "base64");
    const wb = xlsx.read(buf, { type: "buffer" });
    const sheets = wb.SheetNames.map((name) => {
      const rawData = xlsx.utils.sheet_to_json(wb.Sheets[name], {
        header: 1,
      }) as unknown[][];
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
    log.warn("Failed to build spreadsheet artifact from downloaded workbook", {
      stepIndex,
      error: (parseErr as Error).message,
    });
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

/** Parameters for `applyDownloadFallbackIfMutated`. */
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
 * Executes fallback download when spreadsheet mutations occurred without explicit `manage_artifact` persistence.
 */
export async function applyDownloadFallbackIfMutated(
  params: ApplyDownloadFallbackParams,
): Promise<{
  currentOutputIds: string[];
  currentRows: AttachmentRow[];
  stepOutputAttachmentId: string;
  artifact: Record<string, unknown> | null;
} | null> {
  if (!params.shouldTry || !params.currentWorkbookPath) {
    return null;
  }

  const downloadToolName = resolveStepDownloadToolName(
    params.runToolSourceMap,
    params.stepServerNames,
    params.runMcpTools,
  );
  if (!downloadToolName) return null;

  const downloadTool = params.runMcpTools[downloadToolName] as {
    execute: (args: Record<string, string>) => Promise<unknown>;
  };

  try {
    const downloaded = await downloadTool.execute({
      file_path: params.currentWorkbookPath,
      path: params.currentWorkbookPath,
    });
    const downloadPayload = extractDownloadFilePayload(downloaded);
    if (!downloadPayload) return null;

    const persisted = await persistWorkflowArtifact(
      {
        kind: "download",
        fileContent: downloadPayload.fileContent,
        filename: downloadPayload.filename || params.defaultFilename,
        stepIndex: params.stepIndex,
      },
      params.userId,
      params.runId,
    );
    if (!persisted) return null;

    const fallbackArtifact = buildWorkbookFallbackArtifact(
      downloadPayload.fileContent,
      params.stepIndex,
      params.stepName,
      persisted.attachmentRow.name,
    );

    const applied = params.applyPersistedOutput(
      persisted,
      params.currentOutputIds,
    );

    return {
      ...applied,
      artifact:
        !params.artifact && fallbackArtifact
          ? fallbackArtifact
          : params.artifact,
    };
  } catch (downloadErr) {
    log.warn("download_file fallback persistence failed", {
      runId: params.runId,
      stepIndex: params.stepIndex,
      error:
        downloadErr instanceof Error
          ? downloadErr.message
          : String(downloadErr),
    });
    return null;
  }
}
