"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth/auth-client";
import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { CreateInviteButton } from "../buttons/create-invite-button";
import { INVITATION_STATUS, ORG_ROLES } from "@/lib/auth/roles";

/**
 * Shows pending invitations and allows cancellation or new invites.
 * @returns Invitations tab populated from the active organization hook.
 */
export function InvitesTab() {
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const pendingInvites = activeOrganization?.invitations?.filter(
    (invite) => invite.status === INVITATION_STATUS.PENDING
  );

  /**
   * Cancels an outstanding organization invitation.
   * @param invitationId Identifier for the invite being revoked.
   * @returns Promise for the cancel request.
   */
  function cancelInvitation(invitationId: string) {
    return authClient.organization.cancelInvitation({ invitationId });
  }

  return (
    <div className="space-y-4">
      <div className="justify-end flex">
        <CreateInviteButton />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingInvites?.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>{invitation.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{invitation.role}</Badge>
              </TableCell>
              <TableCell>
                {new Date(invitation.expiresAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <BetterAuthActionButton
                  variant="destructive"
                  size="sm"
                  action={() => cancelInvitation(invitation.id)}
                >
                  Cancel
                </BetterAuthActionButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
