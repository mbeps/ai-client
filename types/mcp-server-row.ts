export type McpServerRow = {
  id: string;
  userId: string;
  name: string;
  type: "stdio" | "http";
  command: string | null;
  args: string | null;
  url: string | null;
  headers: string | null;
  env: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};
