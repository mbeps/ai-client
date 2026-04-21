export interface ChatRow {
  id: string;
  title: string;
  userId: string;
  projectId: string | null;
  assistantId: string | null;
  currentLeafId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
