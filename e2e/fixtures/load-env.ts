import process from "node:process";

try {
  process.loadEnvFile();
} catch {
  // Ignore if .env is missing
}
