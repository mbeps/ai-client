import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { AccountLinking } from "./account-linking";

/**
 * Server component that fetches and displays linked OAuth accounts, excluding credential provider.
 * Filters out password-based accounts to show only social account linking UI.
 *
 * @author Maruf Bepary
 */
export async function LinkedAccountsTab() {
  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  const nonCredentialAccounts = accounts.filter(
    (a) => a.providerId !== "credential",
  );

  return <AccountLinking currentAccounts={nonCredentialAccounts} />;
}
