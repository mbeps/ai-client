import { renameKnowledgebase as renameKnowledgebaseAction } from "@/lib/actions/knowledgebases/rename-knowledgebase";
import { EntitySet } from "../types";

/** Renames knowledge base in DB and updates store. */
export const renameKnowledgebaseDb =
  (set: EntitySet) => async (id: string, name: string) => {
    const updated = await renameKnowledgebaseAction(id, name);
    set((state) => ({
      knowledgebases: state.knowledgebases.map((kb) =>
        kb.id === id
          ? {
              ...kb,
              name: updated.name,
              updatedAt: new Date(updated.updatedAt),
            }
          : kb,
      ),
    }));
  };
