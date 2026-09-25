import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/project/project-options", () => ({
  ProjectOptions: () => <button type="button" aria-label="Project options">Project Options</button>,
}));

vi.mock("@/components/chat/chat-options", () => ({
  ChatOptions: () => <button type="button" aria-label="Chat options">Chat Options</button>,
}));

vi.mock("@/components/prompt/prompt-options", () => ({
  PromptOptions: () => <button type="button" aria-label="Prompt options">Prompt Options</button>,
}));

vi.mock("@/components/mcp/server-options", () => ({
  ServerOptions: () => <button type="button" aria-label="Server options">Server Options</button>,
}));

vi.mock("@/components/knowledgebase/knowledgebase-options", () => ({
  KnowledgebaseOptions: () => <button type="button" aria-label="KB options">KB Options</button>,
}));

vi.mock("@/actions/skills/delete-skill", () => ({
  deleteSkill: vi.fn(),
}));

vi.mock("@/actions/skills/toggle-skill", () => ({
  toggleSkillEnabled: vi.fn(),
}));

import { ChatCard } from "@/components/chat/chat-card";
import { KnowledgebaseCard } from "@/components/knowledgebase/knowledgebase-card";
import { ServerCard } from "@/components/mcp/server-card";
import { ProjectCard } from "@/components/project/project-card";
import { PromptCard } from "@/components/prompt/prompt-card";
import { SkillCard } from "@/components/skill/skill-card";
import { ROUTES } from "@/config/routes";
import type { Chat } from "@/types/chat/chat";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Project } from "@/types/project/project";
import type { Prompt } from "@/types/prompt/prompt";
import type { Skill } from "@/types/skill/skill";

