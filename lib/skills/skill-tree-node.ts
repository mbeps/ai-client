export interface SkillTreeNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  isRootSkillMd?: boolean;
  children?: SkillTreeNode[];
}
