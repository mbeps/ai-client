import type { SkillTreeNode } from "@/lib/skills/skill-tree-node";
import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Builds a nested hierarchical tree from a flat list of skill bundled files. Pinned at root: SKILL.md. Children are sorted: folders first alphabetically, then files alphabetically.
 *
 * @param files - Target files
 * @param emptyFolders - Target empty folders
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function buildSkillTree(
  files: SkillBundledFile[],
  emptyFolders: string[] = [],
): SkillTreeNode[] {
  const rootNodes: SkillTreeNode[] = [];

  // Pinned root SKILL.md
  rootNodes.push({
    id: "SKILL.md",
    name: "SKILL.md",
    path: "SKILL.md",
    type: "file",
    isRootSkillMd: true,
  });

  const folderMap = new Map<string, SkillTreeNode>();

  const getOrCreateFolder = (folderPath: string): SkillTreeNode => {
    const cleaned = cleanPath(folderPath);
    if (folderMap.has(cleaned)) {
      return folderMap.get(cleaned)!;
    }

    const segments = cleaned.split("/");
    const name = segments[segments.length - 1];
    const node: SkillTreeNode = {
      id: `folder:${cleaned}`,
      name,
      path: cleaned,
      type: "folder",
      children: [],
    };
    folderMap.set(cleaned, node);

    if (segments.length === 1) {
      rootNodes.push(node);
    } else {
      const parentPath = segments.slice(0, -1).join("/");
      const parentNode = getOrCreateFolder(parentPath);
      parentNode.children!.push(node);
    }

    return node;
  };

  // Register any explicit empty folders
  for (const emptyFolder of emptyFolders) {
    const cleaned = cleanPath(emptyFolder);
    if (cleaned) {
      getOrCreateFolder(cleaned);
    }
  }

  // Insert all subfiles
  for (const file of files) {
    const cleaned = cleanPath(file.path);
    if (!cleaned || cleaned.toLowerCase() === "skill.md") {
      continue;
    }

    const segments = cleaned.split("/");
    const fileName = segments[segments.length - 1];

    const fileNode: SkillTreeNode = {
      id: `file:${cleaned}`,
      name: fileName,
      path: cleaned,
      type: "file",
    };

    if (segments.length === 1) {
      rootNodes.push(fileNode);
    } else {
      const parentPath = segments.slice(0, -1).join("/");
      const parentNode = getOrCreateFolder(parentPath);
      parentNode.children!.push(fileNode);
    }
  }

  // Sort helper: folders first, then files alphabetically
  const sortTreeNodes = (nodes: SkillTreeNode[]) => {
    nodes.sort((a, b) => {
      if (b.isRootSkillMd) return 1;
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        sortTreeNodes(node.children);
      }
    }
  };

  sortTreeNodes(rootNodes);
  return rootNodes;
}
