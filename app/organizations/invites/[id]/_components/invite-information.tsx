"use client"

import { BetterAuthActionButton } from "@/components/auth/better-auth-action-button"
import { authClient } from "@/lib/auth/auth-client"
import { useRouter } from "next/navigation"

/**
 * Displays actions for accepting or rejecting an organization invitation.
 * @param invitation Invitation metadata fetched from Better Auth.
 * @returns Action buttons that drive the invitation response.
 */
export function InviteInformation({
  invitation,
}: {
  invitation: { id: string; organizationId: string }
}) {
  const router = useRouter()

  /**
   * Accepts the invitation and activates the organization context.
   * @returns Promise describing the accept mutation.
   */
  function acceptInvite() {
    return authClient.organization.acceptInvitation(
      { invitationId: invitation.id },
      {
        onSuccess: async () => {
          await authClient.organization.setActive({
            organizationId: invitation.organizationId,
          })
          router.push("/organizations")
        },
      }
    )
  }
  /**
   * Rejects the pending invitation and redirects home.
   * @returns Promise describing the reject mutation.
   */
  function rejectInvite() {
    return authClient.organization.rejectInvitation(
      {
        invitationId: invitation.id,
      },
      { onSuccess: () => router.push("/") }
    )
  }

  return (
    <div className="flex gap-4">
      <BetterAuthActionButton className="flex-grow" action={acceptInvite}>
        Accept
      </BetterAuthActionButton>
      <BetterAuthActionButton
        className="flex-grow"
        variant="destructive"
        action={rejectInvite}
      >
        Reject
      </BetterAuthActionButton>
    </div>
  )
}
