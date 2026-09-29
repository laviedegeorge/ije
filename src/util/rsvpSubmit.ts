export const RSVP_SUBMIT_COPY = {
	submitting: "Submitting…",
	submitLabel: "Submit RSVP",
	networkError: "We couldn’t reach the server. Check your connection and try again.",
	serverError: "Something went wrong saving your RSVP. Please try again in a moment.",
	notConfigured:
		"We couldn’t save your RSVP right now. Please try again in a little while, or contact us if it keeps happening.",
} as const;

import { parseApiBody } from "@/util/apiResponse";

export type RsvpClientSubmitResult =
	| { ok: true }
	| { ok: false; kind: "validation"; fieldErrors: Record<string, string> }
	| { ok: false; kind: "network" | "server" | "not_configured"; message: string };

/** POST form data to the site API (validates again server-side, then appends to Google Sheets). */
export const submitRsvpFormData = async (
	formData: FormData,
): Promise<RsvpClientSubmitResult> => {
	let response: Response;
	try {
		response = await fetch("/api/rsvp", {
			method: "POST",
			body: formData,
		});
	} catch {
		return { ok: false, kind: "network", message: RSVP_SUBMIT_COPY.networkError };
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return { ok: false, kind: "server", message: RSVP_SUBMIT_COPY.serverError };
	}

	const data = parseApiBody(body);

	if (response.status === 503 && data?.kind === "not_configured") {
		if (import.meta.env.DEV) {
			console.warn(
				"[RSVP] APPS_SCRIPT_URL / APPS_SCRIPT_SECRET are not set — submissions will fail until they are configured (see .env.example).",
			);
		}
		return { ok: false, kind: "not_configured", message: RSVP_SUBMIT_COPY.notConfigured };
	}

	if (response.status === 400 && data?.kind === "validation" && data.fieldErrors) {
		return { ok: false, kind: "validation", fieldErrors: data.fieldErrors };
	}

	if (!response.ok || data?.ok === false) {
		return {
			ok: false,
			kind: "server",
			message: data?.message ?? RSVP_SUBMIT_COPY.serverError,
		};
	}

	return { ok: true };
};