describe("Listing Cards Next.js Link Refactoring", () => {
  describe("ProjectCard", () => {
    const mockProject: Project = {
      id: "project-123",
      name: "Alpha Project",
      description: "A test project",
      isPinned: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("renders Link with ROUTES.PROJECTS.detail", () => {
      render(<ProjectCard project={mockProject} />);

      const link = screen.getByRole("link", { name: /alpha project/i });
      expect(link).toHaveAttribute("href", ROUTES.PROJECTS.detail("project-123"));
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
      expect(screen.getByText("A test project")).toBeInTheDocument();
    });

    it("stops propagation on options menu click", async () => {
      const user = userEvent.setup();
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <ProjectCard project={mockProject} />
        </div>,
      );

      const optionsBtn = screen.getByRole("button", { name: /options/i });
      await user.click(optionsBtn);
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe("ChatCard", () => {
    const baseChat: Chat = {
      id: "chat-123",
      title: "Design Discussion",
      projectId: undefined,
      assistantId: undefined,
      knowledgebaseId: null,
      messages: {},
      currentLeafId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("renders Link to standalone chat when neither project nor assistant is set", () => {
      render(<ChatCard chat={baseChat} />);

      const link = screen.getByRole("link", { name: /design discussion/i });
      expect(link).toHaveAttribute("href", ROUTES.CHATS.detail("chat-123"));
      expect(screen.getByText("Standalone Chat")).toBeInTheDocument();
    });

    it("renders Link to project chat when projectId is present", () => {
      render(
        <ChatCard
          chat={{ ...baseChat, id: "chat-456", projectId: "proj-789" }}
        />,
      );

      const link = screen.getByRole("link", { name: /design discussion/i });
      expect(link).toHaveAttribute("href", ROUTES.PROJECTS.chat("proj-789", "chat-456"));
      expect(screen.getByText("Project Chat")).toBeInTheDocument();
    });

    it("renders Link to assistant chat when assistantId is present", () => {
      render(
        <ChatCard
          chat={{ ...baseChat, id: "chat-789", assistantId: "asst-999" }}
        />,
      );

      const link = screen.getByRole("link", { name: /design discussion/i });
      expect(link).toHaveAttribute("href", ROUTES.ASSISTANTS.chat("asst-999", "chat-789"));
      expect(screen.getByText("Assistant Chat")).toBeInTheDocument();
    });

    it("stops propagation on options menu click and keydown", async () => {
      const user = userEvent.setup();
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <ChatCard chat={baseChat} />
        </div>,
      );

      const optionsBtn = screen.getByRole("button", { name: /options/i });
      await user.click(optionsBtn);
      expect(parentClick).not.toHaveBeenCalled();

      fireEvent.keyDown(optionsBtn, { key: "Enter" });
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe("PromptCard", () => {
    const mockPrompt: Prompt = {
      id: "prompt-123",
      title: "Refactor Code",
      shortcut: "refactor",
      content: "Please refactor the following code",
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("renders Link with ROUTES.SETTINGS.PROMPTS.detail", () => {
      render(<PromptCard prompt={mockPrompt} />);

      const link = screen.getByRole("link", { name: /refactor code/i });
      expect(link).toHaveAttribute("href", ROUTES.SETTINGS.PROMPTS.detail("prompt-123"));
      expect(screen.getByText("Refactor Code")).toBeInTheDocument();
      expect(screen.getByText("/refactor")).toBeInTheDocument();
    });

    it("stops propagation on options menu click and keydown", async () => {
      const user = userEvent.setup();
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <PromptCard prompt={mockPrompt} />
        </div>,
      );

      const optionsBtn = screen.getByRole("button", { name: /options/i });
      await user.click(optionsBtn);
      expect(parentClick).not.toHaveBeenCalled();

      fireEvent.keyDown(optionsBtn, { key: "Enter" });
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe("ServerCard", () => {
    const mockServer: McpServer = {
      id: "server-123",
      name: "GitHub Tools",
      url: "https://api.github.com",
      enabled: true,
      isInstalled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("renders Link with ROUTES.TOOLS.detail", () => {
      render(<ServerCard server={mockServer} />);

      const link = screen.getByRole("link", { name: /github tools/i });
      expect(link).toHaveAttribute("href", ROUTES.TOOLS.detail("server-123"));
      expect(screen.getByText("GitHub Tools")).toBeInTheDocument();
      expect(screen.getByText("https://api.github.com")).toBeInTheDocument();
    });

    it("stops propagation on options menu click and keydown", async () => {
      const user = userEvent.setup();
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <ServerCard server={mockServer} />
        </div>,
      );

      const optionsBtn = screen.getByRole("button", { name: /options/i });
      await user.click(optionsBtn);
      expect(parentClick).not.toHaveBeenCalled();

      fireEvent.keyDown(optionsBtn, { key: "Enter" });
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe("KnowledgebaseCard", () => {
    const mockKb: Knowledgebase = {
      id: "kb-123",
      name: "Product Documentation",
      description: "Company knowledge base",
      indexStatus: "ready",
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("renders Link with ROUTES.KNOWLEDGEBASES.detail", () => {
      render(<KnowledgebaseCard knowledgebase={mockKb} />);

      const link = screen.getByRole("link", { name: /product documentation/i });
      expect(link).toHaveAttribute("href", ROUTES.KNOWLEDGEBASES.detail("kb-123"));
      expect(screen.getByText("Product Documentation")).toBeInTheDocument();
      expect(screen.getByText("Company knowledge base")).toBeInTheDocument();
    });

    it("stops propagation on options menu click and keydown", async () => {
      const user = userEvent.setup();
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <KnowledgebaseCard knowledgebase={mockKb} />
        </div>,
      );

      const optionsBtn = screen.getByRole("button", { name: /options/i });
      await user.click(optionsBtn);
      expect(parentClick).not.toHaveBeenCalled();

      fireEvent.keyDown(optionsBtn, { key: "Enter" });
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe("SkillCard", () => {
    const mockSkill: Skill = {
      id: "skill-123",
      name: "commit-helper",
      displayName: "Commit Helper",
      description: "Generates git commit messages",
      enabled: true,
      files: ["instructions.md"],
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("renders Link with ROUTES.SETTINGS.SKILLS.detail", () => {
      render(<SkillCard skill={mockSkill} />);

      const link = screen.getByRole("link", { name: /commit helper/i });
      expect(link).toHaveAttribute("href", ROUTES.SETTINGS.SKILLS.detail("skill-123"));
      expect(screen.getByText("Commit Helper")).toBeInTheDocument();
      expect(screen.getByText("/commit-helper")).toBeInTheDocument();
    });

    it("stops propagation on toggle switch and delete button click and keydown", async () => {
      const user = userEvent.setup();
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <SkillCard skill={mockSkill} />
        </div>,
      );

      const switchBtn = screen.getByRole("switch", { name: "Toggle skill" });
      await user.click(switchBtn);
      expect(parentClick).not.toHaveBeenCalled();

      const deleteBtn = screen.getByRole("button");
      await user.click(deleteBtn);
      expect(parentClick).not.toHaveBeenCalled();

      fireEvent.keyDown(switchBtn, { key: "Enter" });
      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
