"use client";

import { Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * App settings page — client component for application-wide preferences and configuration.
 * Currently a placeholder for future global settings.
 * Directs users to MCP tools section for current tool/server configuration.
 */
export default function AppSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings className="h-8 w-8 text-primary" />}
        title="App Settings"
        description="Manage your application-wide preferences and configurations."
      />

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Additional settings will be available here in the future.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Currently, you can manage your MCP tools in the Tools section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
