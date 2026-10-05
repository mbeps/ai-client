import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  KnowledgebasePicker,
  KnowledgebasePickerDialog,
} from "@/components/chat/knowledgebase-picker";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";

// Mock env
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

const mockKnowledgebases: Knowledgebase[] = [
  {
    id: "kb1",
    userId: "u1",
    name: "Credentials",
    description: "About Maruf Bepary",
    documentCount: 2,
    indexStatus: "ready",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "kb2",
    userId: "u1",
    name: "API Documentation",
    description: "REST and GraphQL specs",
    documentCount: 5,
    indexStatus: "ready",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("KnowledgebasePicker", () => {
  it("renders knowledgebases with name and description", () => {
    render(
      <KnowledgebasePicker
        knowledgebases={mockKnowledgebases}
        selectedIds={new Set()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Credentials")).toBeDefined();
    expect(screen.getByText("About Maruf Bepary")).toBeDefined();
    expect(screen.getByText("API Documentation")).toBeDefined();
    expect(screen.getByText("2 knowledge bases available")).toBeDefined();
  });

  it("filters knowledge bases by search keyword", () => {
    render(
      <KnowledgebasePicker
        knowledgebases={mockKnowledgebases}
        selectedIds={new Set()}
        onSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      "Search knowledge bases...",
    );
    fireEvent.change(searchInput, { target: { value: "API" } });

    expect(screen.queryByText("Credentials")).toBeNull();
    expect(screen.getByText("API Documentation")).toBeDefined();
    expect(screen.getByText("1 knowledge base available")).toBeDefined();
  });

  it("selects all ready knowledgebases with Select All button", () => {
    const handleSelect = vi.fn();
    render(
      <KnowledgebasePicker
        knowledgebases={mockKnowledgebases}
        selectedIds={new Set()}
        onSelect={handleSelect}
      />,
    );

    const selectAllBtn = screen.getByText("Select All");
    fireEvent.click(selectAllBtn);

    expect(handleSelect).toHaveBeenCalledWith(new Set(["kb1", "kb2"]));
  });
});

describe("KnowledgebasePickerDialog", () => {
  it("renders empty state when there are no knowledge bases", () => {
    render(
      <KnowledgebasePickerDialog
        knowledgebases={[]}
        selectedKbs={new Set()}
        onToggleKb={vi.fn()}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("No knowledge bases available.")).toBeDefined();
  });

  it("renders dialog with Manage Knowledge Bases link and count", () => {
    render(
      <KnowledgebasePickerDialog
        knowledgebases={mockKnowledgebases}
        selectedKbs={new Set(["kb1"])}
        onToggleKb={vi.fn()}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Select Knowledge Bases")).toBeDefined();
    expect(screen.getByText("Manage Knowledge Bases")).toBeDefined();
    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === "1/2 selected knowledge bases";
      }),
    ).toBeDefined();
  });
});
