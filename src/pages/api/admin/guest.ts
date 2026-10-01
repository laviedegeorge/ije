import type { APIRoute } from "astro";
import { isAdmin } from "@/util/adminAuth";
import { addGuestToSheet } from "@/util/googleSheetsApi";
import { resetGuestCache } from "@/util/inviteList";
import { validateNewInvitee } from "@/util/inviteLinks";

export const prerender = false;

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

/** Admin: add an asoebi / groomsmen invitee to the Guests tab and return their code. */
export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAdmin(cookies)) return json({ ok: false, kind: "unauthorized" }, 401);

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ ok: false, kind: "invalid_body" }, 400);
	}

	const checked = validateNewInvitee(body);
	if (!checked.ok) return json({ ok: false, kind: "validation", message: checked.message }, 400);

	const result = await addGuestToSheet(checked.value);
	if (!result.ok) {
		return json({ ok: false, kind: result.reason, message: "Couldn't add them to the sheet. Try again." }, 502);
	}

	// So their link works straight away on this server instead of after the cache expires.
	resetGuestCache();
	return json({ ok: true, code: result.code, name: checked.value.name });
};
