import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { account } from "@/drizzle/schemas/auth-schema";

describe("account-schema", () => {
  it("account table defines issuer column required by Better Auth 1.7", () => {
    const cols = getTableColumns(account);
    expect(cols.issuer).toBeDefined();
    expect(cols.issuer.name).toBe("issuer");
    expect(cols.issuer.notNull).toBe(true);
  });

  it("account table defines composite unique index on (issuer, account_id)", () => {
    const { indexes } = getTableConfig(account);
    const issuerAccountIdIndex = indexes.find(
      (idx) =>
        idx.config.name === "account_issuer_account_id_idx" ||
        (idx.config.unique &&
          idx.config.columns.some((c) => "name" in c && c.name === "issuer") &&
          idx.config.columns.some((c) => "name" in c && c.name === "account_id")),
    );
    expect(issuerAccountIdIndex).toBeDefined();
    expect(issuerAccountIdIndex!.config.unique).toBe(true);
  });

  it("has issuer column name and type correctly configured", () => {
    expect(account.issuer).toBeDefined();
    expect(account.issuer.name).toBe("issuer");
    expect(account.issuer.dataType).toBe("string");
  });
});
