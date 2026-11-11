import { describe, expect, it } from "vitest";
import { buildKbMermaidChart } from "@/lib/knowledgebase/build-kb-mermaid-chart";
import type { KbGraphEdge, KbGraphNode } from "@/types/knowledgebase/kb-graph-data";

describe("buildKbMermaidChart", () => {
  const sampleDocs: KbGraphNode[] = [
    {
      id: "doc-1",
      name: "Architecture.md",
      documentType: "technical_spec",
      summary: "System architecture",
      keyEntities: ["System", "Auth"],
      chunkCount: 10,
      tokenCount: 2500,
    },
    {
      id: "doc-2",
      name: "Security Guide.pdf",
      documentType: "policy",
      summary: "Security guidelines",
      keyEntities: ["Auth", "Token"],
      chunkCount: 5,
      tokenCount: 1200,
    },
    {
      id: "doc-3",
      name: 'Special "Quotes" & (Parens).txt',
      documentType: "general",
      summary: "General notes",
      keyEntities: [],
      chunkCount: 2,
      tokenCount: 400,
    },
  ];

  const sampleRelations: KbGraphEdge[] = [
    {
      id: "rel-1",
      sourceDocId: "doc-1",
      targetDocId: "doc-2",
      relationType: "references",
      reason: "Architecture references security policies",
    },
    {
      id: "rel-2",
      sourceDocId: "doc-2",
      targetDocId: "doc-3",
      relationType: "supplements",
      reason: "Security supplements general guidelines",
    },
  ];

  it("returns an empty string when documents array is empty", () => {
    const chart = buildKbMermaidChart([], []);
    expect(chart).toBe("");
  });

  it("generates valid flowchart syntax with default LR direction", () => {
    const chart = buildKbMermaidChart(sampleDocs, sampleRelations);
    expect(chart).toContain("flowchart LR");
    expect(chart).toContain('doc_doc_1["Architecture.md<br/>(technical_spec)"]');
    expect(chart).toContain('doc_doc_2["Security Guide.pdf<br/>(policy)"]');
    expect(chart).toContain("doc_doc_1 -->|references| doc_doc_2");
    expect(chart).toContain("doc_doc_2 -->|supplements| doc_doc_3");
  });

  it("supports TD direction when specified", () => {
    const chart = buildKbMermaidChart(sampleDocs, sampleRelations, {
      direction: "TD",
    });
    expect(chart).toContain("flowchart TD");
  });

  it("safely sanitizes quotes and special characters in document titles", () => {
    const chart = buildKbMermaidChart([sampleDocs[2]], []);
    expect(chart).toContain('doc_doc_3["Special \'Quotes\' & (Parens).txt<br/>(general)"]');
  });

  it("renders isolated nodes when there are no relations", () => {
    const chart = buildKbMermaidChart([sampleDocs[0]], []);
    expect(chart).toContain("flowchart LR");
    expect(chart).toContain('doc_doc_1["Architecture.md<br/>(technical_spec)"]');
    expect(chart).not.toContain("-->");
  });

  it("filters edges by relationType when specified, and includes all when 'all' is passed", () => {
    const chartFiltered = buildKbMermaidChart(sampleDocs, sampleRelations, {
      filterRelationType: "references",
    });
    expect(chartFiltered).toContain("doc_doc_1 -->|references| doc_doc_2");
    expect(chartFiltered).not.toContain("doc_doc_2 -->|supplements| doc_doc_3");

    const chartAll = buildKbMermaidChart(sampleDocs, sampleRelations, {
      filterRelationType: "all",
    });
    expect(chartAll).toContain("doc_doc_1 -->|references| doc_doc_2");
    expect(chartAll).toContain("doc_doc_2 -->|supplements| doc_doc_3");
  });

  it("handles empty or whitespace search without filtering", () => {
    const chart = buildKbMermaidChart(sampleDocs, sampleRelations, {
      search: "   ",
    });
    expect(chart).toContain("doc_doc_1");
    expect(chart).toContain("doc_doc_2");
    expect(chart).toContain("doc_doc_3");
  });

  it("matches search query against summary, classification, or entity keywords", () => {
    const chartEntity = buildKbMermaidChart(sampleDocs, sampleRelations, {
      search: "Token",
    });
    expect(chartEntity).toContain("doc_doc_2");

    const chartSummary = buildKbMermaidChart(sampleDocs, sampleRelations, {
      search: "System architecture",
    });
    expect(chartSummary).toContain("doc_doc_1");

    const chartType = buildKbMermaidChart(sampleDocs, sampleRelations, {
      search: "general",
    });
    expect(chartType).toContain("doc_doc_3");
  });

  it("handles 1-hop search expansion when a connected peer is missing from docMap", () => {
    const docsWithBrokenRel: KbGraphNode[] = [sampleDocs[0]];
    const brokenRels: KbGraphEdge[] = [
      {
        id: "rel-b1",
        sourceDocId: "doc-1",
        targetDocId: "doc-missing",
        relationType: "references",
        reason: "orphan",
      },
      {
        id: "rel-b2",
        sourceDocId: "doc-missing-2",
        targetDocId: "doc-1",
        relationType: "references",
        reason: "orphan 2",
      },
    ];

    const chart = buildKbMermaidChart(docsWithBrokenRel, brokenRels, {
      search: "Architecture",
    });
    expect(chart).toContain("doc_doc_1");
  });

  it("filters documents and relevant edges when search keyword is provided", () => {
    const chart = buildKbMermaidChart(sampleDocs, sampleRelations, {
      search: "Security",
    });
    // Security Guide matches directly; Architecture and Special have links to it
    expect(chart).toContain("doc_doc_2");
    expect(chart).toContain("doc_doc_1 -->|references| doc_doc_2");
  });

  it("skips relations where source or target document is missing from the document list", () => {
    const brokenRelations: KbGraphEdge[] = [
      {
        id: "rel-broken",
        sourceDocId: "doc-1",
        targetDocId: "non-existent-doc",
        relationType: "references",
        reason: "Points to deleted doc",
      },
    ];
    const chart = buildKbMermaidChart([sampleDocs[0]], brokenRelations);
    expect(chart).toContain("doc_doc_1");
    expect(chart).not.toContain("non-existent-doc");
  });
});
