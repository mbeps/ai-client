export type KbDocument = {
  id: string;
  kbId: string;
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  s3Key: string;
  status: "pending" | "processing" | "ready" | "failed";
  chunkCount: number;
  tokenCount: number;
  createdAt: Date;
  updatedAt: Date;
};
