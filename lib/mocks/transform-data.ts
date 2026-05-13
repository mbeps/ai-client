import { TransformAgent } from "@/types/transform-agent";
import { TransformRun } from "@/types/transform-run";

export const MOCK_AGENTS: TransformAgent[] = [
  {
    id: "agent-1",
    userId: "user-1",
    name: "Monthly Expense Report",
    description: "Cleans and normalizes monthly expense reports from various departments.",
    modelId: "gpt-4o",
    steps: [
      {
        id: "step-1",
        name: "Normalize Headers",
        prompt: "Rename all column headers to a standardized format (Date, Description, Amount, Category).",
        mcpServerIds: ["excel-mcp"],
        toolIds: ["read_cells", "write_cells"],
        order: 0,
        requiresReview: false,
      },
      {
        id: "step-2",
        name: "Categorize Expenses",
        prompt: "Categorize each expense based on the description using standard accounting categories.",
        mcpServerIds: ["excel-mcp"],
        toolIds: ["read_cells", "write_cells"],
        order: 1,
        requiresReview: true,
      },
    ],
    createdAt: new Date("2024-05-01T10:00:00Z"),
    updatedAt: new Date("2024-05-01T10:00:00Z"),
  },
  {
    id: "agent-2",
    userId: "user-1",
    name: "Vendor Reconciliation",
    description: "Reconciles vendor invoices against purchase orders.",
    modelId: "gpt-4o",
    steps: [],
    createdAt: new Date("2024-05-05T14:30:00Z"),
    updatedAt: new Date("2024-05-05T14:30:00Z"),
  },
];

export const MOCK_RUNS: TransformRun[] = [
  {
    id: "run-1",
    agentId: "agent-1",
    userId: "user-1",
    status: "completed",
    currentStepIndex: 1,
    dryRun: false,
    inputAttachmentIds: ["file-1"],
    outputAttachmentIds: ["file-2"],
    errorMessage: "",
    createdAt: new Date("2024-05-07T09:00:00Z"),
    updatedAt: new Date("2024-05-07T09:15:00Z"),
  },
  {
    id: "run-2",
    agentId: "agent-1",
    userId: "user-1",
    status: "running",
    currentStepIndex: 0,
    dryRun: true,
    inputAttachmentIds: ["file-3"],
    outputAttachmentIds: [],
    errorMessage: "",
    createdAt: new Date("2024-05-08T10:30:00Z"),
    updatedAt: new Date("2024-05-08T10:32:00Z"),
  },
];
