import type { APIRoute } from "astro";
import { event } from "@/config/event";
import { isSheetsConfigured } from "@/util/googleSheetsApi";
import { resolveInvitee, type InviteListKind } from "@/util/inviteList";
import {
	INTEREST_FIELD,
	INTEREST_HONEYPOT_FIELD,
	parseInterestFormData,
	validateInterestForm,
} from "@/util/interestForm";
import { normalizePhoneField } from "@/util/phoneNumber";
import { findResponseByCode, forwardInterestToGoogleSheet } from "@/util/interestSheet";
import { interestMessage, sendTelegram } from "@/util/notify";

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

/**
 * POST handler for an "I'm interested" form. Only guests whose code (the `c`
 * of their personal link) is ticked for this page can submit.
 */
export const createInterestHandler =
	(opts: { list: InviteListKind; sheetName: string }): APIRoute =>
	async ({ request }) => {
		if (!isSheetsConfigured()) {
			return json({ ok: false, kind: "not_configured" }, 503);
		}

		let formData: FormData;
		try {
			formData = await request.formData();
		} catch {
			return json({ ok: false, kind: "invalid_body", message: "Invalid form data." }, 400);
		}

		// Honeypot: bots fill the hidden field. Pretend success and drop the submission.
		if (String(formData.get(INTEREST_HONEYPOT_FIELD) ?? "").trim()) {
			return json({ ok: true });
		}

		const invitee = await resolveInvitee(opts.list, String(formData.get("c") ?? ""));
		if (!invitee) {
			return json(
				{ ok: false, kind: "not_invited", message: "This personal link isn't recognised." },
				403,
			);
		}

		const phoneError = normalizePhoneField(
			formData,
			INTEREST_FIELD.whatsapp,
			"Enter a valid WhatsApp number.",
		);
		const validation = validateInterestForm(parseInterestFormData(formData));
		if (phoneError || !validation.ok) {
			const fieldErrors = validation.ok ? {} : validation.fieldErrors;
			if (phoneError) fieldErrors[INTEREST_FIELD.whatsapp] = phoneError;
			return json({ ok: false, kind: "validation", fieldErrors }, 400);
		}

		// One registration per personal link; changes go through the couple.
		if (await findResponseByCode(opts.sheetName, invitee.code)) {
			return json(
				{
					ok: false,
					kind: "duplicate",
					message: `You've already registered your interest. To change anything, message us on WhatsApp: ${event.contactWhatsApp}.`,
				},
				409,
			);
		}

		const forwarded = await forwardInterestToGoogleSheet(opts.sheetName, invitee.code, validation.values);
		if (!forwarded.ok) {
			return json(
				{
					ok: false,
					kind: "upstream",
					message: "Could not save your details. Please try again in a moment.",
				},
				502,
			);
		}

		await sendTelegram(interestMessage(opts.list, validation.values));
		return json({ ok: true });
	};
