import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWriteFile = vi.fn();

vi.mock("xlsx", async () => {
  const actual = await vi.importActual<any>("xlsx");
  return {
    ...actual,
    writeFile: (...args: any[]) => mockWriteFile(...args),
  };
});

import { downloadArtifact } from "@/lib/artifacts/download-artifact";
import type { ArtifactData } from "@/types/artifact/artifact-data";

describe("downloadArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports spreadsheet artifact as XLSX using xlsx.writeFile", () => {
    const sheetArtifact: ArtifactData = {
      id: "art-1",
      title: "Q3 Forecast",
      type: "spreadsheet",
      content: JSON.stringify({
        sheets: [
          {
            name: "Revenue",
            data: [
              ["Month", "Amount"],
              ["July", 1000],
            ],
          },
        ],
      }),
    };

    downloadArtifact(sheetArtifact);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.anything(),
      "q3_forecast.xlsx",
    );
  });

  it("exports markdown artifact as .md file", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const createObjectUrlSpy = vi
      .spyOn(window.URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    const revokeObjectUrlSpy = vi
      .spyOn(window.URL, "revokeObjectURL")
      .mockImplementation(() => {});

    const mdArtifact: ArtifactData = {
      id: "art-md",
      title: "Technical Spec",
      type: "markdown",
      content: "# Technical Specification\nDetails here.",
    };

    downloadArtifact(mdArtifact);

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:mock-url");

    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

