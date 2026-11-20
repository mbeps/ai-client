import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="prompt-content-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { PromptContentTab } from "@/components/prompt/prompt-content-tab";
import { PromptDetailsTab } from "@/components/prompt/prompt-details-tab";
import type { PromptFormValues } from "@/components/prompt/prompt-form";
import { PromptScopeTab } from "@/components/prompt/prompt-scope-tab";
import { Form } from "@/components/ui/form";
import { useAppStore } from "@/lib/store/use-app-store";

function FormWrapper({
  children,
  defaultValues = {
    title: "Test Title",
    shortcut: "test-shortcut",
    content: "Test Content",
    projectIds: [],
    assistantIds: [],
  },
  onSubmit = vi.fn(),
}: {
  children: (form: any) => React.ReactNode;
  defaultValues?: Partial<PromptFormValues>;
  onSubmit?: (values: any) => void;
}) {
  const form = useForm<PromptFormValues>({
    defaultValues: {
      title: "",
      shortcut: "",
      content: "",
      projectIds: [],
      assistantIds: [],
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>{children(form)}</form>
    </Form>
  );
}

describe("Prompt Form Tabs", () => {
  beforeEach(() => {
    useAppStore.setState({
      projects: [
        {
          id: "proj-1",
          userId: "u1",
          name: "Project One",
          description: "Desc",
          globalPrompt: "",
          tools: [],
          skillMode: "dynamic" as const,
          skillIds: [],
          promptMode: "all" as const,
          promptIds: [],
          knowledgebaseId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      agents: [
        {
          id: "asst-1",
          userId: "u1",
          name: "Assistant One",
          description: "Desc",
          prompt: "",
          tools: [],
          skillMode: "dynamic" as const,
          skillIds: [],
          promptMode: "all" as const,
          promptIds: [],
          avatar: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
  });

  describe("PromptDetailsTab", () => {
    it("renders title and shortcut fields with submit button", () => {
      render(
        <FormWrapper>
          {(form) => <PromptDetailsTab form={form} />}
        </FormWrapper>,
      );

      expect(screen.getByDisplayValue("Test Title")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test-shortcut")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /save changes/i }),
      ).toBeInTheDocument();
    });
  });

  describe("PromptContentTab", () => {
    it("renders markdown editor and handles content change", async () => {
      const user = userEvent.setup();
      render(
        <FormWrapper>
          {(form) => <PromptContentTab form={form} />}
        </FormWrapper>,
      );

      const textarea = screen.getByLabelText("prompt-content-editor");
      expect(textarea).toHaveValue("Test Content");

      await user.clear(textarea);
      await user.type(textarea, "New instructions");
      expect(textarea).toHaveValue("New instructions");
    });
  });

  describe("PromptScopeTab", () => {
    it("renders global scope by default", () => {
      render(
        <FormWrapper defaultValues={{ projectIds: [], assistantIds: [] }}>
          {(form) => <PromptScopeTab form={form} />}
        </FormWrapper>,
      );

      expect(screen.getByText("Scope & Visibility")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /global/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /global/i })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });

    it("renders project selection when projectIds are populated", () => {
      render(
        <FormWrapper
          defaultValues={{ projectIds: ["proj-1"], assistantIds: [] }}
        >
          {(form) => <PromptScopeTab form={form} />}
        </FormWrapper>,
      );

      expect(screen.getByRole("radio", { name: /scoped/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /scoped/i })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(screen.getAllByText("Project One")[0]).toBeInTheDocument();
    });

    it("renders assistant selection when assistantIds are populated", () => {
      render(
        <FormWrapper
          defaultValues={{ projectIds: [], assistantIds: ["asst-1"] }}
        >
          {(form) => <PromptScopeTab form={form} />}
        </FormWrapper>,
      );

      expect(screen.getByRole("radio", { name: /scoped/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /scoped/i })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(screen.getAllByText("Assistant One")[0]).toBeInTheDocument();
    });

    it("allows switching scope via clicking option cards", async () => {
      const user = userEvent.setup();
      render(
        <FormWrapper defaultValues={{ projectIds: [], assistantIds: [] }}>
          {(form) => <PromptScopeTab form={form} />}
        </FormWrapper>,
      );

      const scopedCard = screen.getByRole("radio", { name: /scoped/i });
      await user.click(scopedCard);
      expect(scopedCard).toHaveAttribute("aria-checked", "true");
    });
  });
});
