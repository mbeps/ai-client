"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Wrench, 
  Database, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  Check,
  ListChecks,
  CheckSquare,
  Square,
  X
} from "lucide-react";
import type { McpServer } from "@/types/mcp-server";
import { discoverMcpServerTools } from "@/lib/actions/mcp-servers/discover-tools";
import type { DiscoveredTool, DiscoveredResource } from "@/lib/mcp/discover-tools";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ToolPickerDialogProps {
  servers: McpServer[];
  selectedTools: Set<string>;
  selectedResources: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onToggleResource: (serverId: string, resourceUri: string) => void;
  onBulkSelect: (serverId: string, toolNames: string[], resourceUris: string[], select: boolean) => void;
  trigger?: React.ReactNode;
}

type ServerContent = {
  tools: DiscoveredTool[];
  resources: DiscoveredResource[];
  loading: boolean;
  error: string | null;
};

export function ToolPickerDialog({
  servers,
  selectedTools,
  selectedResources,
  onToggleTool,
  onToggleResource,
  onBulkSelect,
  trigger,
}: ToolPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [serverContent, setServerContent] = useState<Record<string, ServerContent>>({});
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

  const fetchServerContent = async (server: McpServer) => {
    setServerContent((prev) => ({
      ...prev,
      [server.id]: { ...prev[server.id], loading: true, error: null },
    }));

    try {
      const result = await discoverMcpServerTools(server.id);
      setServerContent((prev) => ({
        ...prev,
        [server.id]: { 
          tools: result.tools, 
          resources: result.resources, 
          loading: false, 
          error: null 
        },
      }));
    } catch (err) {
      setServerContent((prev) => ({
        ...prev,
        [server.id]: { 
          tools: [], 
          resources: [], 
          loading: false, 
          error: err instanceof Error ? err.message : "Failed to load" 
        },
      }));
    }
  };

  useEffect(() => {
    if (open) {
      servers.forEach((server) => {
        if (!serverContent[server.id]) {
          fetchServerContent(server);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, servers]);

  const toggleExpand = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });
  };

  const filteredServers = useMemo(() => {
    if (!search) return servers;
    const lowerSearch = search.toLowerCase();
    return servers.filter((server) => {
      const content = serverContent[server.id];
      const nameMatch = server.name.toLowerCase().includes(lowerSearch);
      const toolMatch = content?.tools.some(t => t.name.toLowerCase().includes(lowerSearch) || t.description.toLowerCase().includes(lowerSearch));
      const resourceMatch = content?.resources.some(r => r.name.toLowerCase().includes(lowerSearch) || r.description.toLowerCase().includes(lowerSearch));
      return nameMatch || toolMatch || resourceMatch;
    });
  }, [servers, search, serverContent]);

  const allDiscoveredTools = useMemo(() => {
    const mcpTools = servers.flatMap(s => (serverContent[s.id]?.tools || []).map(t => ({ serverId: s.id, name: t.name })));
    return [{ serverId: "internal", name: "manage_artifact" }, ...mcpTools];
  }, [servers, serverContent]);

  const allDiscoveredResources = useMemo(() => {
    return servers.flatMap(s => (serverContent[s.id]?.resources || []).map(r => ({ serverId: s.id, uri: r.uri })));
  }, [servers, serverContent]);

  const isAllSelected = useMemo(() => {
    if (allDiscoveredTools.length === 0 && allDiscoveredResources.length === 0) return false;
    const toolsSelected = allDiscoveredTools.every(t => selectedTools.has(`${t.serverId}:tool:${t.name}`));
    const resSelected = allDiscoveredResources.every(r => selectedResources.has(`${r.serverId}:resource:${r.uri}`));
    return toolsSelected && resSelected;
  }, [allDiscoveredTools, allDiscoveredResources, selectedTools, selectedResources]);

  const toggleAll = () => {
    const shouldSelect = !isAllSelected;
    onBulkSelect("internal", ["manage_artifact"], [], shouldSelect);
    servers.forEach(s => {
      const content = serverContent[s.id];
      if (content) {
        onBulkSelect(
          s.id, 
          content.tools.map(t => t.name), 
          content.resources.map(r => r.uri), 
          shouldSelect
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Wrench className="h-4 w-4" />
            Select Tools
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>Select Tools & Resources</DialogTitle>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-2"
              onClick={toggleAll}
              disabled={allDiscoveredTools.length === 0 && allDiscoveredResources.length === 0}
            >
              {isAllSelected ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
              {isAllSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools and resources..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6 py-4 min-h-0">
          <div className="space-y-4">
            {(!search || "artifacts canvas manage_artifact".includes(search.toLowerCase())) && (
              <div className="border rounded-lg overflow-hidden flex flex-col border-primary/20">
                <div 
                  className="flex items-center justify-between p-3 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors shrink-0"
                  onClick={() => toggleExpand("internal")}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="flex items-center" 
                      onClick={(e) => {
                        e.stopPropagation();
                        const isAllSelected = selectedTools.has("internal:tool:manage_artifact");
                        onBulkSelect("internal", ["manage_artifact"], [], !isAllSelected);
                      }}
                    >
                      <Checkbox 
                        checked={selectedTools.has("internal:tool:manage_artifact")}
                        className="h-4 w-4"
                      />
                    </div>
                    {expandedServers.has("internal") || search.length > 0 ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
                    <span className="font-medium text-primary">Internal Tools</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase bg-primary/10 text-primary">
                      built-in
                    </Badge>
                  </div>
                </div>

                {(expandedServers.has("internal") || search.length > 0) && (
                  <div className="p-3 space-y-4 border-t border-primary/20 bg-card/50">
                    <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <label
                            className="flex items-start gap-2 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer group"
                          >
                            <Checkbox
                              checked={selectedTools.has("internal:tool:manage_artifact")}
                              onCheckedChange={() => onToggleTool("internal", "manage_artifact")}
                              className="mt-0.5"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium truncate">Artifacts / Canvas</span>
                              <span className="text-[10px] text-muted-foreground line-clamp-2">
                                Allows the AI to generate interactive Markdown, Spreadsheets, HTML UI, and Mermaid diagrams in a side panel.
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {filteredServers.length === 0 && (!search || !"artifacts canvas manage_artifact".includes(search.toLowerCase())) ? (
              <div className="text-center py-8 text-muted-foreground">
                No servers or tools found matching &quot;{search}&quot;
              </div>
            ) : (
              filteredServers.map((server) => {
                const content = serverContent[server.id];
                const isExpanded = expandedServers.has(server.id) || search.length > 0;
                
                const serverTools = content?.tools || [];
                const serverResources = content?.resources || [];
                
                const selectedInServer = 
                  serverTools.filter(t => selectedTools.has(`${server.id}:tool:${t.name}`)).length +
                  serverResources.filter(r => selectedResources.has(`${server.id}:resource:${r.uri}`)).length;
                
                const totalInServer = serverTools.length + serverResources.length;
                const isServerAllSelected = totalInServer > 0 && selectedInServer === totalInServer;

                return (
                  <div key={server.id} className="border rounded-lg overflow-hidden flex flex-col">
                    <div 
                      className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
                      onClick={() => toggleExpand(server.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="flex items-center" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onBulkSelect(
                              server.id, 
                              serverTools.map(t => t.name), 
                              serverResources.map(r => r.uri), 
                              !isServerAllSelected
                            );
                          }}
                        >
                          <Checkbox 
                            checked={isServerAllSelected}
                            className="h-4 w-4"
                          />
                        </div>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-medium">{server.name}</span>
                        {selectedInServer > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {selectedInServer} selected
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {content?.loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        {content?.error && <AlertCircle className="h-3 w-3 text-destructive" />}
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {server.type}
                        </Badge>
                      </div>
                    </div>

                    {(isExpanded || search.length > 0) && (
                      <div className="p-3 space-y-4 border-t bg-card/50">
                        {content?.loading ? (
                          <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Discovering tools...
                          </div>
                        ) : content?.error ? (
                          <div className="flex items-center justify-between py-2 text-sm text-destructive">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              <span>{content.error}</span>
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 gap-1"
                              onClick={() => fetchServerContent(server)}
                            >
                              <RefreshCw className="h-3 w-3" /> Retry
                            </Button>
                          </div>
                        ) : (
                          <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {/* Tools section */}
                            {serverTools.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5 px-1 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                                  <Wrench className="h-3 w-3" /> Tools
                                </h4>
                                <div className="flex flex-col gap-1">
                                  {serverTools
                                    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
                                    .map((tool) => {
                                      const toolId = `${server.id}:tool:${tool.name}`;
                                      const isChecked = selectedTools.has(toolId);
                                      return (
                                        <label
                                          key={tool.name}
                                          className="flex items-start gap-2 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer group"
                                        >
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => onToggleTool(server.id, tool.name)}
                                            className="mt-0.5"
                                          />
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-medium truncate">{tool.name}</span>
                                            {tool.description && (
                                              <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                {tool.description}
                                              </span>
                                            )}
                                          </div>
                                        </label>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {/* Resources section */}
                            {serverResources.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-dashed">
                                <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5 px-1 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                                  <Database className="h-3 w-3" /> Resources
                                </h4>
                                <div className="flex flex-col gap-1">
                                  {serverResources
                                    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()))
                                    .map((res) => {
                                      const resId = `${server.id}:resource:${res.uri}`;
                                      const isChecked = selectedResources.has(resId);
                                      return (
                                        <label
                                          key={res.uri}
                                          className="flex items-start gap-2 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer"
                                        >
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => onToggleResource(server.id, res.uri)}
                                            className="mt-0.5"
                                          />
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-medium truncate">{res.name}</span>
                                            {res.description && (
                                              <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                {res.description}
                                              </span>
                                            )}
                                          </div>
                                        </label>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {serverTools.length === 0 && serverResources.length === 0 && (
                              <div className="text-xs text-muted-foreground py-2 text-center">
                                No tools or resources available
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t flex items-end justify-between bg-muted/20 shrink-0">
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5" />
              <span><strong>{selectedTools.size}</strong> tools selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5" />
              <span><strong>{selectedResources.size}</strong> resources selected</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setOpen(false)} 
              size="sm"
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button 
              onClick={() => setOpen(false)} 
              size="sm"
              className="gap-2 px-6"
            >
              <Check className="h-4 w-4" />
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
