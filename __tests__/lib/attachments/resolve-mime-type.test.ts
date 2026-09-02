import { describe, expect, it } from "vitest";
import { resolveMimeType } from "@/lib/attachments/resolve-mime-type";

const enc = new TextEncoder();

describe("resolveMimeType — magic-byte sniffing (T9.8)", () => {
  it("sniffs %PDF as application/pdf even when file.type claims text/plain", async () => {
    const file = new File([enc.encode("%PDF-1.7 rest")], "evil.txt", {
      type: "text/plain",
    });
    expect(await resolveMimeType(file)).toBe("application/pdf");
  });

  it("sniffs ZIP magic for xlsx/docx regardless of claimed type", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    const xlsx = new File([bytes], "sheet.xlsx", { type: "text/plain" });
    expect(await resolveMimeType(xlsx)).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("sniffs PNG magic", async () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const file = new File([png], "img.png", { type: "text/plain" });
    expect(await resolveMimeType(file)).toBe("image/png");
  });

  it("sniffs JPEG magic", async () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpg], "photo.jpg", { type: "" });
    expect(await resolveMimeType(file)).toBe("image/jpeg");
  });

  it("sniffs GIF magic", async () => {
    const file = new File([enc.encode("GIF89a...")], "a.gif", { type: "" });
    expect(await resolveMimeType(file)).toBe("image/gif");
  });

  it("sniffs WEBP via RIFF....WEBP", async () => {
    const webp = new Uint8Array(12);
    webp.set(enc.encode("RIFF"), 0);
    webp.set(enc.encode("WEBP"), 8);
    const file = new File([webp], "pic.webp", { type: "" });
    expect(await resolveMimeType(file)).toBe("image/webp");
  });

  it("falls back to extension mapping for plain text with no signature", async () => {
    const file = new File([enc.encode("hello world")], "notes.md", {
      type: "",
    });
    expect(await resolveMimeType(file)).toBe("text/markdown");
  });

  it("keeps declared text/plain when no signature matches", async () => {
    const file = new File([enc.encode("just text")], "doc.txt", {
      type: "text/plain",
    });
    expect(await resolveMimeType(file)).toBe("text/plain");
  });

  it("returns empty string for unknown binary with unknown extension", async () => {
    const bin = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const file = new File([bin], "data.xyz123", { type: "" });
    expect(await resolveMimeType(file)).toBe("");
  });
});
