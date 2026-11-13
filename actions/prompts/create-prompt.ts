"use server";

import type { z } from "zod";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { prompt } from "@/drizzle/schemas/prompt-schema";
import { requireSession } from "@/lib/auth/require-session";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createPromptSchema } from "@/schemas/prompt/prompt";
import type { CommonError } from "@/types/error/common-error";
import type { PromptRow } from "@/types/prompt/prompt-row";
import type { Result } from "@/types/result";

/**
 * Creates a new reusable prompt for slash commands (/shortcut) for the authenticated user.
 * Validates input against createPromptSchema and inserts a new prompt record.
 * Optionally scopes the prompt to a specific project or assistant, verifying user ownership.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Prompt configuration object validated against createPromptSchema (title, shortcut, content all required).
 * @returns The newly created prompt record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., required fields missing).
 * @see usePromptCommands hook for triggering prompts in chat UI.
 * @see updatePrompt to modify prompt content or shortcut.
 */
export const createPrompt = defineAction(
  async (
    data: z.infer<typeof createPromptSchema>,
  ): Promise<Result<PromptRow, CommonError>> => {
    const session = await requireSession();

    const parsed = createPromptSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }

    const validated = parsed.data;

    if (validated.projectIds && validated.projectIds.length > 0) {
      const owned = await db
        .select({ id: project.id })
        .from(project)
        .where(whereOwner(project, validated.projectIds, session.user.id));
      if (owned.length !== validated.projectIds.length) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "One or more projects not found",
        });
      }
    }

    const agentIds = validated.agentIds ?? validated.assistantIds;
    if (agentIds && agentIds.length > 0) {
      const owned = await db
        .select({ id: agent.id })
        .from(agent)
        .where(whereOwner(agent, agentIds, session.user.id));
      if (owned.length !== agentIds.length) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "One or more agents not found",
        });
      }
    }

    const [row] = await db
      .insert(prompt)
      .values({
        title: validated.title,
        shortcut: validated.shortcut,
        content: validated.content,
        projectIds: validated.projectIds,
        agentIds,
        userId: session.user.id,
      })
      .returning();

    return ok(row);
  },
);
