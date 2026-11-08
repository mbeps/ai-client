"use client";

import {
  ExternalLink,
  Key,
  Loader2,
  ShieldCheck,
  ShieldOff,
  X,
} from "lucide-react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/**
 * Props for ServerFormFields component.
 *
 * @interface ServerFormFieldsProps
 * @template T - React Hook Form field values type
 */
export interface ServerFormFieldsProps<T extends FieldValues> {
  /** React Hook Form instance managing form state. */
  form: UseFormReturn<T>;
  /** Apply bg-background and font-mono to inputs (edit form style). Default false. */
  styled?: boolean;
  /** Custom placeholder for the headers textarea. */
  headerPlaceholder?: string;
  /** Whether the server is an installed community tool (read-only name/url/isPublic). */
  isInstalled?: boolean;
  /** Whether to show the public server sharing toggle. Default true. */
  showPublicToggle?: boolean;
  /** ID of the server being edited, if already saved. */
  serverId?: string;
  /** Whether OAuth 2.1 is currently connected for the authenticated user. */
  oauthConnected?: boolean;
  /** Callback to initiate OAuth authorization flow. */
  onOAuthConnect?: () => Promise<void> | void;
  /** Callback to disconnect OAuth credentials. */
  onOAuthDisconnect?: () => Promise<void> | void;
  /** Whether OAuth connect action is pending. */
  isOAuthConnecting?: boolean;
  /** Whether OAuth disconnect action is pending. */
  isOAuthDisconnecting?: boolean;
}

/**
 * Renders shared form fields for MCP server configuration.
 * Includes connection fields (name, url), horizontal segmented auth tabs (No Auth, Custom Headers, OAuth 2.1)
 * with mobile-responsive trigger layout, an advanced accordion for headers and OAuth credentials,
 * and public sharing toggle.
 *
 * @template T - React Hook Form field values type
 * @param props - Component props
 * @author Maruf Bepary
 */
export function ServerFormFields<T extends FieldValues>({
  form,
  styled = false,
  headerPlaceholder,
  isInstalled = false,
  showPublicToggle = true,
  serverId,
  oauthConnected = false,
  onOAuthConnect,
  onOAuthDisconnect,
  isOAuthConnecting = false,
  isOAuthDisconnecting = false,
}: ServerFormFieldsProps<T>) {
  const inputClass = styled ? "bg-background font-mono" : undefined;
  const textareaClass = styled
    ? "font-mono text-sm bg-background min-h-[120px] resize-y"
    : "font-mono text-sm";

  const control = form.control as any;
  const authTypeValue =
    (form.watch("authType" as Path<T>) as string | undefined) ?? "none";

  return (
    <>
      <FormField
        control={control}
        name={"name" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                placeholder="My MCP Server"
                {...field}
                disabled={isInstalled}
                className={inputClass}
              />
            </FormControl>
            {isInstalled && (
              <FormDescription className="text-xs">
                Managed by the upstream community server.
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={"url" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Endpoint URL</FormLabel>
            <FormControl>
              <Input
                placeholder="https://mcp.example.com/sse"
                {...field}
                disabled={isInstalled}
                className={inputClass}
              />
            </FormControl>
            {isInstalled && (
              <FormDescription className="text-xs">
                Managed by the upstream community server.
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Authentication Selection Tabs */}
      <FormField
        control={control}
        name={"authType" as Path<T>}
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Authentication Method</FormLabel>
            <FormControl>
              <Tabs
                value={field.value ?? "none"}
                onValueChange={field.onChange}
                className="w-full"
              >
                <TabsList className="bg-muted grid h-auto w-full grid-cols-3 p-1">
                  <TabsTrigger
                    value="none"
                    className="data-[state=active]:bg-background flex flex-col items-center gap-1 py-2 text-xs sm:flex-row sm:gap-2 sm:py-1.5 sm:text-sm"
                  >
                    <ShieldOff className="size-4 shrink-0" />
                    <span>No Auth</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="headers"
                    className="data-[state=active]:bg-background flex flex-col items-center gap-1 py-2 text-xs sm:flex-row sm:gap-2 sm:py-1.5 sm:text-sm"
                  >
                    <Key className="size-4 shrink-0" />
                    <span>Custom Headers</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="oauth"
                    className="data-[state=active]:bg-background flex flex-col items-center gap-1 py-2 text-xs sm:flex-row sm:gap-2 sm:py-1.5 sm:text-sm"
                  >
                    <ShieldCheck className="size-4 shrink-0" />
                    <span>OAuth 2.1</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </FormControl>
            <FormDescription className="text-xs">
              Select how authentication credentials should be provided to this
              server.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* OAuth Specific Status & Action Banner */}
      {authTypeValue === "oauth" && (
        <div className="bg-muted/50 flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">OAuth Status</span>
              {oauthConnected ? (
                <Badge
                  variant="default"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {serverId
                ? oauthConnected
                  ? "OAuth tokens are active and automatically refreshed."
                  : "Authorize your account with the remote MCP server to use tools."
                : "Save server configuration first to initiate OAuth authorization."}
            </p>
          </div>

          {serverId && (
            <div className="flex shrink-0 items-center gap-2">
              {oauthConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isOAuthDisconnecting}
                  onClick={onOAuthDisconnect}
                  className="text-xs"
                >
                  {isOAuthDisconnecting ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <X className="mr-1.5 size-3.5" />
                  )}
                  Disconnect
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isOAuthConnecting}
                  onClick={onOAuthConnect}
                  className="text-xs"
                >
                  {isOAuthConnecting ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-1.5 size-3.5" />
                  )}
                  Connect Account
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Advanced Accordion: Headers & OAuth Configuration */}
      <Accordion
        type="single"
        collapsible
        defaultValue="advanced-settings"
        className="w-full"
      >
        <AccordionItem value="advanced-settings" className="border-none">
          <AccordionTrigger className="hover:text-foreground text-muted-foreground py-2 text-sm font-medium">
            Advanced Settings
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {authTypeValue === "oauth" && (
              <>
                <FormField
                  control={control}
                  name={"oauthClientId" as Path<T>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Leave empty for dynamic client registration"
                          {...field}
                          value={field.value ?? ""}
                          disabled={isInstalled}
                          className={inputClass}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Pre-registered OAuth client ID. Leave blank if the
                        server supports Dynamic Client Registration (RFC 7591)
                        or Client ID Metadata Documents.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={"oauthClientSecret" as Path<T>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Secret (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={
                            isInstalled
                              ? "Installed server client secret"
                              : "Leave empty to keep existing or if not required"
                          }
                          {...field}
                          value={field.value ?? ""}
                          className={inputClass}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Pre-registered client secret. Encrypted at rest using
                        AES-256-GCM.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={"oauthScope" as Path<T>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Scope (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. read write"
                          {...field}
                          value={field.value ?? ""}
                          disabled={isInstalled}
                          className={inputClass}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        OAuth 2.0 authorization scope string.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Custom Headers under Accordion */}
            <FormField
              control={control}
              name={"headers" as Path<T>}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Headers</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        headerPlaceholder ?? '{"Authorization": "Bearer ..."}'
                      }
                      className={textareaClass}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {isInstalled
                      ? "Your personal HTTP headers (such as API keys) used when connecting to this tool."
                      : "JSON object of HTTP headers for authentication or context."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {!isInstalled && showPublicToggle && (
        <div className="mt-4 border-t pt-4">
          <FormField
            control={control}
            name={"isPublic" as Path<T>}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Public Server</FormLabel>
                  <FormDescription>
                    Share this server configuration with the community.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}
    </>
  );
}
