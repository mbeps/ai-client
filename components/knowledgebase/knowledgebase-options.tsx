"use client";
import { Edit2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Knowledgebase } from "@/types/knowledgebase";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { useEntityOptions } from "@/hooks/use-entity-options";

export function KnowledgebaseOptions({ kb }: { kb: Knowledgebase }) {
  const renameKnowledgebaseDb = useAppStore(
    (state) => state.renameKnowledgebaseDb,
  );

  const { isMobile, showRename, setShowRename, handleRename } =
    useEntityOptions({
      id: kb.id,
      type: "Knowledgebase",
      onRename: (id, name) => renameKnowledgebaseDb(id, name),
    });

  const items = [
    {
      label: "Rename Knowledgebase",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
  ];

  return (
    <>
      <ResponsiveMenu title={kb.name} items={items} isMobile={isMobile} />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={kb.name}
        onConfirm={handleRename}
        title="Rename Knowledgebase"
      />
    </>
  );
}
