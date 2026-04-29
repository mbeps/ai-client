import { createPrompt as createPromptAction } from "@/lib/actions/prompts/create-prompt";
import { deletePrompt as deletePromptAction } from "@/lib/actions/prompts/delete-prompt";
import { updatePrompt as updatePromptAction } from "@/lib/actions/prompts/update-prompt";
import { listPrompts as listPromptsAction } from "@/lib/actions/prompts/list-prompts";
import { promptRowToStore } from "../../../mappers/prompt";
import { EntitySet } from "../types";

/** Fetches all prompts and loads them into store. */
export const loadPrompts = (set: EntitySet) => async () => {
  const rows = await listPromptsAction();
  set({ prompts: rows.map(promptRowToStore) });
};

/** Creates prompt in DB and adds to store. Returns new prompt ID. */
export const createPromptDb =
  (set: EntitySet) =>
  async (data: { title: string; shortcut: string; content: string }) => {
    const row = await createPromptAction(data);
    set((state) => ({ prompts: [promptRowToStore(row), ...state.prompts] }));
    return row.id;
  };

/** Updates prompt in DB and store. */
export const updatePromptDb =
  (set: EntitySet) =>
  async (
    id: string,
    data: { title?: string; shortcut?: string; content?: string },
  ) => {
    const row = await updatePromptAction(id, data);
    set((state) => ({
      prompts: state.prompts.map((p) =>
        p.id === id ? { ...p, ...promptRowToStore(row) } : p,
      ),
    }));
  };

/** Deletes prompt from DB and store. */
export const deletePromptDb = (set: EntitySet) => async (id: string) => {
  await deletePromptAction(id);
  set((state) => ({
    prompts: state.prompts.filter((p) => p.id !== id),
  }));
};
