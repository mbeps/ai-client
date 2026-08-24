import { describe, it, expect } from "vitest";
import { sanitiseFilename } from "@/lib/utils/sanitise-filename";

describe("sanitiseFilename", () => {
  it("returns safe alphanumeric names unchanged", () => {
    expect(sanitiseFilename("report.xlsx")).toBe("report.xlsx");
  });

  it("replaces spaces with underscores", () => {
    expect(sanitiseFilename("my report.xlsx")).toBe("my_report.xlsx");
  });

  it("replaces path separators to prevent directory traversal", () => {
    expect(sanitiseFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
  });

  it("replaces special characters with underscores", () => {
    expect(sanitiseFilename("file@name#1!.pdf")).toBe("file_name_1_.pdf");
  });

  it("collapses consecutive underscores", () => {
    expect(sanitiseFilename("file  name.xlsx")).toBe("file_name.xlsx");
  });

  it("truncates names exceeding 200 characters", () => {
    const longName = "a".repeat(210) + ".xlsx";
    expect(sanitiseFilename(longName).length).toBeLessThanOrEqual(200);
  });

  it("preserves dots and hyphens", () => {
    expect(sanitiseFilename("my-file.v1.2.xlsx")).toBe("my-file.v1.2.xlsx");
  });

  it("handles empty string", () => {
    expect(sanitiseFilename("")).toBe("");
  });

  it("handles filename with only special chars", () => {
    const result = sanitiseFilename("@@@###");
    expect(result).toBe("_");
  });
});
