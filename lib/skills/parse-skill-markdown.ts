import { sanitizeSkillSlug } from "@/lib/skills/sanitize-skill-slug";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Represents parsed skill.
 *
 * @author Maruf Bepary
 */
export interface ParsedSkill {
  name: string;
  displayName: string;
  description: string;
  content: string;
  files: SkillBundledFile[];
}

/**
 * Represents frontmatter meta.
 *
 * @author Maruf Bepary
 */
interface FrontmatterMeta {
  name: string;
  displayName: string;
  description: string;
}

/**
 * Parses a YAML frontmatter block into structured name, displayName, and description.
 *
 * @param yamlText - Target yaml text
 * @returns The resolved result
 * @author Maruf Bepary
 */
function parseFrontmatterBlock(yamlText: string): FrontmatterMeta {
  let name = "";
  let displayName = "";
  let description = "";

  const lines = yamlText.split("\n");
  let currentKey = "";
  let currentVal = "";

  const flushKey = () => {
    if (!currentKey) return;
    const cleanVal = currentVal.trim().replace(/^["']|["']$/g, "");
    if (currentKey === "name") {
      name = cleanVal;
    } else if (currentKey === "description") {
      description = cleanVal;
    } else if (
      currentKey === "displayname" ||
      currentKey === "display_name" ||
      currentKey === "title"
    ) {
      displayName = cleanVal;
    }
    currentKey = "";
    currentVal = "";
  };

  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (match) {
      flushKey();
      currentKey = match[1].toLowerCase();
      currentVal = match[2] || "";
    } else if (currentKey && (line.startsWith("  ") || line.startsWith("\t"))) {
      // Multi-line value continuation
      currentVal += (currentVal ? " " : "") + line.trim();
    }
  }
  flushKey();

  return { name, displayName, description };
}

/**
 * Simple, robust YAML frontmatter parser for SKILL.md files. Extracts `name`, `description`, `displayName`/`title`, and strips frontmatter to return the markdown body.
 *
 * @param rawMarkdown - Target raw markdown
 * @param fallbackName - Target fallback name
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function parseSkillMarkdown(
  rawMarkdown: string,
  fallbackName = "custom-skill",
): ParsedSkill {
  const normalized = rawMarkdown.replace(/\r\n/g, "\n");
  const frontmatterMatch = normalized.match(
    /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/,
  );

  let name = "";
  let displayName = "";
  let description = "";
  let content = normalized;

  if (frontmatterMatch) {
    const meta = parseFrontmatterBlock(frontmatterMatch[1]);
    name = meta.name;
    displayName = meta.displayName;
    description = meta.description;
    content = frontmatterMatch[2].trim();
  }

  const finalName = sanitizeSkillSlug(name || fallbackName) || "custom-skill";
  const finalDisplayName =
    displayName.trim() ||
    finalName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const finalDescription =
    description.trim() ||
    (content.length > 0
      ? content.slice(0, 150).replace(/\n/g, " ")
      : "Agent skill instructions.");

  return {
    name: finalName,
    displayName: finalDisplayName,
    description: finalDescription.slice(0, 1024),
    content,
    files: [],
  };
}
