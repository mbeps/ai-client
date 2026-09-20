import { describe, expect, it } from "vitest";
import {
  addOrUpdateFile,
  buildSkillTree,
  cleanPath,
  deleteFile,
  deleteFolderPath,
  getAllFolders,
  moveFile,
  renameFilePath,
  renameFolderPath,
} from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

describe("skill-tree-utils", () => {
  describe("cleanPath", () => {
    it("strips leading/trailing slashes and normalises backslashes", () => {
      expect(cleanPath("/references/guide.md/")).toBe("references/guide.md");
      expect(cleanPath("\\scripts\\run.sh")).toBe("scripts/run.sh");
      expect(cleanPath("  //a///b//c.txt  ")).toBe("a/b/c.txt");
    });
  });

  describe("buildSkillTree", () => {
    it("always pins root SKILL.md as the first node", () => {
      const tree = buildSkillTree([]);
      expect(tree).toHaveLength(1);
      expect(tree[0]).toEqual({
        id: "SKILL.md",
        name: "SKILL.md",
        path: "SKILL.md",
        type: "file",
        isRootSkillMd: true,
      });
    });

    it("organises nested directories and sorts folders before files", () => {
      const files: SkillBundledFile[] = [
        { path: "zebra.txt", content: "zebra" },
        { path: "references/guide.md", content: "guide" },
        { path: "references/sub/deep.md", content: "deep" },
        { path: "assets/logo.svg", content: "svg" },
        { path: "alpha.txt", content: "alpha" },
      ];

      const tree = buildSkillTree(files);

      // Root should have: SKILL.md, assets/, references/, alpha.txt, zebra.txt
      expect(tree.map((n) => n.name)).toEqual([
        "SKILL.md",
        "assets",
        "references",
        "alpha.txt",
        "zebra.txt",
      ]);

      const assetsFolder = tree.find((n) => n.name === "assets")!;
      expect(assetsFolder.type).toBe("folder");
      expect(assetsFolder.children?.map((c) => c.name)).toEqual(["logo.svg"]);

      const refFolder = tree.find((n) => n.name === "references")!;
      expect(refFolder.type).toBe("folder");
      expect(refFolder.children?.map((c) => c.name)).toEqual(["sub", "guide.md"]);

      const subFolder = refFolder.children?.find((c) => c.name === "sub")!;
      expect(subFolder.type).toBe("folder");
      expect(subFolder.children?.map((c) => c.name)).toEqual(["deep.md"]);
    });

    it("supports registering empty folders", () => {
      const tree = buildSkillTree([], ["empty-dir", "references/empty-sub"]);
      const emptyDir = tree.find((n) => n.name === "empty-dir");
      expect(emptyDir).toBeDefined();
      expect(emptyDir?.type).toBe("folder");
      expect(emptyDir?.children).toEqual([]);

      const refFolder = tree.find((n) => n.name === "references");
      expect(refFolder).toBeDefined();
      expect(refFolder?.children?.find((c) => c.name === "empty-sub")).toBeDefined();
    });

    it("correctly sorts large lists of files with SKILL.md remaining first", () => {
      const files: SkillBundledFile[] = Array.from({ length: 35 }, (_, i) => ({
        path: `file-${String(i).padStart(2, "0")}.txt`,
        content: `content-${i}`,
      }));
      const tree = buildSkillTree(files);
      expect(tree[0].name).toBe("SKILL.md");
      expect(tree[0].isRootSkillMd).toBe(true);
      expect(tree).toHaveLength(36);
    });

    it("ignores duplicate or SKILL.md inside files array", () => {
      const files: SkillBundledFile[] = [
        { path: "SKILL.md", content: "duplicate" },
        { path: "notes.md", content: "notes" },
      ];
      const tree = buildSkillTree(files);
      const skillNodes = tree.filter((n) => n.name === "SKILL.md");
      expect(skillNodes).toHaveLength(1);
    });
  });

  describe("renameFilePath", () => {
    it("renames specific file path and retains other files", () => {
      const files: SkillBundledFile[] = [
        { path: "references/guide.md", content: "guide" },
        { path: "scripts/run.sh", content: "sh" },
      ];

      const updated = renameFilePath(
        files,
        "references/guide.md",
        "references/overview.md",
      );
      expect(updated[0].path).toBe("references/overview.md");
      expect(updated[1].path).toBe("scripts/run.sh");
    });

    it("returns unchanged files when new path is empty or same as old path", () => {
      const files: SkillBundledFile[] = [{ path: "a.txt", content: "a" }];
      expect(renameFilePath(files, "a.txt", "")).toEqual(files);
      expect(renameFilePath(files, "a.txt", "a.txt")).toEqual(files);
    });
  });

  describe("renameFolderPath", () => {
    it("renames folder prefix for all contained subfiles", () => {
      const files: SkillBundledFile[] = [
        { path: "docs/getting-started.md", content: "c1" },
        { path: "docs/api/endpoints.md", content: "c2" },
        { path: "scripts/run.sh", content: "c3" },
      ];

      const updated = renameFolderPath(files, "docs", "references");
      expect(updated.map((f) => f.path)).toEqual([
        "references/getting-started.md",
        "references/api/endpoints.md",
        "scripts/run.sh",
      ]);
    });

    it("returns unchanged files when new folder path is empty or same as old folder path", () => {
      const files: SkillBundledFile[] = [{ path: "docs/a.txt", content: "a" }];
      expect(renameFolderPath(files, "docs", "")).toEqual(files);
      expect(renameFolderPath(files, "docs", "docs")).toEqual(files);
    });
  });

  describe("deleteFolderPath", () => {
    it("removes all files within target folder", () => {
      const files: SkillBundledFile[] = [
        { path: "references/guide.md", content: "c1" },
        { path: "references/sub/deep.md", content: "c2" },
        { path: "scripts/run.sh", content: "c3" },
      ];

      const updated = deleteFolderPath(files, "references");
      expect(updated).toEqual([{ path: "scripts/run.sh", content: "c3" }]);
    });
  });

  describe("addOrUpdateFile", () => {
    it("adds a new file when not present", () => {
      const files: SkillBundledFile[] = [{ path: "a.txt", content: "a" }];
      const updated = addOrUpdateFile(files, { path: "b.txt", content: "b" });
      expect(updated).toHaveLength(2);
      expect(updated[1].path).toBe("b.txt");
    });

    it("updates existing file when path matches", () => {
      const files: SkillBundledFile[] = [{ path: "a.txt", content: "a" }];
      const updated = addOrUpdateFile(files, {
        path: "/a.txt/",
        content: "new content",
      });
      expect(updated).toHaveLength(1);
      expect(updated[0].content).toBe("new content");
    });
  });

  describe("deleteFile", () => {
    it("deletes specified file by path", () => {
      const files: SkillBundledFile[] = [
        { path: "a.txt", content: "a" },
        { path: "b.txt", content: "b" },
      ];
      const updated = deleteFile(files, "a.txt");
      expect(updated).toEqual([{ path: "b.txt", content: "b" }]);
    });
  });

  describe("moveFile", () => {
    it("moves a file from root to a subfolder", () => {
      const files: SkillBundledFile[] = [
        { path: "guide.md", content: "guide" },
        { path: "scripts/run.sh", content: "sh" },
      ];
      const { files: updated, newPath } = moveFile(files, "guide.md", "references");
      expect(newPath).toBe("references/guide.md");
      expect(updated[0].path).toBe("references/guide.md");
      expect(updated[1].path).toBe("scripts/run.sh");
    });

    it("moves a file from a subfolder to root", () => {
      const files: SkillBundledFile[] = [
        { path: "references/guide.md", content: "guide" },
      ];
      const { files: updated, newPath } = moveFile(files, "references/guide.md", "");
      expect(newPath).toBe("guide.md");
      expect(updated[0].path).toBe("guide.md");
    });

    it("throws an error if target path already exists", () => {
      const files: SkillBundledFile[] = [
        { path: "guide.md", content: "guide 1" },
        { path: "references/guide.md", content: "guide 2" },
      ];
      expect(() => moveFile(files, "guide.md", "references")).toThrow(
        /already exists/,
      );
    });

    it("returns original files when destination is the same as current location", () => {
      const files: SkillBundledFile[] = [
        { path: "docs/guide.md", content: "guide" },
      ];
      const result = moveFile(files, "docs/guide.md", "docs");
      expect(result.newPath).toBe("docs/guide.md");
      expect(result.files).toBe(files);
    });
  });

  describe("getAllFolders", () => {
    it("returns sorted unique folder paths from files and emptyFolders", () => {
      const files: SkillBundledFile[] = [
        { path: "references/sub/deep.md", content: "deep" },
        { path: "scripts/test.py", content: "py" },
        { path: "root.md", content: "root" },
      ];
      const folders = getAllFolders(files, ["assets", "references", "", "   /// "]);
      expect(folders).toEqual(["assets", "references", "references/sub", "scripts"]);
    });

    it("handles default empty array when emptyFolders is omitted", () => {
      const files: SkillBundledFile[] = [{ path: "a/b.txt", content: "b" }];
      expect(getAllFolders(files)).toEqual(["a"]);
    });
  });

  describe("addOrUpdateFile", () => {
    it("updates existing file while keeping other files intact", () => {
      const files: SkillBundledFile[] = [
        { path: "other.txt", content: "original other" },
        { path: "target.txt", content: "original target" },
      ];
      const updated = addOrUpdateFile(files, {
        path: "target.txt",
        content: "updated target",
      });
      expect(updated).toEqual([
        { path: "other.txt", content: "original other" },
        { path: "target.txt", content: "updated target" },
      ]);
    });
  });

  describe("buildSkillTree edge cases", () => {
    it("handles empty folder paths that clean to empty string", () => {
      const tree = buildSkillTree([], ["", "   ///  "]);
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe("SKILL.md");
    });

    it("sorts multiple root files keeping SKILL.md first", () => {
      const files: SkillBundledFile[] = [
        { path: "z.txt", content: "" },
        { path: "y.txt", content: "" },
        { path: "x.txt", content: "" },
        { path: "w.txt", content: "" },
        { path: "v.txt", content: "" },
        { path: "u.txt", content: "" },
        { path: "t.txt", content: "" },
        { path: "s.txt", content: "" },
        { path: "r.txt", content: "" },
        { path: "q.txt", content: "" },
        { path: "p.txt", content: "" },
        { path: "a.txt", content: "" },
      ];
      const tree = buildSkillTree(files);
      expect(tree[0].name).toBe("SKILL.md");
      expect(tree[1].name).toBe("a.txt");
    });
  });
});


