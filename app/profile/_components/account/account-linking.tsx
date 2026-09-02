"use client";

import { Plus, Shield, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { BetterAuthActionButton } from "@/components/auth/buttons/better-auth-action-button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { auth } from "@/lib/auth/auth";
import { authClient } from "@/lib/auth/auth-client";
import {
  SUPPORTED_OAUTH_PROVIDER_DETAILS,
  SUPPORTED_OAUTH_PROVIDERS,
  type SupportedOAuthProvider,
} from "@/lib/auth/o-auth-providers";

type Account = Awaited<ReturnType<typeof auth.api.listUserAccounts>>[number];

/**
 * Lists linked OAuth accounts and provides link/unlink buttons for all supported OAuth providers.
 * Displays currently linked accounts with unlink actions and available providers for linking.
 *
 * @author Maruf Bepary
 */
export function AccountLinking({
  currentAccounts,
}: {
  currentAccounts: Account[];
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-medium text-lg">Linked Accounts</h3>

        {currentAccounts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-secondary-muted">
              No linked accounts found
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {currentAccounts.map((account) => (
              <AccountCard
                key={account.id}
                provider={account.providerId}
                account={account}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-medium text-lg">Link Other Accounts</h3>
        <div className="grid gap-3">
          {SUPPORTED_OAUTH_PROVIDERS.filter(
            (provider) =>
              !currentAccounts.find((acc) => acc.providerId === provider),
          ).map((provider) => (
            <AccountCard key={provider} provider={provider} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a provider-specific card with link/unlink actions and account connection details.
 *
 * @author Maruf Bepary
 */
function AccountCard({
  provider,
  account,
}: {
  provider: string;
  account?: Account;
}) {
  const router = useRouter();

  const providerDetails = SUPPORTED_OAUTH_PROVIDER_DETAILS[
    provider as SupportedOAuthProvider
  ] ?? {
    // In case of an unsupported provider, use generic details
    name: provider,
    Icon: Shield,
  };

  /**
   * Initiates OAuth linking flow via Better Auth.
   */
  function linkAccount() {
    return authClient.linkSocial({
      provider,
      callbackURL: ROUTES.PROFILE.path,
    });
  }

  /**
   * Unlinks the OAuth account and triggers a page refresh to update the account list.
   */
  function unlinkAccount() {
    if (account == null) {
      return Promise.resolve({ error: { message: "Account not found" } });
    }
    return authClient.unlinkAccount(
      {
        accountId: account.accountId,
      },
      {
        onSuccess: () => {
          router.refresh();
        },
      },
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {<providerDetails.Icon className="size-5" />}
            <div>
              <p className="font-medium">{providerDetails.name}</p>
              {account == null ? (
                <p className="text-muted-foreground text-sm">
                  Connect your {providerDetails.name} account for easier sign-in
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Linked on {new Date(account.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {account == null ? (
            <BetterAuthActionButton
              variant="outline"
              size="sm"
              action={linkAccount}
            >
              <Plus />
              Link
            </BetterAuthActionButton>
          ) : (
            <BetterAuthActionButton
              variant="destructive"
              size="sm"
              action={unlinkAccount}
            >
              <Trash2 />
              Unlink
            </BetterAuthActionButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
