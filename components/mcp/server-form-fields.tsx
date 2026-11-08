"use client";

import {
  ExternalLink,
  Key,
  Loader2,
  ShieldCheck,
  ShieldOff,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
  HeaderPairsEditor,
  type HeaderPair,
} from "@/components/mcp/header-pairs-editor";
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
 * Safely parses raw JSON headers string into structured API key and custom header pairs.
 *
 * @param rawHeaders - Raw JSON string or null/undefined
 * @returns Structured header data
 */
function parseInitialHeaders(rawHeaders?: string | null): {
  apiKey: string;
  keyHeaderName: string;
  pairs: HeaderPair[];
} {
  if (!rawHeaders || typeof rawHeaders !== "string" || !rawHeaders.trim()) {
    return { apiKey: "", keyHeaderName: "Authorization", pairs: [] };
  }

  try {
    const parsed = JSON.parse(rawHeaders);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { apiKey: "", keyHeaderName: "Authorization", pairs: [] };
    }

    let apiKey = "";
    let keyHeaderName = "Authorization";
    const pairs: HeaderPair[] = [];

    const entries = Object.entries(parsed) as [string, unknown][];

    // Check for authorization or common api-key header
    const authEntry = entries.find(
      ([k]) =>
        k.toLowerCase() === "authorization" ||
        k.toLowerCase() === "x-api-key" ||
        k.toLowerCase() === "api-key",
    );

    if (authEntry && typeof authEntry[1] === "string") {
      keyHeaderName = authEntry[0];
      if (keyHeaderName.toLowerCase() === "authorization") {
        apiKey = authEntry[1].replace(/^bearer\s+/i, "");
      } else {
        apiKey = authEntry[1];
      }
    }

    for (const [k, v] of entries) {
      if (authEntry && k === authEntry[0]) continue;
      if (typeof v === "string") {
        pairs.push({
          id: crypto.randomUUID(),
          key: k,
          value: v,
        });
      }
    }

    return { apiKey, keyHeaderName, pairs };
  } catch {
    return { apiKey: "", keyHeaderName: "Authorization", pairs: [] };
  }
}

/**
 * Serializes API key, header name, and custom header pairs into a JSON headers string.
 *
 * @param key - The secret API key / token
 * @param headerName - The HTTP header name (defaults to Authorization)
 * @param pairs - Additional custom header pairs
 * @returns Serialized JSON string or empty string
 */
function serializeHeaders(
  key: string,
  headerName: string,
  pairs: HeaderPair[],
): string {
  const record: Record<string, string> = {};

  const trimmedKey = key.trim();
  const trimmedName = headerName.trim() || "Authorization";
  if (trimmedKey) {
    if (trimmedName.toLowerCase() === "authorization") {
      const value = /^bearer\s+/i.test(trimmedKey)
        ? trimmedKey
        : `Bearer ${trimmedKey}`;
      record[trimmedName] = value;
    } else {
      record[trimmedName] = trimmedKey;
    }
  }

  for (const pair of pairs) {
    const pKey = pair.key.trim();
    const pVal = pair.value.trim();
    if (pKey && pVal) {
      record[pKey] = pVal;
    }
  }

  if (Object.keys(record).length === 0) {
    return "";
  }

  return JSON.stringify(record);
}

/**
 * Renders shared form fields for MCP server configuration.
 * Includes connection fields (name, url), horizontal segmented auth tabs (No Auth, API Key, OAuth 2.1)
 * with mobile-responsive trigger layout, direct API key field with collapsible advanced header settings,
 * an advanced accordion for optional OAuth 2.1 credentials, and public sharing toggle.
 * No advanced settings or headers are shown for No Auth.
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

  const control = form.control as any;
  const authTypeValue =
    (form.watch("authType" as Path<T>) as string | undefined) ?? "none";

  const initial = useMemo(
    () => parseInitialHeaders(form.getValues("headers" as Path<T>)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [keyHeaderName, setKeyHeaderName] = useState(initial.keyHeaderName);
  const [headerPairs, setHeaderPairs] = useState<HeaderPair[]>(initial.pairs);

  function updateSerializedHeaders(
    nextKey: string,
    nextName: string,
    nextPairs: HeaderPair[],
  ) {
    const serialized = serializeHeaders(nextKey, nextName, nextPairs);
    form.setValue("headers" as Path<T>, serialized as any, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleApiKeyChange(val: string) {
    setApiKey(val);
    updateSerializedHeaders(val, keyHeaderName, headerPairs);
  }

  function handleHeaderNameChange(val: string) {
    setKeyHeaderName(val);
    updateSerializedHeaders(apiKey, val, headerPairs);
  }

  function handleHeaderPairsChange(pairs: HeaderPair[]) {
    setHeaderPairs(pairs);
    updateSerializedHeaders(apiKey, keyHeaderName, pairs);
  }

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
                onValueChange={(val) => {
                  field.onChange(val);
                  if (val === "none") {
                    form.setValue("headers" as Path<T>, "" as any, {
                      shouldDirty: true,
                    });
                    setApiKey("");
                    setHeaderPairs([]);
                  }
                }}
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
                    <span>API Key</span>
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

      {/* API Key Configuration: prominent key field with collapsed advanced headers */}
      {authTypeValue === "headers" && (
        <div className="space-y-4">
          <FormItem>
            <FormLabel>API Key</FormLabel>
            <FormControl>
              <Input
                type="password"
                placeholder={
                  headerPlaceholder ?? "Enter API key or token (e.g. sk-...)"
                }
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                disabled={isInstalled}
                className={inputClass}
                autoComplete="off"
              />
            </FormControl>
            <FormDescription className="text-xs">
              {headerPlaceholder
                ? "Your API key is saved. Enter a new key only if you want to replace it."
                : "Enter your secret API key or token used to authenticate requests to this MCP server."}
            </FormDescription>
            <FormMessage />
          </FormItem>

          {/* Advanced Settings Accordion for API Key headers */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="advanced-headers" className="border-none">
              <AccordionTrigger className="hover:text-foreground text-muted-foreground py-2 text-sm font-medium">
                Advanced Settings
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <FormItem>
                  <FormLabel>Header Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Authorization"
                      value={keyHeaderName}
                      onChange={(e) => handleHeaderNameChange(e.target.value)}
                      disabled={isInstalled}
                      className={inputClass}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    HTTP header name for the API key (defaults to Authorization with Bearer prefix).
                  </FormDescription>
                  <FormMessage />
                </FormItem>

                <HeaderPairsEditor
                  pairs={headerPairs}
                  onChange={handleHeaderPairsChange}
                  disabled={isInstalled}
                  styled={styled}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Advanced Accordion: OAuth Configuration */}
      {authTypeValue === "oauth" && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced-settings" className="border-none">
            <AccordionTrigger className="hover:text-foreground text-muted-foreground py-2 text-sm font-medium">
              Advanced Settings
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

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
