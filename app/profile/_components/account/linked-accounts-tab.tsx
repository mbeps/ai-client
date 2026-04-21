import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { AccountLinking } from "./account-linking";

/**
 * Server component that lists linked social accounts and masks credential providers.
 * @returns Account linking controls without card wrapper.
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
