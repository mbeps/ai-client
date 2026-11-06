import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ACTIONS_DIR = path.resolve(__dirname, "../../actions");

/**
 * Files awaiting migration to defineAction / entity factories.
 * Shrinks as each phase is executed; empty by Phase 5.
 */
export const UNMIGRATED_ACTIONS = new Set<string>([]);

function getActionFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getActionFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Server Actions Architecture", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const actionFiles = getActionFiles(ACTIONS_DIR);

  it("ensures every action is built with defineAction or an entity factory unless allowlisted", () => {
    for (const filePath of actionFiles) {
      const relPath = path.relative(rootDir, filePath);
      if (UNMIGRATED_ACTIONS.has(relPath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const usesDefineAction = content.includes("defineAction(");
      const usesFactory =
        /createEntityFactory[<(]/.test(content) ||
        /deleteEntityFactory[<(]/.test(content) ||
        /renameEntityFactory[<(]/.test(content) ||
        /updateEntityFactory[<(]/.test(content);

      expect(
        usesDefineAction || usesFactory,
        `${relPath} should wrap actions with defineAction or an entity factory`,
      ).toBe(true);
    }
  });
});
