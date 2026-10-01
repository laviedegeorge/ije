import { defineMiddleware } from "astro:middleware";
import { isDisabledPath } from "@/config/event";
import { isValidInviteCode, type InviteListKind } from "@/util/inviteList";
import { GATE_COOKIE, getGatePassword, setGateCookie, verifyGateToken } from "@/util/siteGate";

/** Reachable without the site password. */
const UNGATED_PATHS = new Set(["/unlock", "/api/unlock"]);

/** Personal-link pages: a valid `?c=` code stands in for the site password. */
const INVITE_PAGES: Record<string, InviteListKind> = {
	"/asoebi": "asoebi",
	"/join": "join",
};

/**
 * Sent with every page and API response. No full Content-Security-Policy yet:
 * the pages use inline scripts, Google Fonts and Vercel Analytics.
 */
const SECURITY_HEADERS: Record<string, string> = {
	"X-Content-Type-Options": "nosniff",
	// Personal links carry a code; other sites only ever see the origin.
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"X-Frame-Options": "DENY",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

const withSecurityHeaders = (response: Response): Response => {
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		try {
			response.headers.set(name, value);
		} catch {
			// Some responses (e.g. Response.redirect) have read-only headers.
			return response;
		}
	}
	return response;
};

export const onRequest = defineMiddleware(async (context, next) =>
	withSecurityHeaders(await handleRequest(context, next)),
);

const handleRequest: Parameters<typeof defineMiddleware>[0] = async (context, next) => {
	const pathname = context.url.pathname.replace(/\/+$/, "") || "/";

	if (isDisabledPath(pathname)) {
		return pathname.startsWith("/api/")
			? new Response("Not found", { status: 404 })
			: context.rewrite("/404");
	}

	const password = getGatePassword();
	if (!password || UNGATED_PATHS.has(pathname)) {
		return next();
	}

	const token = context.cookies.get(GATE_COOKIE)?.value;
	if (token && verifyGateToken(token, password)) {
		return next();
	}

	// A guest opening their own invite link gets in without the password, and stays
	// unlocked so they can browse the rest of the site. Only codes read from the
	// sheet count; during an outage they fall back to the password page.
	const inviteKind = INVITE_PAGES[pathname];
	if (inviteKind && (await isValidInviteCode(inviteKind, context.url.searchParams.get("c")))) {
		setGateCookie(context.cookies, password, context.url.protocol === "https:");
		return next();
	}

	if (pathname.startsWith("/api/")) {
		return new Response(JSON.stringify({ ok: false, kind: "locked" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const nextPath = `${context.url.pathname}${context.url.search}`;
	return context.redirect(`/unlock?next=${encodeURIComponent(nextPath)}`, 303);
};
