import type { AstroCookies } from "astro";
import { createGateToken, safeEqual, verifyGateToken } from "@/util/siteGate";

export const ADMIN_COOKIE = "site_admin";
export const ADMIN_TTL_SECONDS = 12 * 60 * 60;

/** The admin page is off unless ADMIN_CODE is set. Server-side only. */
export const getAdminCode = (): string =>
	(import.meta.env.ADMIN_CODE || process.env.ADMIN_CODE || "").trim();

export const isAdminCodeCorrect = (attempt: string): boolean => {
	const code = getAdminCode();
	return Boolean(code) && safeEqual(attempt.trim(), code);
};

export const isAdmin = (cookies: AstroCookies): boolean => {
	const code = getAdminCode();
	const token = cookies.get(ADMIN_COOKIE)?.value;
	return Boolean(code && token && verifyGateToken(token, code, Date.now(), "admin"));
};

export const setAdminCookie = (cookies: AstroCookies, secure: boolean): void => {
	cookies.set(
		ADMIN_COOKIE,
		createGateToken(getAdminCode(), Date.now(), { purpose: "admin", ttlSeconds: ADMIN_TTL_SECONDS }),
		{ path: "/", httpOnly: true, secure, sameSite: "strict", maxAge: ADMIN_TTL_SECONDS },
	);
};

export const clearAdminCookie = (cookies: AstroCookies): void => {
	cookies.delete(ADMIN_COOKIE, { path: "/" });
};
