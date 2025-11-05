"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { authClient } from "@/lib/auth/auth-client"
import { BetterAuthActionButton } from "@/components/auth/better-auth-action-button"

export function MembersTab() {
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const { data: session } = authClient.useSession()

  function removeMember(memberId: string) {
    return authClient.organization.removeMember({
      memberIdOrEmail: memberId,
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activeOrganization?.members?.map(member => (
          <TableRow key={member.id}>
            <TableCell>{member.user.name}</TableCell>
            <TableCell>{member.user.email}</TableCell>
            <TableCell>
              <Badge
                variant={
                  member.role === "owner"
                    ? "default"
                    : member.role === "admin"
                    ? "secondary"
                    : "outline"
                }
              >
                {member.role}
              </Badge>
            </TableCell>
            <TableCell>
              {member.userId !== session?.user.id && (
                <BetterAuthActionButton
                  requireAreYouSure
                  variant="destructive"
                  size="sm"
                  action={() => removeMember(member.id)}
                >
                  Remove
                </BetterAuthActionButton>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
