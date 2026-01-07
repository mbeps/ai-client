"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/auth-client";
import { MembersTab } from "./members-tab";
import { InvitesTab } from "./invites-tab";

const TAB_VALUES = {
  MEMBERS: "members",
  INVITATIONS: "invitations",
} as const;

/**
 * Tabs container that toggles between organization members and invitations.
 * @returns Organization tab layout driven by Better Auth data hooks.
 */
export function OrganizationTabs() {
  const { data: activeOrganization } = authClient.useActiveOrganization();

  return (
    <div className="space-y-4">
      {activeOrganization && (
        <Tabs defaultValue={TAB_VALUES.MEMBERS} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value={TAB_VALUES.MEMBERS}>Members</TabsTrigger>
            <TabsTrigger value={TAB_VALUES.INVITATIONS}>
              Invitations
            </TabsTrigger>
          </TabsList>
          <Card>
            <CardContent>
              <TabsContent value={TAB_VALUES.MEMBERS}>
                <MembersTab />
              </TabsContent>

              <TabsContent value={TAB_VALUES.INVITATIONS}>
                <InvitesTab />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      )}
    </div>
  );
}
