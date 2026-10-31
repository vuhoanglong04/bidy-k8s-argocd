import {
  NextFetchEvent,
  NextMiddleware,
  NextRequest,
  NextResponse,
} from "next/server";

import { API_ROUTES, APP_CONSTANTS, APP_ROUTES, PROTECTED_ROUTES } from "@/constants";
import { USER_ROLE } from "@/constants/app.enum";
import { appConfig } from "@/config/app.config";
import { MiddlewareFactory } from "@/middlewares/type";
import { getExpiredTime, getTokenExpiration, verifyJwt } from "@/utils";


/**
 * Refresh chạy trong Edge runtime nên dùng `fetch` trần, không dùng
 * `axiosClient` (interceptor của nó đọc cookie qua `nookies` và dispatch Redux
 * — cả hai đều là thứ của browser, không tồn tại ở đây).
 */
async function refreshTokenOnEdge(
  refreshToken: string | undefined
): Promise<{ token: string; refreshToken: string | null } | null> {
  if (!refreshToken) return null;

  try {
    const res = await fetch(
      `${appConfig.api.baseUrl}/api/v1${API_ROUTES.REFRESH_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }
    );
    if (!res.ok) return null;

    const payload: unknown = await res.json();
    if (typeof payload !== "object" || payload === null) return null;

    const envelope = payload as { data?: unknown };
    const body = (
      typeof envelope.data === "object" && envelope.data !== null
        ? envelope.data
        : payload
    ) as { token?: unknown; refreshToken?: unknown };

    if (typeof body.token !== "string" || body.token.length === 0) return null;

    return {
      token: body.token,
      refreshToken:
        typeof body.refreshToken === "string" && body.refreshToken.length > 0
          ? body.refreshToken
          : null,
    };
  } catch {
    // Backend không với tới được — coi như chưa refresh, đừng xoá phiên vì lý do mạng.
    return null;
  }
}

function setAuthCookie(response: NextResponse, token: string) {
  const exp = getTokenExpiration(token);
  const maxAge = Math.floor(getExpiredTime(exp?.toString() ?? "") / 1000);
  response.cookies.set({
    name: APP_CONSTANTS.AUTH_COOKIE_NAME,
    value: token,
    path: "/",
    httpOnly: false,
    maxAge,
  });
}

export const withAuth: MiddlewareFactory = (next: NextMiddleware) => {
  return async (request: NextRequest, _next: NextFetchEvent) => {
    const { pathname } = request.nextUrl;

    const token = request.cookies.get(APP_CONSTANTS.AUTH_COOKIE_NAME)?.value;
    const userCookie = request.cookies.get(
      APP_CONSTANTS.USER_COOKIE_NAME
    )?.value;

    const isSignInPage = pathname.startsWith(APP_ROUTES.SIGN_IN);
    const isProtectedRoute = PROTECTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    const isAdminRoute =
      pathname === APP_ROUTES.ADMIN ||
      pathname.startsWith(`${APP_ROUTES.ADMIN}/`);

    // Admin và user là hai không gian route tách rời: admin chỉ được ở trong
    // `/admin/*`. Ngoại lệ duy nhất là màn hình khoá tài khoản — nó phải hiển
    // thị được cho mọi vai trò, nếu không sẽ thành vòng lặp redirect.
    const isAdminAllowedRoute =
      isAdminRoute ||
      pathname === APP_ROUTES.ACCOUNT_LOCKED ||
      pathname.startsWith(`${APP_ROUTES.ACCOUNT_LOCKED}/`);

    const parseUserCookie = (): { role?: string } => {
      try {
        return JSON.parse(userCookie || "{}") as { role?: string };
      } catch {
        return {};
      }
    };

    const isAdmin = parseUserCookie().role === USER_ROLE.ADMIN;

    // 🚫 Guest visiting protected route
    if (!token && isProtectedRoute && !isSignInPage) {
      return NextResponse.redirect(new URL(APP_ROUTES.SIGN_IN, request.url));
    }

    // ✅ Authenticated user on sign-in page → về không gian route của mình
    if (token && isSignInPage) {
      return NextResponse.redirect(
        new URL(isAdmin ? APP_ROUTES.ADMIN : APP_ROUTES.HOME, request.url)
      );
    }

    // 🔐 Admin đang đăng nhập mà lạc sang route của user → kéo về `/admin`.
    if (token && isAdmin && !isAdminAllowedRoute) {
      return NextResponse.redirect(new URL(APP_ROUTES.ADMIN, request.url));
    }

    // ✅ Token exists, validate
    if (token) {
      const verifiedJwt = await verifyJwt(token);
      if (verifiedJwt) {
        const exp = getTokenExpiration(verifiedJwt);
        const duration = getExpiredTime(exp?.toString() ?? "");

        // 🔐 Admin route protection
        if (isAdminRoute && !isAdmin) {
          return NextResponse.redirect(new URL(APP_ROUTES.HOME, request.url));
        }

        const res = NextResponse.next();
        res.cookies.set({
          name: APP_CONSTANTS.AUTH_COOKIE_NAME,
          value: verifiedJwt,
          expires: duration,
          httpOnly: false,
          maxAge: duration,
        });

        return res;
      } else {
        const isDocumentNavigation =
          request.headers.get("sec-fetch-mode") === "navigate" &&
          request.headers.get("next-router-prefetch") === null;

        const refreshed = isDocumentNavigation
          ? await refreshTokenOnEdge(
              request.cookies.get(APP_CONSTANTS.REFRESH_COOKIE_NAME)?.value
            )
          : null;

        if (refreshed) {
          const res = NextResponse.next();
          setAuthCookie(res, refreshed.token);
          if (refreshed.refreshToken) {
            res.cookies.set({
              name: APP_CONSTANTS.REFRESH_COOKIE_NAME,
              value: refreshed.refreshToken,
              path: "/",
              httpOnly: false,
            });
          }
          return res;
        }

        const refreshRejected = isDocumentNavigation;

        const dropSession = (response: NextResponse) => {
          response.cookies.delete(APP_CONSTANTS.AUTH_COOKIE_NAME);
          if (refreshRejected) {
            response.cookies.delete(APP_CONSTANTS.REFRESH_COOKIE_NAME);
          }
          return response;
        };

        if (isProtectedRoute) {
          return dropSession(
            NextResponse.redirect(new URL(APP_ROUTES.SIGN_IN, request.url))
          );
        }
        return dropSession(NextResponse.next());
      }
    }

    return next(request, _next);
  };
};
