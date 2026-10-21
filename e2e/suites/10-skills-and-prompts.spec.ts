import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 10: Prompts & Skills CRUD & 404 Boundaries", () => {
  test("creates custom prompt, verifies details, deletes prompt, and tests 404", async ({
    page,
    uniqueName,
  }) => {
    test.setTimeout(60_000);
    const promptTitle = uniqueName("QA-Prompt");
    const shortcut = `qa-${Date.now().toString(36)}`;
    const content = "Please conduct a rigorous code review of the changes.";

    // 1. Navigate to New Prompt page
    await page.goto(ROUTES.SETTINGS.PROMPTS.new);
    await expect(page.locator("h1:has-text('New Prompt')")).toBeVisible();

    // 2. Fill form
    await page
      .locator('input[placeholder="Code Review Expert"]')
      .fill(promptTitle);
    await page.locator('input[placeholder="brief"]').fill(shortcut);

    // Switch to Raw Text tab to access textarea directly
    await page.locator('button[role="tab"]:has-text("Raw Text")').click();
    await page.locator("textarea").first().fill(content);

    // 3. Submit prompt creation
    await page
      .locator('button[type="submit"]:has-text("Create Prompt")')
      .click();

    // 4. Verify redirected to prompts list and prompt card appears
    await page.waitForURL(ROUTES.SETTINGS.PROMPTS.path, { timeout: 15_000 });
    const promptCard = page
      .locator(`[data-slot="card"]:has-text("${promptTitle}")`)
      .first();
    await expect(promptCard).toBeVisible({ timeout: 10_000 });

    // 5. Open Prompt detail
    await promptCard.locator('a[href*="/settings/prompts/"]').first().click();
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith(ROUTES.SETTINGS.PROMPTS.path) &&
        url.pathname !== ROUTES.SETTINGS.PROMPTS.path,
    );
    await expect(page.locator("h1")).toContainText(promptTitle, {
      timeout: 10_000,
    });

    // 6. Delete prompt via DangerZoneCard
    await page.locator('button[role="tab"]:has-text("Danger Zone")').click();
    const deleteBtn = page.locator('button:has-text("Delete Prompt")').first();
    await expect(deleteBtn).toBeVisible({ timeout: 15_000 });
    await deleteBtn.click();

    // 7. Confirm in dialog
    const confirmBtn = page.locator('button:has-text("Delete")').last();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 8. Verify prompt is deleted from list
    await page.waitForURL(ROUTES.SETTINGS.PROMPTS.path, { timeout: 15_000 });
    await expect(
      page.locator(`[data-slot="card"]:has-text("${promptTitle}")`),
    ).not.toBeVisible();

    // 9. Verify 404 boundary on nonexistent prompt
    await page.goto(
      ROUTES.SETTINGS.PROMPTS.detail("00000000-0000-4000-a000-000000000000"),
    );
    await expect(page.locator("body")).toBeVisible();
    const notFoundIndicator = page.locator(
      ':is(:text("404"), :text("Not Found"), :text("This page could not be found"))',
    );
    await expect(notFoundIndicator.first()).toBeVisible({ timeout: 15_000 });
  });

  test("creates agent skill, verifies details, deletes skill, and tests 404", async ({
    page,
    uniqueName,
  }) => {
    test.setTimeout(60_000);
    const skillDisplayName = uniqueName("QA-Skill");
    const skillSlug = `sk-${Date.now().toString(36)}`;
    const skillDesc = "Specialized QA guidelines and verification rules.";
    const skillContent =
      "# Skill Instructions\n\nAlways verify assertions with automated tests.\n";

    // 1. Navigate to New Skill page
    await page.goto(ROUTES.SETTINGS.SKILLS.new);
    await expect(page.locator("h1:has-text('New Agent Skill')")).toBeVisible();

    // 2. Fill form
    await page
      .locator('input[placeholder="Clean Code"]')
      .fill(skillDisplayName);
    await page.locator('input[placeholder="clean-code"]').fill(skillSlug);
    await page
      .locator(
        'input[placeholder="Brief summary used for routing and discovery"]',
      )
      .fill(skillDesc);

    // Switch to Raw Text tab to access textarea directly
    await page.locator('button[role="tab"]:has-text("Raw Text")').click();
    await page.locator("textarea").first().fill(skillContent);

    // 3. Submit skill creation
    await page
      .locator('button[type="submit"]:has-text("Create Skill")')
      .click();

    // 4. Verify redirected to skills list and skill card appears
    await page.waitForURL(ROUTES.SETTINGS.SKILLS.path, { timeout: 15_000 });
    const skillCard = page
      .locator(`[data-slot="card"]:has-text("${skillDisplayName}")`)
      .first();
    await expect(skillCard).toBeVisible({ timeout: 10_000 });

    // 5. Open Skill detail
    await skillCard.locator('a[href*="/settings/skills/"]').first().click();
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith(ROUTES.SETTINGS.SKILLS.path) &&
        url.pathname !== ROUTES.SETTINGS.SKILLS.path,
    );
    await expect(page.locator('input[aria-label="Skill name"]')).toHaveValue(
      skillDisplayName,
      { timeout: 10_000 },
    );

    // 6. Delete skill via menu
    await page
      .locator(
        "button:has(svg.lucide-ellipsis), button:has(svg.lucide-more-horizontal), button:has(svg.lucide-more-vertical)",
      )
      .first()
      .click();
    await page.locator('[role="menuitem"]:has-text("Delete Skill")').click();

    // 7. Confirm in dialog
    const confirmBtn = page.locator('button:has-text("Delete")').last();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 8. Verify skill is deleted from list
    await page.waitForURL(ROUTES.SETTINGS.SKILLS.path, { timeout: 15_000 });
    await expect(page.locator(`text="${skillDisplayName}"`)).not.toBeVisible();

    // 9. Verify 404 boundary on nonexistent skill
    await page.goto(
      ROUTES.SETTINGS.SKILLS.detail("00000000-0000-4000-a000-000000000000"),
    );
    await expect(page.locator("body")).toBeVisible();
    const notFoundIndicator = page.locator(
      ':is(:text("404"), :text("Not Found"), :text("This page could not be found"))',
    );
    await expect(notFoundIndicator.first()).toBeVisible({ timeout: 15_000 });
  });
});
