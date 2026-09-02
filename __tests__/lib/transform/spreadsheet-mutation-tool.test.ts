import { describe, expect, it } from "vitest";
import { isSpreadsheetMutationTool } from "@/lib/transform/is-spreadsheet-mutation-tool";

describe("isSpreadsheetMutationTool — expanded mutation set (T6.2)", () => {
  // Existing tools
  it("recognises write_cells (existing)", () => {
    expect(isSpreadsheetMutationTool("write_cells")).toBe(true);
  });
  it("recognises write_multi_sheet (existing)", () => {
    expect(isSpreadsheetMutationTool("write_multi_sheet")).toBe(true);
  });
  // write_* prefix heuristic
  it("recognises write_sheet via write_* prefix", () => {
    expect(isSpreadsheetMutationTool("write_sheet")).toBe(true);
  });

  // New explicit names to add
  it("recognises delete_rows", () => {
    expect(isSpreadsheetMutationTool("delete_rows")).toBe(true);
  });
  it("recognises insert_rows", () => {
    expect(isSpreadsheetMutationTool("insert_rows")).toBe(true);
  });
  it("recognises format_cells", () => {
    expect(isSpreadsheetMutationTool("format_cells")).toBe(true);
  });
  it("recognises clear_range", () => {
    expect(isSpreadsheetMutationTool("clear_range")).toBe(true);
  });
  it("recognises update_cell", () => {
    expect(isSpreadsheetMutationTool("update_cell")).toBe(true);
  });
  it("recognises apply_formula", () => {
    expect(isSpreadsheetMutationTool("apply_formula")).toBe(true);
  });
  it("recognises merge_cells", () => {
    expect(isSpreadsheetMutationTool("merge_cells")).toBe(true);
  });

  // Not a mutation tool
  it("returns false for read_cells", () => {
    expect(isSpreadsheetMutationTool("read_cells")).toBe(false);
  });
  it("returns false for upload_file", () => {
    expect(isSpreadsheetMutationTool("upload_file")).toBe(false);
  });
});
