import type { APIRoute } from "astro";
import { event } from "@/config/event";
import { normalizePhoneField } from "@/util/phoneNumber";
import {
	buildRsvpRecord,
	parseRsvpFormData,
	RSVP_FIELD,
	RSVP_HONEYPOT_FIELD,
	validateRsvpForm,
} from "@/util/rsvpForm";
import { isSheetsConfigured } from "@/util/googleSheetsApi";
import { forwardRsvpToGoogleSheet, hasRsvpForPhone } from "@/util/rsvpSheet";
import { rsvpMessage, sendTelegram } from "@/util/notify";

export const prerender = false;

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

export const POST: APIRoute = async ({ request }) => {
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
	if (String(formData.get(RSVP_HONEYPOT_FIELD) ?? "").trim()) {
		return json({ ok: true });
	}

	const phoneError = normalizePhoneField(formData, RSVP_FIELD.phone, "Enter a valid phone number.");
	const validation = validateRsvpForm(parseRsvpFormData(formData));
	if (phoneError || !validation.ok) {
		const fieldErrors = validation.ok ? {} : validation.fieldErrors;
		if (phoneError) fieldErrors[RSVP_FIELD.phone] = phoneError;
		return json(
			{ ok: false, kind: "validation", fieldErrors },
			400,
		);
	}

	const record = buildRsvpRecord(validation.values);

	// One RSVP per phone number; changes go through the couple.
	if (await hasRsvpForPhone(record.phone)) {
		return json(
			{
				ok: false,
				kind: "duplicate",
				message: `We already have an RSVP for this number. To change anything, message us on WhatsApp: ${event.contactWhatsApp}.`,
			},
			409,
		);
	}
	const forwarded = await forwardRsvpToGoogleSheet(record);

	if (!forwarded.ok) {
		return json(
			{
				ok: false,
				kind: "upstream",
				message: "Could not save your RSVP. Please try again in a moment.",
			},
			502,
		);
	}

	await sendTelegram(rsvpMessage(record));
	return json({ ok: true });
};

export const ALL: APIRoute = () =>
	json({ ok: false, message: "Method not allowed." }, 405);
