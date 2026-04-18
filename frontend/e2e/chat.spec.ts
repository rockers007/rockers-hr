import { test, expect } from '@playwright/test';

/**
 * AI Chat E2E tests.
 * These tests expect LLM_MOCK=true to be set so the backend returns
 * deterministic mock responses instead of calling the real LLM API.
 */
test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure the chat is available (employee must be logged in)
    // Mock the user session
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'user-1',
            name: 'Chat Test User',
            email: 'chatuser@gmail.com',
            role: 'employee',
            department: { id: 'dept-1', label: 'Engineering' },
          },
        }),
      });
    });
  });

  test('should show chat interface on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Chat widget or button should be visible
    const chatTrigger = page
      .getByRole('button', { name: /chat|assistant|help/i })
      .or(page.locator('[data-testid="chat-widget"]'))
      .or(page.locator('.chat-trigger'));
    await expect(chatTrigger).toBeVisible();
  });

  test('should open chat panel when clicked', async ({ page }) => {
    await page.goto('/dashboard');

    const chatTrigger = page
      .getByRole('button', { name: /chat|assistant|help/i })
      .or(page.locator('[data-testid="chat-widget"]'));
    await chatTrigger.click();

    // Chat panel should be visible with input field
    const chatInput = page
      .getByPlaceholder(/message|ask|type/i)
      .or(page.locator('[data-testid="chat-input"]'));
    await expect(chatInput).toBeVisible();
  });

  test('should send a message and receive a response', async ({ page }) => {
    // Mock chat endpoint (LLM_MOCK=true behavior)
    await page.route('**/api/v1/chat*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              message: 'Based on your leave balance, you have 8 casual leave days remaining for this year.',
              sources: [],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard');

    // Open chat
    const chatTrigger = page
      .getByRole('button', { name: /chat|assistant|help/i })
      .or(page.locator('[data-testid="chat-widget"]'));
    await chatTrigger.click();

    // Type a message
    const chatInput = page
      .getByPlaceholder(/message|ask|type/i)
      .or(page.locator('[data-testid="chat-input"]'));
    await chatInput.fill('How many casual leave days do I have?');

    // Send message
    const sendBtn = page
      .getByRole('button', { name: /send/i })
      .or(page.locator('[data-testid="chat-send"]'));
    await sendBtn.click();

    // User message should appear in chat
    await expect(page.getByText(/how many casual leave/i)).toBeVisible();

    // Bot response should appear
    await expect(page.getByText(/8 casual leave days/i)).toBeVisible({ timeout: 10_000 });
  });

  test('should show typing indicator while waiting for response', async ({ page }) => {
    // Mock with delay
    await page.route('**/api/v1/chat*', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { message: 'Delayed response', sources: [] },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard');

    const chatTrigger = page
      .getByRole('button', { name: /chat|assistant|help/i })
      .or(page.locator('[data-testid="chat-widget"]'));
    await chatTrigger.click();

    const chatInput = page
      .getByPlaceholder(/message|ask|type/i)
      .or(page.locator('[data-testid="chat-input"]'));
    await chatInput.fill('Tell me about leave policy');

    const sendBtn = page
      .getByRole('button', { name: /send/i })
      .or(page.locator('[data-testid="chat-send"]'));
    await sendBtn.click();

    // Typing indicator should appear
    const typingIndicator = page
      .getByText(/typing|thinking|loading/i)
      .or(page.locator('[data-testid="chat-typing"]'))
      .or(page.locator('.typing-indicator'));
    await expect(typingIndicator).toBeVisible({ timeout: 3_000 });
  });

  test('should handle chat errors gracefully', async ({ page }) => {
    await page.route('**/api/v1/chat*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'CHAT_ERROR', message: 'Service temporarily unavailable', statusCode: 500 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard');

    const chatTrigger = page
      .getByRole('button', { name: /chat|assistant|help/i })
      .or(page.locator('[data-testid="chat-widget"]'));
    await chatTrigger.click();

    const chatInput = page
      .getByPlaceholder(/message|ask|type/i)
      .or(page.locator('[data-testid="chat-input"]'));
    await chatInput.fill('Test error handling');

    const sendBtn = page
      .getByRole('button', { name: /send/i })
      .or(page.locator('[data-testid="chat-send"]'));
    await sendBtn.click();

    // Error message should be shown to user
    await expect(page.getByText(/error|unavailable|try again/i)).toBeVisible({ timeout: 10_000 });
  });
});
