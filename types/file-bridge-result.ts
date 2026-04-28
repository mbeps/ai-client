import { BridgedFile } from "./bridged-file";

/**
 * Result of downloading attachments to temporary staging directory.
 */
export type FileBridgeResult = {
  tempDir: string;
  files: BridgedFile[];
};
