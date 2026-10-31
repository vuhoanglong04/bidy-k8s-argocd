import { APIRequestContext, BrowserContext } from '@playwright/test';
import { CONFIG } from './config';

export interface LoginResult {
  token: string;
  refreshToken: string | null;
  profile: any;
  userId: string;
}

/**
 * Log in a user via backend REST API and fetch their profile.
 */
export async function loginUserViaApi(
  request: APIRequestContext,
  identifier: string,
  password?: string
): Promise<LoginResult> {
  const pwd = password || (identifier === CONFIG.USERS.ADMIN.username ? CONFIG.USERS.ADMIN.password : CONFIG.USERS.BUYER?.password || CONFIG.USERS.BIDDER1?.password || process.env.E2E_USER_PASSWORD || '');
  
  const loginRes = await request.post(`${CONFIG.API_URL}/auth/login`, {
    data: {
      identifier,
      password: pwd,
      deviceId: 'playwright-e2e-device',
    },
  });

  if (!loginRes.ok()) {
    const errorBody = await loginRes.text();
    throw new Error(`Login failed for ${identifier} (${loginRes.status()}): ${errorBody}`);
  }

  const loginJson = await loginRes.json();
  const token = loginJson.data?.token || loginJson.token;
  const refreshToken = loginJson.data?.refreshToken || loginJson.refreshToken || null;
  const initialUserId = loginJson.data?.id || loginJson.data?.userId || loginJson.id || '';

  if (!token) {
    throw new Error(`Login response for ${identifier} did not include an access token: ${JSON.stringify(loginJson)}`);
  }

  // Fetch full profile to populate user cookie with role and user info
  const profileRes = await request.get(`${CONFIG.API_URL}/users/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  let profile: any = null;
  let userId = initialUserId;

  if (profileRes.ok()) {
    const profileJson = await profileRes.json();
    profile = profileJson.data || profileJson;
    userId = String(profile.id || profile._id || initialUserId);
  }

  return {
    token,
    refreshToken,
    profile,
    userId,
  };
}

/**
 * Inject auth cookies into Playwright browser context to simulate active user session on FE.
 */
export async function setupUserSession(
  context: BrowserContext,
  authData: LoginResult,
  baseURL: string = CONFIG.BASE_URL
): Promise<void> {
  const url = new URL(baseURL);
  const domain = url.hostname;

  const cookies = [
    {
      name: 'authCookie',
      value: authData.token,
      domain,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
    {
      name: 'userCookie',
      value: JSON.stringify(authData.profile || { id: authData.userId }),
      domain,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ];

  if (authData.refreshToken) {
    cookies.push({
      name: 'refreshCookie',
      value: authData.refreshToken,
      domain,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    });
  }

  await context.addCookies(cookies);
}
