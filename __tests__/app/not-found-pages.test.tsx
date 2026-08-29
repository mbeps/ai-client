import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ROUTES } from "@/constants/routes";

import RootNotFound from "@/app/not-found";
import MainNotFound from "@/app/(main)/not-found";
import ChatNotFound from "@/app/(main)/chats/[id]/not-found";
import ProjectNotFound from "@/app/(main)/projects/[id]/not-found";
import ProjectChatNotFound from "@/app/(main)/projects/[id]/[chatId]/not-found";
import AssistantNotFound from "@/app/(main)/assistants/[id]/not-found";
import AssistantChatNotFound from "@/app/(main)/assistants/[id]/[chatId]/not-found";
import KnowledgebaseNotFound from "@/app/(main)/knowledgebases/[id]/not-found";
import ToolNotFound from "@/app/settings/tools/[id]/not-found";
import PromptNotFound from "@/app/settings/prompts/[id]/not-found";
import SkillNotFound from "@/app/settings/skills/[id]/not-found";
import TransformAgentNotFound from "@/app/workflows/transform/[id]/not-found";
import TransformRunNotFound from "@/app/workflows/transform/[id]/[runId]/not-found";

describe("Not Found Pages", () => {
  it("renders RootNotFound with link to home", () => {
    render(<RootNotFound />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /go home/i });
    expect(link).toHaveAttribute("href", ROUTES.HOME.path);
  });

  it("renders MainNotFound with link to home", () => {
    render(<MainNotFound />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /go home/i });
    expect(link).toHaveAttribute("href", ROUTES.HOME.path);
  });

  it("renders ChatNotFound with link to chats", () => {
    render(<ChatNotFound />);
    expect(screen.getByText("Chat not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to chats/i });
    expect(link).toHaveAttribute("href", ROUTES.CHATS.path);
  });

  it("renders ProjectNotFound with link to projects", () => {
    render(<ProjectNotFound />);
    expect(screen.getByText("Project not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to projects/i });
    expect(link).toHaveAttribute("href", ROUTES.PROJECTS.path);
  });

  it("renders ProjectChatNotFound with link to projects", () => {
    render(<ProjectChatNotFound />);
    expect(screen.getByText("Project chat not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to projects/i });
    expect(link).toHaveAttribute("href", ROUTES.PROJECTS.path);
  });

  it("renders AssistantNotFound with link to assistants", () => {
    render(<AssistantNotFound />);
    expect(screen.getByText("Assistant not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to assistants/i });
    expect(link).toHaveAttribute("href", ROUTES.ASSISTANTS.path);
  });

  it("renders AssistantChatNotFound with link to assistants", () => {
    render(<AssistantChatNotFound />);
    expect(screen.getByText("Assistant chat not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to assistants/i });
    expect(link).toHaveAttribute("href", ROUTES.ASSISTANTS.path);
  });

  it("renders KnowledgebaseNotFound with link to knowledge bases", () => {
    render(<KnowledgebaseNotFound />);
    expect(screen.getByText("Knowledge base not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to knowledge bases/i });
    expect(link).toHaveAttribute("href", ROUTES.KNOWLEDGEBASES.path);
  });

  it("renders ToolNotFound with link to tools", () => {
    render(<ToolNotFound />);
    expect(screen.getByText("Tool not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to tools/i });
    expect(link).toHaveAttribute("href", ROUTES.TOOLS.path);
  });

  it("renders PromptNotFound with link to prompts", () => {
    render(<PromptNotFound />);
    expect(screen.getByText("Prompt not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to prompts/i });
    expect(link).toHaveAttribute("href", ROUTES.SETTINGS.PROMPTS.path);
  });

  it("renders SkillNotFound with link to skills", () => {
    render(<SkillNotFound />);
    expect(screen.getByText("Skill not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to skills/i });
    expect(link).toHaveAttribute("href", ROUTES.SETTINGS.SKILLS.path);
  });

  it("renders TransformAgentNotFound with link to automations", () => {
    render(<TransformAgentNotFound />);
    expect(screen.getByText("Automation not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to automations/i });
    expect(link).toHaveAttribute("href", ROUTES.WORKFLOWS.TRANSFORM.path);
  });

  it("renders TransformRunNotFound with link to automations", () => {
    render(<TransformRunNotFound />);
    expect(screen.getByText("Automation run not found")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to automations/i });
    expect(link).toHaveAttribute("href", ROUTES.WORKFLOWS.TRANSFORM.path);
  });
});
