import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Numbers typed without a country code (e.g. 0803…) are read as Nigerian. */
export const DEFAULT_PHONE_COUNTRY = "NG";

/**
 * Normalises a phone number to E.164 (+2348031234567), or null when it isn't a
 * valid number. The browser's phone input already sends E.164; this covers
 * everything else (no JavaScript, pasted numbers) and re-checks on the server.
 */
export const toE164 = (raw: string | null | undefined): string | null => {
	const trimmed = (raw ?? "").trim();
	if (!trimmed) return null;
	const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_PHONE_COUNTRY);
	return parsed?.isValid() ? parsed.number : null;
};

/**
 * Replaces a form's phone field with its E.164 form. Returns an error message
 * when the field has a value that isn't a valid number; empty fields are left
 * for the form's own required/optional rules.
 */
export const normalizePhoneField = (
	formData: FormData,
	field: string,
	message: string,
): string | null => {
	const raw = String(formData.get(field) ?? "").trim();
	if (!raw) return null;
	const e164 = toE164(raw);
	if (!e164) return message;
	formData.set(field, e164);
	return null;
};
