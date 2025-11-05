"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authClient } from "@/lib/auth/auth-client"
import { MembersTab } from "./members-tab"
import { InvitesTab } from "./invites-tab"

export function OrganizationTabs() {
  const { data: activeOrganization } = authClient.useActiveOrganization()

  return (
    <div className="space-y-4">
      {activeOrganization && (
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>
          <Card>
            <CardContent>
              <TabsContent value="members">
                <MembersTab />
              </TabsContent>

              <TabsContent value="invitations">
                <InvitesTab />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      )}
    </div>
  )
}
