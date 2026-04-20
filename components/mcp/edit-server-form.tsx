"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { useAppStore } from "@/lib/store";
import type { McpServer } from "@/lib/store";
import {
  updateMcpServerSchema,
  type UpdateMcpServer,
} from "@/schemas/mcp-server";
import { toast } from "sonner";

export function EditServerForm({ server }: { server: McpServer }) {
  const updateMcpServer = useAppStore((s) => s.updateMcpServer);

  const defaultValues: UpdateMcpServer =
    server.type === "stdio"
      ? {
          type: "stdio",
          name: server.name,
          command: server.command ?? "",
          args: server.args ?? "",
          env: server.env ?? "",
        }
      : {
          type: "http",
          name: server.name,
          url: server.url ?? "",
          headers: server.headers ?? "",
        };

  const form = useForm<UpdateMcpServer>({
    resolver: zodResolver(updateMcpServerSchema),
    defaultValues,
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: UpdateMcpServer) {
    try {
      await updateMcpServer(server.id, data);
      toast.success("Server configuration updated");
    } catch {
      toast.error("Failed to update server");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Configuration</CardTitle>
        <CardDescription>
          Edit the connection settings for this MCP server.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Type</span>
              <div>
                <Badge variant="secondary" className="capitalize">
                  {server.type}
                </Badge>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {server.type === "stdio" && (
              <>
                <FormField
                  control={form.control}
                  name="command"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Command</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="npx, uvx, node, python..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="args"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arguments</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='["-y", "@modelcontextprotocol/server-github"]'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        JSON array of arguments.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="env"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Environment Variables</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={'{"API_KEY": "sk-..."}'}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        JSON object of environment variables.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {server.type === "http" && (
              <>
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://mcp.example.com/sse"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="headers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headers</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={'{"Authorization": "Bearer ..."}'}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        JSON object of HTTP headers.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              <LoadingSwap isLoading={isSubmitting}>
                Save Configuration
              </LoadingSwap>
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
