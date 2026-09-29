import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { event } from "@/config/event";

export const GATE_COOKIE = "site_gate";
export const GATE_TTL_SECONDS = 36 * 60 * 60;

/**
 * The gate is on only when `event.passwordGate` is true and SITE_GATE_PASSWORD
 * is set; "" means off. Never expose this to the client.
 */
export const getGatePassword = (): string =>
	event.passwordGate ? (import.meta.env.SITE_GATE_PASSWORD?.trim() ?? "") : "";

const sha256 = (value: string): Buffer => createHash("sha256").update(value).digest();

/** Constant-time string comparison (hashing first makes the lengths equal). */
export const safeEqual = (a: string, b: string): boolean =>
	timingSafeEqual(sha256(a), sha256(b));

/** What a token unlocks; part of the signature so a token for one can't open the other. */
export type TokenPurpose = "site-gate" | "admin";

const sign = (expiresAt: number, password: string, purpose: TokenPurpose): string =>
	createHmac("sha256", password).update(`${purpose}:${expiresAt}`).digest("base64url");

/**
 * Cookie value proving the visitor entered the password: `<expiresAt>.<hmac>`.
 * Keyed on the password itself, so changing the password logs everyone out.
 */
export const createGateToken = (
	password: string,
	now = Date.now(),
	opts: { purpose?: TokenPurpose; ttlSeconds?: number } = {},
): string => {
	const expiresAt = Math.floor(now / 1000) + (opts.ttlSeconds ?? GATE_TTL_SECONDS);
	return `${expiresAt}.${sign(expiresAt, password, opts.purpose ?? "site-gate")}`;
};

export const verifyGateToken = (
	token: string,
	password: string,
	now = Date.now(),
	purpose: TokenPurpose = "site-gate",
): boolean => {
	const [expiresRaw, signature, ...rest] = token.split(".");
	if (!expiresRaw || !signature || rest.length > 0) return false;
	const expiresAt = Number(expiresRaw);
	if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= now) return false;
	return safeEqual(signature, sign(expiresAt, password, purpose));
};

/** Marks this browser as past the password gate (after the password or a valid invite link). */
export const setGateCookie = (cookies: AstroCookies, password: string, secure: boolean): void => {
	cookies.set(GATE_COOKIE, createGateToken(password), {
		path: "/",
		httpOnly: true,
		secure,
		sameSite: "lax",
		maxAge: GATE_TTL_SECONDS,
	});
};

/** Only allow same-site relative redirects after unlocking. */
export const safeNextPath = (value: unknown): string => {
	if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
		return "/";
	}
	return value;
};
