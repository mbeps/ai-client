export type ProjectRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  globalPrompt: string | null;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};
