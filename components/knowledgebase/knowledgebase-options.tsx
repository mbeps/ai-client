"use client";
import { Edit2 } from "lucide-react";
import { renameKnowledgebase } from "@/lib/actions/knowledgebases/rename-knowledgebase";
import type { Knowledgebase } from "@/types/knowledgebase";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { useEntityOptions } from "@/hooks/use-entity-options";

export function KnowledgebaseOptions({ kb }: { kb: Knowledgebase }) {
  const { isMobile, showRename, setShowRename, handleRename } =
    useEntityOptions({
      id: kb.id,
      type: "Knowledgebase",
      onRename: renameKnowledgebase,
      useRouterRefresh: true,
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
