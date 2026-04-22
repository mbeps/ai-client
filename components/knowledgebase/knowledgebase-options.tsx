"use client";

import { useState } from "react";
import { Trash2, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
import type { Knowledgebase } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export function KnowledgebaseOptions({ kb }: { kb: Knowledgebase }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [showRename, setShowRename] = useState(false);

  const renameKnowledgebaseDb = useAppStore(
    (state) => state.renameKnowledgebaseDb,
  );

  const handleRename = async (newName: string) => {
    try {
      await renameKnowledgebaseDb(kb.id, newName);
      toast.success("Knowledgebase renamed");
    } catch (error) {
      toast.error("Failed to rename knowledgebase");
      throw error;
    }
  };

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
