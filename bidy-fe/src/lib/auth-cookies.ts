import { parseCookies, setCookie, destroyCookie } from "nookies";

// Base cookie options, minus `secure` — that's resolved per-call in setAppCookie
// since it depends on window, which isn't available at module-load time in SSR.
const cookieOptions = {
  maxAge: 30 * 24 * 60 * 60, // 30 days
  path: "/",
  // Use Lax so cookies are sent on same-site navigations (e.g. typing URL, Link)
  // Strict can cause cookies to be omitted in some navigation flows
  sameSite: "lax" as const,
};

export const setAppCookie = (key: string, value: string) => {
  // A Secure cookie is dropped by the browser on a plain-HTTP origin, which is
  // all we have right now (no TLS on nginx yet) — NODE_ENV alone doesn't tell
  // us that, so check the page's actual protocol instead. This self-corrects
  // once HTTPS is added.
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  setCookie(null, key, value, { ...cookieOptions, secure });
};
export const getAppCookie = (key: string) => {
  const cookies = parseCookies();
  return cookies[key];
};

export const removeCookie = (key: string) => {
  destroyCookie(undefined, key, { path: "/" });
};
