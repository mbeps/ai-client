"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Trash2, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { ROUTES } from "@/lib/routes";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import type { Knowledgebase } from "@/lib/store";

/**
 * Internal options menu for a knowledgebase card.
 * Renders as a Drawer on mobile and a DropdownMenu on desktop.
 * Provides a Delete Knowledgebase action.
 */
function KnowledgebaseOptions({ kb }: { kb: Knowledgebase }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{kb.name}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4">
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Knowledgebase
            </Button>
          </div>
          <DrawerFooter className="pt-2">
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Knowledgebase
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Props for the KnowledgebaseCard component.
 *
 * @author Maruf Bepary
 */
interface KnowledgebaseCardProps {
  /** The knowledgebase entity to display. */
  knowledgebase: Knowledgebase;
}

/**
 * Card representing a single knowledgebase in the knowledgebases listing page.
 * Navigates to the knowledgebase detail page on click and shows a storage capacity
 * progress bar along with an options menu with a Delete action.
 *
 * @param props.knowledgebase - The knowledgebase to display.
 * @author Maruf Bepary
 */
export function KnowledgebaseCard({
  knowledgebase: kb,
}: KnowledgebaseCardProps) {
  const router = useRouter();

  return (
    <Card
      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex flex-col justify-between min-h-[100px]"
      onClick={() => router.push(ROUTES.KNOWLEDGEBASES.detail(kb.id))}
    >
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="font-semibold leading-none truncate">{kb.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {kb.description}
            </p>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <KnowledgebaseOptions kb={kb} />
        </div>
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="flex justify-between text-[11px] mb-1 font-medium">
          <span>
            {((kb.sizeBytes / kb.maxSizeBytes) * 100).toFixed(1)}% Used
          </span>
          <span className="text-muted-foreground">
            {((1 - kb.sizeBytes / kb.maxSizeBytes) * 100).toFixed(1)}% Available
          </span>
        </div>
        <Progress
          value={Math.min(100, (kb.sizeBytes / kb.maxSizeBytes) * 100)}
          className="h-1.5"
        />
      </div>
    </Card>
  );
}
