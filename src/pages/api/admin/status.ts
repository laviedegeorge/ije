import type { APIRoute } from "astro";
import { event } from "@/config/event";
import { isAdmin } from "@/util/adminAuth";
import { setResponseStatus, type ResponseStatus } from "@/util/googleSheetsApi";

export const prerender = false;

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const TABS: Record<string, string> = {
	asoebi: event.sheets.asoebi,
	groomsmen: event.sheets.groomsmen,
};
const STATUSES: ReadonlySet<string> = new Set(["Pending", "Confirmed", "Declined"]);

/** Admin: set a response's Status (Confirming also updates the guest list). */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAdmin(cookies)) return json({ ok: false, kind: "unauthorized" }, 401);

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ ok: false, kind: "invalid_body" }, 400);
	}

	const sheet = TABS[String(body.list ?? "")];
	const status = String(body.status ?? "");
	const submittedAt = String(body.submittedAt ?? "");
	const code = String(body.code ?? "");
	if (!sheet || !STATUSES.has(status) || !submittedAt || !code) {
		return json({ ok: false, kind: "invalid_body" }, 400);
	}

	const result = await setResponseStatus(sheet, submittedAt, code, status as ResponseStatus);
	if (!result.ok) {
		return json({ ok: false, kind: result.reason, message: "Couldn't update the sheet. Try again." }, 502);
	}
	return json({ ok: true });
};
