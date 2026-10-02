import type { SkillBundledFile } from "@/types/skill/skill";

export interface SkillTreeNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  isRootSkillMd?: boolean;
  children?: SkillTreeNode[];
}

/**
 * Normalises a relative file or folder path by trimming whitespace,
 * stripping leading/trailing slashes, and removing duplicate slashes.
 */
export function cleanPath(rawPath: string): string {
  return rawPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/+/g, "/");
}

/**
 * Builds a nested hierarchical tree from a flat list of skill bundled files.
 * Pinned at root: SKILL.md.
 * Children are sorted: folders first alphabetically, then files alphabetically.
 *
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
      if (a.isRootSkillMd) return -1;
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

/**
 * Renames an individual file path within the bundled files array.
 */
export function renameFilePath(
  files: SkillBundledFile[],
  oldPath: string,
  newPath: string,
): SkillBundledFile[] {
  const cleanedOld = cleanPath(oldPath);
  const cleanedNew = cleanPath(newPath);

  if (!cleanedNew || cleanedOld === cleanedNew) {
    return files;
  }

  return files.map((file) => {
    if (cleanPath(file.path) === cleanedOld) {
      return { ...file, path: cleanedNew };
    }
    return file;
  });
}

/**
 * Renames a folder prefix for all files contained inside it.
 */
export function renameFolderPath(
  files: SkillBundledFile[],
  oldPrefix: string,
  newPrefix: string,
): SkillBundledFile[] {
  const cleanedOld = cleanPath(oldPrefix);
  const cleanedNew = cleanPath(newPrefix);

  if (!cleanedNew || cleanedOld === cleanedNew) {
    return files;
  }

  const prefixWithSlash = `${cleanedOld}/`;

  return files.map((file) => {
    const cleanedFilePath = cleanPath(file.path);
    if (cleanedFilePath.startsWith(prefixWithSlash)) {
      const rest = cleanedFilePath.slice(prefixWithSlash.length);
      return { ...file, path: `${cleanedNew}/${rest}` };
    }
    return file;
  });
}

/**
 * Deletes an entire folder and all nested files within it.
 */
export function deleteFolderPath(
  files: SkillBundledFile[],
  folderPath: string,
): SkillBundledFile[] {
  const cleanedFolder = cleanPath(folderPath);
  const prefixWithSlash = `${cleanedFolder}/`;

  return files.filter((file) => {
    const cleanedFilePath = cleanPath(file.path);
    return !cleanedFilePath.startsWith(prefixWithSlash);
  });
}

/**
 * Adds or updates a file in the bundled files list.
 */
export function addOrUpdateFile(
  files: SkillBundledFile[],
  newFile: SkillBundledFile,
): SkillBundledFile[] {
  const cleanedTarget = cleanPath(newFile.path);
  const exists = files.some((f) => cleanPath(f.path) === cleanedTarget);

  if (exists) {
    return files.map((f) =>
      cleanPath(f.path) === cleanedTarget
        ? { ...f, content: newFile.content }
        : f,
    );
  }

  return [...files, { path: cleanedTarget, content: newFile.content }];
}

/**
 * Deletes an individual file by relative path.
 */
export function deleteFile(
  files: SkillBundledFile[],
  targetPath: string,
): SkillBundledFile[] {
  const cleanedTarget = cleanPath(targetPath);
  return files.filter((f) => cleanPath(f.path) !== cleanedTarget);
}

/**
 * Moves a file from sourcePath to targetFolderPath (empty string or '/' for root).
 */
export function moveFile(
  files: SkillBundledFile[],
  sourcePath: string,
  targetFolderPath: string,
): { files: SkillBundledFile[]; newPath: string } {
  const cleanedSource = cleanPath(sourcePath);
  const cleanedFolder = cleanPath(targetFolderPath);

  const segments = cleanedSource.split("/");
  const fileName = segments[segments.length - 1];
  const newPath = cleanedFolder ? `${cleanedFolder}/${fileName}` : fileName;

  if (newPath === cleanedSource) {
    return { files, newPath };
  }

  const exists = files.some(
    (f) => cleanPath(f.path).toLowerCase() === newPath.toLowerCase(),
  );
  if (exists) {
    throw new Error(
      `A file with name "${fileName}" already exists in the target destination.`,
    );
  }

  const updatedFiles = files.map((file) =>
    cleanPath(file.path) === cleanedSource ? { ...file, path: newPath } : file,
  );

  return { files: updatedFiles, newPath };
}

/**
 * Extracts all unique folder paths from files and emptyFolders.
 */
export function getAllFolders(
  files: SkillBundledFile[],
  emptyFolders: string[] = [],
): string[] {
  const folders = new Set<string>();

  for (const empty of emptyFolders) {
    const cleaned = cleanPath(empty);
    if (cleaned) folders.add(cleaned);
  }

  for (const file of files) {
    const cleaned = cleanPath(file.path);
    const segments = cleaned.split("/");
    if (segments.length > 1) {
      for (let i = 1; i < segments.length; i++) {
        folders.add(segments.slice(0, i).join("/"));
      }
    }
  }

  return Array.from(folders).sort();
}
