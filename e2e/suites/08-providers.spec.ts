import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 08: Providers CRUD, Model Sync & Registry Import/Export", () => {
  test("creates provider, tests connection, syncs models, tests registry, deletes provider, and verifies 404", async ({
    page,
    safeType,
    uniqueName,
  }) => {
    test.setTimeout(120_000);
    const providerName = uniqueName("Mock-Provider");

    // 1. Navigate to Add Provider page
    await page.goto(ROUTES.SETTINGS.PROVIDERS.new);
    await expect(page.locator("h1:has-text('Add Provider')")).toBeVisible();

    // 2. Fill form fields
    await safeType(page.locator("#provider-name"), providerName);
    await safeType(page.locator("#provider-url"), "http://127.0.0.1:4000/v1");
    await safeType(page.locator("#provider-api-key"), "mock-key");

    // 3. Submit creation
    const addBtn = page.locator('button:has-text("Add Provider")');
    await expect(addBtn).toBeEnabled({ timeout: 5_000 });
    await addBtn.click();
    await expect(page.locator('text="Provider created"').first()).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForURL(ROUTES.SETTINGS.PROVIDERS.path, { timeout: 25_000 });

    // 4. Locate provider card on /settings/providers
    const providerCard = page
      .locator(`[data-slot="card"]:has-text("${providerName}")`)
      .first();
    await expect(providerCard).toBeVisible({ timeout: 15_000 });

    // 5. Test Connection via dropdown menu
    const menuButton = providerCard.locator(
      "button:has(svg.lucide-more-vertical)",
    );
    await menuButton.click();
    await page
      .locator('div[role="menuitem"]:has-text("Test Connection")')
      .click();
    await expect(
      page.locator('text="Connection successful"').first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    // 6. Sync Models from Mock Server
    const syncButton = providerCard
      .locator(
        'button:has(svg.lucide-refresh-cw), button:has-text("Sync Models")',
      )
      .first();
    await syncButton.click();
    await expect(page.locator("text=/Sync complete/i").first()).toBeVisible({
      timeout: 20_000,
    });

    // 7. Verify synced models appear in Models tab
    await page.locator('button[role="tab"]:has-text("Models")').click();
    await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('table:has-text("mock-gpt-4o")')).toBeVisible();

    // 8. Test Registry tab (Export All & Import)
    await page.locator('button[role="tab"]:has-text("Registry")').click();
    await expect(page.locator('h3:has-text("Import / Export")')).toBeVisible();

    // Test Export All JSON download
    const downloadPromise = page.waitForEvent("download");
    await page.locator('button:has-text("Export All")').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("provider-registry.json");

    // Test Import functionality
    const validRegistryPayload = JSON.stringify({
      version: "1",
      exportedAt: new Date().toISOString(),
      providers: [],
    });
    const fileInput = page.locator(
      'input[type="file"][accept="application/json"]',
    );
    await fileInput.setInputFiles({
      name: "test-registry.json",
      mimeType: "application/json",
      buffer: Buffer.from(validRegistryPayload),
    });
    await expect(page.locator("text=/Imported:/i").first()).toBeVisible({
      timeout: 15_000,
    });

    // 9. Navigate to Provider Detail page and Delete via Danger Zone
    await page.locator('button[role="tab"]:has-text("Providers")').click();
    await expect(providerCard).toBeVisible();

    const editLink = providerCard
      .locator('a[href*="/settings/providers/"]')
      .first();
    await editLink.click();
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/settings/providers/") &&
        url.pathname !== "/settings/providers/new",
      { timeout: 25_000 },
    );

    // Switch to Danger Zone tab and delete
    await page.locator('button[role="tab"]:has-text("Danger Zone")').click();
    await page.locator('button:has-text("Delete Provider")').click();

    // Confirm deletion dialog
    const confirmDialog = page.locator(
      'div[role="alertdialog"], div[role="dialog"]',
    );
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.locator('button:has-text("Delete")').click();

    await expect(page.locator('text="Provider deleted"').first()).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForURL(ROUTES.SETTINGS.PROVIDERS.path, { timeout: 25_000 });

    // Verify card is removed
    await expect(
      page.locator(`[data-slot="card"]:has-text("${providerName}")`),
    ).not.toBeVisible();

    // 10. 404 Boundary test
    await page.goto("/settings/providers/00000000-0000-4000-a000-000000000000");
    await expect(page.locator('text="Provider not found"').first()).toBeVisible(
      { timeout: 20_000 },
    );
  });
});
