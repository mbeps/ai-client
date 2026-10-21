import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 12: Workflows, Translation, Transform Automations & Jobs", () => {
  test("workflows hub, translation workflow with language swap & translate trigger", async ({
    page,
    safeType,
  }) => {
    test.setTimeout(120_000);

    // 1. Navigate to Workflows hub
    await page.goto(ROUTES.WORKFLOWS.path);
    await expect(page.locator("h1:has-text('Workflows')")).toBeVisible();
    await expect(
      page
        .locator(
          '[data-slot="page-container"] [data-slot="card"]:has-text("Translation")',
        )
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator(
          '[data-slot="page-container"] [data-slot="card"]:has-text("Step-by-Step Automations")',
        )
        .first(),
    ).toBeVisible();

    // 2. Open Translation workflow
    await page.locator('a.group:has-text("Translation")').first().click();
    await page.waitForURL(ROUTES.WORKFLOWS.TRANSLATION.path, {
      timeout: 35_000,
    });
    await expect(page.locator("h1:has-text('Translation')")).toBeVisible();

    // 3. Test language selection and swap button
    // Default source is "auto" (Detect Language) which disables swap. Select specific language to enable swap.
    const sourceComboboxInput = page
      .locator('input[placeholder="Detect Language"]')
      .first();
    await sourceComboboxInput.click();
    const spanishOption = page
      .locator(
        '[data-slot="combobox-item"]:has-text("Spanish"), div[role="option"]:has-text("Spanish")',
      )
      .first();
    await spanishOption.click();

    // Verify swap button is now enabled and click it
    const swapButton = page.locator('button[aria-label="Swap languages"]');
    await expect(swapButton).toBeEnabled({ timeout: 10_000 });
    await swapButton.click();

    // 4. Fill text into source translation pane (after swap)
    const sourceTextarea = page
      .locator('textarea[placeholder="Type or paste text to translate..."]')
      .first();
    await expect(sourceTextarea).toBeVisible();
    await safeType(
      sourceTextarea,
      "Hello world! End-to-end testing machine translation.",
    );

    // 5. Trigger translation
    const translateButton = page
      .locator('button:has-text("Translate")')
      .first();
    await expect(translateButton).toBeEnabled({ timeout: 10_000 });
    await translateButton.click();

    // Assert translation status changes or active translation initiates
    await expect(
      page
        .locator(
          'button:has-text("Translating..."), textarea[placeholder="Translating..."]',
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("transform automation CRUD, run execution, and 404 boundaries", async ({
    page,
    safeType,
    uniqueName,
  }) => {
    test.setTimeout(120_000);
    const agentName = uniqueName("E2E-Transform");

    // 1. Navigate to Step-by-Step Automations
    await page.goto(ROUTES.WORKFLOWS.TRANSFORM.path);
    await expect(
      page.locator("h1:has-text('Step-by-Step Automations')"),
    ).toBeVisible();

    // 2. Navigate to New Agent page
    await page.goto(ROUTES.WORKFLOWS.TRANSFORM.new);
    await expect(
      page.locator("h1:has-text('New Transform Agent')"),
    ).toBeVisible({
      timeout: 35_000,
    });

    // 3. Configure metadata in Settings tab
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await safeType(page.locator("#name"), agentName);

    // Disable file upload requirement for clean execution test
    const fileUploadSwitch = page
      .locator('div:has-text("Require File Upload") button[role="switch"]')
      .first();
    if ((await fileUploadSwitch.getAttribute("data-state")) === "checked") {
      await fileUploadSwitch.click();
    }

    // 4. Add Step in Steps tab
    await page.locator('button[role="tab"]:has-text("Steps")').click();
    const addStepBtn = page
      .locator(
        'button:has-text("Add Step"), button:has-text("Add your first step")',
      )
      .first();
    await addStepBtn.click();

    // Use Raw Text tab on MarkdownTabEditor to fill prompt
    await page
      .locator('button[role="tab"]:has-text("Raw Text")')
      .first()
      .click();
    const promptInput = page
      .locator(
        'textarea[placeholder="Instruct the AI on what to do in this step..."]',
      )
      .first();
    await safeType(promptInput, "Analyze provided payload and summarize.");

    // Toggle Human Review switch on step card
    const reviewSwitch = page
      .locator('[data-slot="card"] button[role="switch"]')
      .first();
    await reviewSwitch.click();

    // 5. Save the transform agent
    const saveAgentBtn = page.locator('button:has-text("Save Agent")');
    await expect(saveAgentBtn).toBeEnabled({ timeout: 10_000 });
    await saveAgentBtn.click();
    await expect(
      page.locator('text="Agent created successfully"').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Wait for redirect to agent detail page
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/workflows/transform/") &&
        url.pathname !== "/workflows/transform/new",
      { timeout: 25_000 },
    );
    await expect(page.locator(`h1:has-text("${agentName}")`)).toBeVisible();

    // 6. Test Start Run dialog and launch
    const runBtn = page.locator('button:has-text("Run")').first();
    await expect(runBtn).toBeVisible({ timeout: 15_000 });
    await runBtn.click();

    // Dialog opens
    const runDialog = page.locator('div[role="dialog"]');
    await expect(runDialog).toBeVisible();
    await runDialog.locator('button:has-text("Start Run")').click();

    // Navigates to run execution page
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/workflows/transform/") &&
        url.pathname.split("/").length >= 5,
      { timeout: 25_000 },
    );
    await expect(page.locator('h3:has-text("Execution Timeline")')).toBeVisible(
      { timeout: 15_000 },
    );

    // 7. Delete the agent via Danger Zone
    // Return to agent detail page
    const runUrlSegments = new URL(page.url()).pathname.split("/");
    const agentId = runUrlSegments[3];
    await page.goto(ROUTES.WORKFLOWS.TRANSFORM.detail(agentId));
    await expect(page.locator(`h1:has-text("${agentName}")`)).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('button[role="tab"]:has-text("Danger Zone")').click();
    await page.locator('button:has-text("Delete Agent")').click();

    const deleteDialog = page.locator(
      'div[role="alertdialog"], div[role="dialog"]',
    );
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.locator('button:has-text("Delete")').click();

    await expect(
      page.locator('text="Agent deleted successfully"').first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForURL(ROUTES.WORKFLOWS.TRANSFORM.path, { timeout: 25_000 });

    // Verify agent card is gone
    await expect(
      page.locator(`[data-slot="card"]:has-text("${agentName}")`),
    ).not.toBeVisible();

    // 8. 404 Boundary tests
    await page.goto(
      "/workflows/transform/00000000-0000-4000-a000-000000000000",
    );
    await expect(
      page.locator('text="Automation not found"').first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto(
      "/workflows/transform/00000000-0000-4000-a000-000000000000/00000000-0000-4000-a000-000000000000",
    );
    await expect(
      page
        .locator(
          ':is(:text("Automation not found"), :text("Automation run not found"), :text("404"))',
        )
        .first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("jobs overview page displays header, search, and status stat cards", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    // 1. Navigate to /jobs
    await page.goto(ROUTES.JOBS.path);
    await expect(page.locator("h1:has-text('Running Jobs')")).toBeVisible();

    // 2. Verify search input
    const searchInput = page.locator(
      'input[placeholder="Search jobs by title, type, or function..."]',
    );
    await expect(searchInput).toBeVisible();

    // 3. Verify status cards
    await expect(
      page
        .locator('button:has-text("Running"), div:has-text("Running")')
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator('button:has-text("Completed"), div:has-text("Completed")')
        .first(),
    ).toBeVisible();
  });
});
