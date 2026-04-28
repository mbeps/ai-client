import {
  getExtension,
  isSpreadsheet,
  SPREADSHEET_EXTENSIONS,
  SPREADSHEET_MIME_TYPES,
} from "@/lib/attachments/spreadsheet-types";

describe("getExtension", () => {
  it("returns .xlsx for a .xlsx filename", () => {
    expect(getExtension("data.xlsx")).toBe(".xlsx");
  });

  it("returns .xlsm for a .xlsm filename", () => {
    expect(getExtension("macro.xlsm")).toBe(".xlsm");
  });

  it("returns .xls for a .xls filename", () => {
    expect(getExtension("old.xls")).toBe(".xls");
  });

  it("returns .csv for a .csv filename", () => {
    expect(getExtension("export.csv")).toBe(".csv");
  });

  it("returns empty string for a filename without extension", () => {
    expect(getExtension("README")).toBe("");
  });

  it("returns empty string for an empty filename", () => {
    expect(getExtension("")).toBe("");
  });

  it("returns only the last extension when filename has multiple dots", () => {
    expect(getExtension("archive.tar.gz")).toBe(".gz");
  });

  it("normalises extension to lowercase", () => {
    expect(getExtension("DATA.XLSX")).toBe(".xlsx");
  });

  it("handles filenames that are just an extension (e.g. .hidden)", () => {
    expect(getExtension(".hidden")).toBe(".hidden");
  });

  it("handles filenames with a trailing dot", () => {
    // "file." → lastIndexOf('.') = 4 → slice(4) = "."
    expect(getExtension("file.")).toBe(".");
  });
});

describe("isSpreadsheet", () => {
  describe("identification by MIME type", () => {
    it("identifies application/vnd.openxmlformats-officedocument.spreadsheetml.sheet as spreadsheet", () => {
      expect(
        isSpreadsheet(
          "file.bin",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      ).toBe(true);
    });

    it("identifies application/vnd.ms-excel as spreadsheet", () => {
      expect(isSpreadsheet("file.bin", "application/vnd.ms-excel")).toBe(true);
    });

    it("identifies application/vnd.ms-excel.sheet.macroEnabled.12 as spreadsheet", () => {
      expect(
        isSpreadsheet(
          "file.bin",
          "application/vnd.ms-excel.sheet.macroEnabled.12",
        ),
      ).toBe(true);
    });

    it("identifies text/csv as spreadsheet", () => {
      expect(isSpreadsheet("file.bin", "text/csv")).toBe(true);
    });

    it("does NOT identify image/png as spreadsheet", () => {
      expect(isSpreadsheet("image.png", "image/png")).toBe(false);
    });

    it("does NOT identify application/pdf as spreadsheet", () => {
      expect(isSpreadsheet("doc.pdf", "application/pdf")).toBe(false);
    });
  });

  describe("identification by file extension", () => {
    it("identifies .xlsx extension as spreadsheet", () => {
      expect(isSpreadsheet("data.xlsx", "")).toBe(true);
    });

    it("identifies .xlsm extension as spreadsheet", () => {
      expect(isSpreadsheet("macro.xlsm", "")).toBe(true);
    });

    it("identifies .xls extension as spreadsheet", () => {
      expect(isSpreadsheet("old.xls", "")).toBe(true);
    });

    it("identifies .csv extension as spreadsheet", () => {
      expect(isSpreadsheet("export.csv", "")).toBe(true);
    });

    it("does NOT identify .txt extension as spreadsheet", () => {
      expect(isSpreadsheet("notes.txt", "")).toBe(false);
    });

    it("does NOT identify .pdf extension as spreadsheet", () => {
      expect(isSpreadsheet("doc.pdf", "")).toBe(false);
    });
  });

  describe("case sensitivity", () => {
    it("identifies .XLSX (uppercase) as spreadsheet via extension", () => {
      expect(isSpreadsheet("DATA.XLSX", "")).toBe(true);
    });

    it("identifies mixed-case .Xlsx as spreadsheet", () => {
      expect(isSpreadsheet("Data.Xlsx", "")).toBe(true);
    });
  });

  describe("MIME wins when extension is wrong", () => {
    it("returns true when MIME is spreadsheet even if extension is .txt", () => {
      expect(
        isSpreadsheet(
          "disguised.txt",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      ).toBe(true);
    });
  });

  describe("both empty", () => {
    it("returns false when both name has no extension and MIME is empty", () => {
      expect(isSpreadsheet("README", "")).toBe(false);
    });
  });
});

describe("SPREADSHEET_EXTENSIONS set", () => {
  it("contains .xlsx", () => {
    expect(SPREADSHEET_EXTENSIONS.has(".xlsx")).toBe(true);
  });

  it("contains .xlsm", () => {
    expect(SPREADSHEET_EXTENSIONS.has(".xlsm")).toBe(true);
  });

  it("contains .xls", () => {
    expect(SPREADSHEET_EXTENSIONS.has(".xls")).toBe(true);
  });

  it("contains .csv", () => {
    expect(SPREADSHEET_EXTENSIONS.has(".csv")).toBe(true);
  });
});

describe("SPREADSHEET_MIME_TYPES set", () => {
  it("contains the xlsx MIME type", () => {
    expect(
      SPREADSHEET_MIME_TYPES.has(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true);
  });

  it("contains text/csv", () => {
    expect(SPREADSHEET_MIME_TYPES.has("text/csv")).toBe(true);
  });
});
