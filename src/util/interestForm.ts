/** Shared "I'm interested" form used by /join (wedding train) and /asoebi. */

export const INTEREST_FIELD = {
	fullName: "full_name",
	email: "email",
	whatsapp: "whatsapp",
	events: "events",
} as const;

/** Hidden anti-spam field — real users never see or fill it. */
export const INTEREST_HONEYPOT_FIELD = "company";

export const INTEREST_MAX_LEN = {
	full_name: 100,
	email: 254,
	whatsapp: 32,
} as const;

export type InterestEvents = "traditional" | "white" | "both";

export const INTEREST_EVENT_LABELS: Record<InterestEvents, string> = {
	traditional: "Traditional Marriage",
	white: "White Wedding",
	both: "Both",
};

const EVENT_VALUES: ReadonlySet<string> = new Set(Object.keys(INTEREST_EVENT_LABELS));
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
/** Local (0803…) or international (+234…) numbers; spaces, dashes and brackets allowed. */
const WHATSAPP_RE = /^\+?[\d\s().-]+$/;

export type InterestRawFields = {
	full_name: string;
	email: string;
	whatsapp: string;
	events: string;
};

export type InterestValues = {
	full_name: string;
	email: string;
	whatsapp: string;
	events: InterestEvents;
};

export type InterestValidationResult =
	| { ok: true; values: InterestValues }
	| { ok: false; fieldErrors: Record<string, string> };

export const parseInterestFormData = (fd: FormData): InterestRawFields => ({
	full_name: String(fd.get(INTEREST_FIELD.fullName) ?? "").trim(),
	email: String(fd.get(INTEREST_FIELD.email) ?? "").trim(),
	whatsapp: String(fd.get(INTEREST_FIELD.whatsapp) ?? "").trim(),
	events: String(fd.get(INTEREST_FIELD.events) ?? "").trim(),
});

export const validateInterestForm = (raw: InterestRawFields): InterestValidationResult => {
	const fieldErrors: Record<string, string> = {};

	if (!raw.full_name) {
		fieldErrors[INTEREST_FIELD.fullName] = "Enter your full name.";
	} else if (raw.full_name.length > INTEREST_MAX_LEN.full_name) {
		fieldErrors[INTEREST_FIELD.fullName] = "Name is too long.";
	}

	// Email is optional; the WhatsApp number is how the couple follows up.
	if (raw.email.length > INTEREST_MAX_LEN.email) {
		fieldErrors[INTEREST_FIELD.email] = "Email is too long.";
	} else if (raw.email && !EMAIL_RE.test(raw.email)) {
		fieldErrors[INTEREST_FIELD.email] = "Enter a valid email address.";
	}

	const digits = raw.whatsapp.replace(/\D/g, "");
	if (!raw.whatsapp) {
		fieldErrors[INTEREST_FIELD.whatsapp] = "Enter your WhatsApp number.";
	} else if (raw.whatsapp.length > INTEREST_MAX_LEN.whatsapp) {
		fieldErrors[INTEREST_FIELD.whatsapp] = "Phone number is too long.";
	} else if (!WHATSAPP_RE.test(raw.whatsapp) || digits.length < 7 || digits.length > 15) {
		fieldErrors[INTEREST_FIELD.whatsapp] = "Enter a valid WhatsApp number.";
	}

	if (!EVENT_VALUES.has(raw.events)) {
		fieldErrors[INTEREST_FIELD.events] = "Choose Traditional, White Wedding or Both.";
	}

	if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

	return {
		ok: true,
		values: {
			full_name: raw.full_name,
			email: raw.email,
			whatsapp: raw.whatsapp,
			events: raw.events as InterestEvents,
		},
	};
};
