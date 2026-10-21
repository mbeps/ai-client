import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 09: MCP Connectors, Public Tools & 404 Boundary", () => {
  test("creates MCP connector, verifies tools & resources, toggles sharing, discovers public tools, deletes, and tests 404", async ({
    page,
    safeType,
    uniqueName,
  }) => {
    test.setTimeout(120_000);
    const serverName = uniqueName("Mock-MCP");

    // 1. Navigate to Add Server page
    await page.goto(ROUTES.SETTINGS.CONNECTORS.new);
    await expect(page.locator("h1:has-text('Add MCP Server')")).toBeVisible();

    // 2. Fill form fields
    await safeType(
      page.locator('input[placeholder="My MCP Server"]'),
      serverName,
    );
    await safeType(
      page.locator('input[placeholder="https://mcp.example.com/sse"]'),
      "http://127.0.0.1:4000/mcp",
    );

    // 3. Submit MCP server creation
    const submitBtn = page.locator(
      'button[type="submit"]:has-text("Add Server")',
    );
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();
    await expect(page.locator('text="MCP server added"').first()).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForURL(ROUTES.SETTINGS.CONNECTORS.path, { timeout: 25_000 });

    // 4. Locate server card and navigate to detail page
    const serverCard = page
      .locator(`[data-slot="card"]:has-text("${serverName}")`)
      .first();
    await expect(serverCard).toBeVisible({ timeout: 15_000 });
    await serverCard
      .locator('a[href*="/settings/connectors/"]')
      .first()
      .click();

    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/settings/connectors/") &&
        url.pathname !== "/settings/connectors/new",
      { timeout: 25_000 },
    );

    // 5. Verify Tools tab lists calculate_sum tool
    await expect(page.locator('text="calculate_sum"').first()).toBeVisible({
      timeout: 15_000,
    });

    // 6. Verify Resources tab lists mock resource
    await page.locator('button[role="tab"]:has-text("Resources")').click();
    await expect(
      page.locator('text="System Status Report"').first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    // 7. Verify Sharing tab allows toggling public visibility
    await page.locator('button[role="tab"]:has-text("Sharing")').click();
    await expect(page.locator('text="Make this server public"')).toBeVisible();

    const publicToggle = page.locator("#public-toggle");
    await publicToggle.click();
    await expect(
      page.locator('text="Server is now public"').first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    // 8. Discover Public Tools tab on /settings/connectors/new?tab=discover
    await page.goto(`${ROUTES.SETTINGS.CONNECTORS.new}?tab=discover`);
    await expect(page.locator('h1:has-text("Add MCP Server")')).toBeVisible();
    await expect(
      page.locator('text="Community Weather MCP"').first(),
    ).toBeVisible({ timeout: 15_000 });

    // 9. Navigate back to connector detail page and delete via Danger Zone
    await page.goto(ROUTES.SETTINGS.CONNECTORS.path);
    const existingCard = page
      .locator(`[data-slot="card"]:has-text("${serverName}")`)
      .first();
    await expect(existingCard).toBeVisible({ timeout: 15_000 });
    await existingCard
      .locator('a[href*="/settings/connectors/"]')
      .first()
      .click();

    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/settings/connectors/") &&
        url.pathname !== "/settings/connectors/new",
      { timeout: 25_000 },
    );

    // Switch to Danger Zone tab
    await page.locator('button[role="tab"]:has-text("Danger Zone")').click();
    await page.locator('button:has-text("Delete Server")').click();

    // Confirm deletion dialog
    const confirmDialog = page.locator(
      'div[role="alertdialog"], div[role="dialog"]',
    );
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.locator('button:has-text("Delete")').click();

    await expect(page.locator('text="MCP server deleted"').first()).toBeVisible(
      {
        timeout: 15_000,
      },
    );
    await page.waitForURL(ROUTES.SETTINGS.CONNECTORS.path, { timeout: 25_000 });

    // Verify card is removed
    await expect(
      page.locator(`[data-slot="card"]:has-text("${serverName}")`),
    ).not.toBeVisible();

    // 10. 404 Boundary test
    await page.goto(
      "/settings/connectors/00000000-0000-4000-a000-000000000000",
    );
    await expect(
      page.locator('text="Connector not found"').first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
