"use client"

import { BetterAuthActionButton } from "@/components/auth/better-auth-action-button"
import { authClient } from "@/lib/auth/auth-client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function PasskeyButton() {
  const router = useRouter()
  const { refetch } = authClient.useSession()

  useEffect(() => {
    authClient.signIn.passkey(
      { autoFill: true },
      {
        onSuccess() {
          refetch()
          router.push("/")
        },
      }
    )
  }, [router, refetch])

  return (
    <BetterAuthActionButton
      variant="outline"
      className="w-full"
      action={() =>
        authClient.signIn.passkey(undefined, {
          onSuccess() {
            refetch()
            router.push("/")
          },
        })
      }
    >
      Use Passkey
    </BetterAuthActionButton>
  )
}
