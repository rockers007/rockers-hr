import { Page, BrowserContext } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';

/**
 * Auth helpers for mocking Google OAuth and setting up authenticated sessions.
 *
 * Since we cannot perform real Google OAuth in E2E tests, we mock the OAuth
 * callback by intercepting routes and injecting JWT cookies directly.
 */
export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Mock Google OAuth login for an employee.
   * Intercepts the OAuth flow and injects a valid JWT session cookie.
   */
  async loginAsEmployee(jwt: string) {
    await this.setAuthCookie(jwt);
  }

  /**
   * Mock admin login by posting credentials and setting the session cookie.
   */
  async loginAsAdmin(
    email = 'admin@rockers.com',
    password = process.env.TEST_ADMIN_PASSWORD || 'admin123',
  ) {
    // Navigate to admin login page
    await this.page.goto('/admin/login');

    // Fill in credentials
    await this.page.getByPlaceholder(/admin@/i).fill(email);
    await this.page.getByPlaceholder(/enter your password/i).fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to admin dashboard
    await this.page.waitForURL('**/admin/**', { timeout: 15_000 });
  }

  /**
   * Mock Google OAuth by intercepting the redirect and returning a mock callback.
   * This sets up route interception so that when the app redirects to Google,
   * we instead return a mock response with a valid JWT.
   */
  async mockGoogleOAuth(mockJwt: string, isNewUser = false) {
    // Intercept the Google OAuth redirect
    await this.page.route('**/api/v1/auth/google', async (route) => {
      // Instead of redirecting to Google, redirect to callback with mock code
      await route.fulfill({
        status: 302,
        headers: {
          Location: `/api/v1/auth/google/callback?code=mock_auth_code&state=mock_state`,
        },
      });
    });

    // Intercept the callback to return our mock response
    await this.page.route('**/api/v1/auth/google/callback*', async (route) => {
      if (isNewUser) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { status: 'registration_required', token: mockJwt },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              status: 'authenticated',
              token: mockJwt,
              user: { id: 'mock-user-id', name: 'Test User', email: 'test@gmail.com', role: 'employee' },
            },
          }),
        });
      }
    });
  }

  /** Set JWT as HTTP-only cookie (matching backend's cookie config) */
  private async setAuthCookie(jwt: string) {
    const context: BrowserContext = this.page.context();
    await context.addCookies([
      {
        name: 'access_token',
        value: jwt,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
  }

  /** Clear auth cookies (logout) */
  async logout() {
    const context: BrowserContext = this.page.context();
    await context.clearCookies();
  }
}
