/**
 * Google Sheets access through the workbook's Apps Script web app
 * (apps-script/Code.gs). The site never talks to Google directly.
 */

export type SheetAppendResult =
	| { ok: true }
	| { ok: false; reason: "upstream" | "not_configured" };

export type SheetReadResult =
	| { ok: true; values: string[][] }
	| { ok: false; reason: "upstream" | "not_configured" };

const TIMEOUT_MS = 15_000;

// Astro compiles `import.meta.env.X` in at build time from .env files; `process.env`
// covers values that only exist at runtime (Vercel settings, shell variables).
const appsScriptUrl = (): string =>
	(import.meta.env.APPS_SCRIPT_URL || process.env.APPS_SCRIPT_URL || "").trim();
const appsScriptSecret = (): string =>
	(import.meta.env.APPS_SCRIPT_SECRET || process.env.APPS_SCRIPT_SECRET || "").trim();

export const isSheetsConfigured = (): boolean => Boolean(appsScriptUrl() && appsScriptSecret());

type ScriptReply = { ok?: boolean; error?: string; values?: unknown; code?: unknown };

const callAppsScript = async (
	action: "append" | "read" | "setStatus" | "addGuest",
	payload: Record<string, unknown>,
): Promise<{ ok: true; body: ScriptReply } | { ok: false; reason: "upstream" | "not_configured" }> => {
	const url = appsScriptUrl();
	const secret = appsScriptSecret();
	if (!url || !secret) return { ok: false, reason: "not_configured" };

	try {
		// text/plain keeps it a "simple" request; Apps Script reads e.postData.contents either way.
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "text/plain;charset=utf-8" },
			body: JSON.stringify({ secret, action, ...payload }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		const text = await response.text();
		let body: ScriptReply;
		try {
			body = JSON.parse(text) as ScriptReply;
		} catch {
			// Apps Script answers errors (bad deployment, quota) with an HTML page.
			console.error(`[appsScript] ${action}: non-JSON reply (HTTP ${response.status})`);
			return { ok: false, reason: "upstream" };
		}
		if (!response.ok || body.ok !== true) {
			console.error(`[appsScript] ${action} failed:`, body.error ?? `HTTP ${response.status}`);
			return { ok: false, reason: "upstream" };
		}
		return { ok: true, body };
	} catch (err) {
		console.error(`[appsScript] ${action} request failed:`, err);
		return { ok: false, reason: "upstream" };
	}
};

/** Adds rows to a tab (created if missing); headers are written when the tab is empty. */
export const appendRowsToSheet = async (
	sheetName: string,
	rows: string[][],
	opts?: { headers?: string[] },
): Promise<SheetAppendResult> => {
	const result = await callAppsScript("append", { sheet: sheetName, rows, headers: opts?.headers });
	return result.ok ? { ok: true } : result;
};

export type ResponseStatus = "Pending" | "Confirmed" | "Declined";

/**
 * Sets a response's Status on the Asoebi / Groomsmen tab. The row is found by its
 * Submitted At + Code. Confirming also updates the person's row on Guests.
 */
export const setResponseStatus = async (
	sheetName: string,
	submittedAt: string,
	code: string,
	status: ResponseStatus,
): Promise<SheetAppendResult> => {
	const result = await callAppsScript("setStatus", { sheet: sheetName, submittedAt, code, status });
	return result.ok ? { ok: true } : result;
};

export type NewGuest = {
	name: string;
	category: string;
	plusOne: number;
	asoebi: boolean;
	groomsmen: boolean;
};

/** Adds a row to Guests; the script gives it a code (and fills the link columns). */
export const addGuestToSheet = async (
	guest: NewGuest,
): Promise<{ ok: true; code: string } | { ok: false; reason: "upstream" | "not_configured" }> => {
	const result = await callAppsScript("addGuest", guest);
	if (!result.ok) return result;
	const code = String(result.body.code ?? "");
	return code ? { ok: true, code } : { ok: false, reason: "upstream" };
};

/** Reads a tab as text. The script only allows tabs listed in its READABLE_TABS. */
export const readSheetValues = async (sheetName: string): Promise<SheetReadResult> => {
	const result = await callAppsScript("read", { sheet: sheetName });
	if (!result.ok) return result;
	const values = result.body.values;
	if (!Array.isArray(values)) return { ok: false, reason: "upstream" };
	return {
		ok: true,
		values: values.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [])),
	};
};
