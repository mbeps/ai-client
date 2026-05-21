export interface DiscoveredPrompt {
  name: string;
  description?: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
  serverId: string;
  serverName: string;
}
