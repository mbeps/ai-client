"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Globe, Plus, Server, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PublicServerDiscovery } from "@/components/mcp/public-server-discovery";
import { ServerFormFields } from "@/components/mcp/server-form-fields";
import { PageHeader } from "@/components/page-header";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { ROUTES } from "@/constants/routes";
import { createMcpServer } from "@/lib/actions/mcp-servers/create-mcp-server";
import { useAppStore } from "@/lib/store";
import {
  type CreateMcpServer,
  createMcpServerSchema,
} from "@/schemas/providers/mcp-server";

const DEFAULTS: CreateMcpServer = {
  name: "",
  url: "",
  headers: "",
  isPublic: false,
};

/**
 * Dedicated page for adding a new Model Context Protocol (MCP) server or discovering community tools.
 * Replaces the previous modal dialogs with a full-page, spacious layout.
 *
 * @author Maruf Bepary
 */
export default function NewMcpServerPage() {
  const router = useRouter();
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("manual").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const form = useForm<CreateMcpServer>({
    resolver: zodResolver(createMcpServerSchema),
    defaultValues: DEFAULTS,
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: CreateMcpServer) {
    try {
      await createMcpServer(data);
      toast.success("MCP server added");
      await loadMcpServers();
      router.push(ROUTES.SETTINGS.TOOLS.path);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add MCP server";
      toast.error(message);
    }
  }

  return (
    <div className="page-container mx-auto max-w-4xl py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => router.push(ROUTES.SETTINGS.TOOLS.path)}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Tools
      </Button>

      <PageHeader
        icon={<Server className="h-8 w-8 text-primary" />}
        title="Add MCP Server"
        description="Connect a Model Context Protocol server or discover community-shared tools."
      />

      <SidebarTabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-6 w-full"
      >
        <SidebarTabsList>
          <SidebarTabsTrigger value="manual">
            <Plus className="mr-2 h-4 w-4" />
            <span>Manual Configuration</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="discover">
            <Globe className="mr-2 h-4 w-4" />
            <span>Public Tools</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="manual" className="space-y-6">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Server Configuration</h3>
            <p className="text-muted-foreground text-sm">
              Configure connection parameters and custom authentication headers
              for an HTTP MCP endpoint.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <ServerFormFields form={form} />

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(ROUTES.SETTINGS.TOOLS.path)}
                  disabled={isSubmitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <LoadingSwap isLoading={isSubmitting}>
                    <div className="flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Server
                    </div>
                  </LoadingSwap>
                </Button>
              </div>
            </form>
          </Form>
        </SidebarTabsContent>

        <SidebarTabsContent value="discover" className="space-y-6">
          <PublicServerDiscovery
            onSuccess={() => {
              router.push(ROUTES.SETTINGS.TOOLS.path);
            }}
          />
        </SidebarTabsContent>
      </SidebarTabs>
    </div>
  );
}
