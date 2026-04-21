export type AssistantRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  prompt: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
};
