import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CLIENT_DIRS = ["app", "components"];
const FORBIDDEN_IMPORTS = [
  "@/drizzle/db",
  "@/lib/auth/auth",
  "next/headers",
  "node:",
];

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("client-server module boundary", () => {
  it('ensures "use client" files never import server-only modules', () => {
    const violations: string[] = [];

    for (const dir of CLIENT_DIRS) {
      const files = collectTsFiles(path.join(ROOT, dir));
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        const firstLine = content.trimStart().split("\n")[0] ?? "";
        if (
          !firstLine.includes('"use client"') &&
          !firstLine.includes("'use client'")
        ) {
          continue;
        }
        for (const forbidden of FORBIDDEN_IMPORTS) {
          const escaped = forbidden.replace("/", "\\/");
          const importPattern = forbidden.endsWith(":")
            ? new RegExp(`^(?!import\\s+type\\b).*from\\s+["']${escaped}`, "m")
            : new RegExp(
                `^(?!import\\s+type\\b).*from\\s+["']${escaped}["']`,
                "m",
              );
          if (importPattern.test(content)) {
            violations.push(
              `${path.relative(ROOT, file)} imports ${forbidden}`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
