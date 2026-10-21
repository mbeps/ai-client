import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

export interface CustomFixtures {
  safeType: (locator: Locator, text: string) => Promise<void>;
  sendChatMessage: (page: Page, text: string) => Promise<void>;
  waitForStreamComplete: (page: Page) => Promise<void>;
  startNewChat: (page: Page) => Promise<void>;
  uniqueName: (prefix: string) => string;
}

export const test = base.extend<CustomFixtures>({
  safeType: async ({}, use) => {
    await use(async (locator: Locator, text: string) => {
      await locator.click();
      await locator.pressSequentially(text, { delay: 10 });
    });
  },

  startNewChat: async ({}, use) => {
    await use(async (page: Page) => {
      const currentUrl = page.url();
      const newChatBtn = page
        .locator(
          'main button:has-text("New Chat"), [data-sidebar="menu-button"]:has-text("New Chat")',
        )
        .first();
      await newChatBtn.click();
      await page.waitForURL(
        (url) => url.pathname.startsWith("/chats/") && url.href !== currentUrl,
        {
          timeout: 35_000,
        },
      );
    });
  },

  sendChatMessage: async ({ safeType }, use) => {
    await use(async (page: Page, text: string) => {
      const textarea = page.locator("textarea").first();
      await safeType(textarea, text);
      const sendButton = page
        .locator(
          'button[aria-label="Send message"], button[type="submit"]:has(svg)',
        )
        .first();
      await sendButton.click();
    });
  },

  waitForStreamComplete: async ({}, use) => {
    await use(async (page: Page) => {
      // 1. Wait for send button to return to non-loading state
      await expect(
        page.locator('button[aria-label="Send message"]').first(),
      ).toBeVisible({ timeout: 25_000 });

      // 2. Wait for at least one assistant message to be visible
      await expect(
        page.locator('[data-role="assistant"], .prose, .typeset-chat').first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  },

  uniqueName: async ({}, use) => {
    await use((prefix: string) => {
      const rand = Math.random().toString(36).slice(2, 6);
      return `e2e-${prefix}-${Date.now().toString(36)}-${rand}`;
    });
  },
});

export { expect };
