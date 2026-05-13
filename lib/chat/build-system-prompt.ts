import type { ModelMessage } from "ai";
import type { FileBridgeResult } from "@/types/file-bridge-result";
import { PROMPTS } from "@/constants/prompts";

export function buildSystemPrompt(
  projectPrompt: string | null | undefined,
  assistantPrompt: string | null | undefined,
  bridge: FileBridgeResult | null,
  hasKnowledgeBase: boolean,
): ModelMessage[] {
  const systemParts: string[] = [];

  if (projectPrompt?.trim()) {
    systemParts.push(projectPrompt.trim());
  }
  if (assistantPrompt?.trim()) {
    systemParts.push(assistantPrompt.trim());
  }
  if (bridge && bridge.files.length > 0) {
    const lines = bridge.files
      .map((f) => `- ${f.originalName}: ${f.localPath}`)
      .join("\n");
    systemParts.push(
      PROMPTS.SYSTEM.FILE_BRIDGE_SPREADSHEET_ACCESS_TEMPLATE(lines),
    );
  }
  if (hasKnowledgeBase) {
    systemParts.push(PROMPTS.SYSTEM.KNOWLEDGE_BASE_TOOL_INSTRUCTION);
  }

  return systemParts.length > 0
    ? [{ role: "system", content: systemParts.join("\n\n") }]
    : [];
}
