export const RSVP_FIELD = {
	hasPlusOne: "has_plus_one",
	plusOneName: "plus_one_name",
	fullName: "full_name",
	email: "email",
	phone: "phone",
	countryResidence: "country_residence",
	otherCountry: "other_country",
	eventTraditional: "event_traditional",
	eventWhite: "event_white",
	expectedArrival: "expected_arrival",
	expectedDeparture: "expected_departure",
	guestNotes: "guest_notes",
	relationship: "relationship",
	messageCouple: "message_couple",
} as const;

export const RSVP_EVENTS_ERROR_KEY = "events";

/** Hidden anti-spam field — real users never see or fill it. */
export const RSVP_HONEYPOT_FIELD = "company";

/** Max character lengths for free-text fields (defense against oversized payloads). */
export const RSVP_MAX_LEN = {
	full_name: 100,
	email: 254,
	phone: 32,
	other_country: 60,
	plus_one_name: 100,
	guest_notes: 1000,
	message_couple: 1000,
} as const;

export type CountryResidence = "nigeria" | "uk" | "usa" | "other";

export type Relationship = "family" | "friend" | "colleague" | "church" | "other";

export type RsvpFormValues = {
	country_residence: CountryResidence;
	other_country: string;
	full_name: string;
	email: string;
	phone: string;
	party_size: number;
	plus_one_name: string;
	event_traditional: boolean;
	event_white: boolean;
	expected_arrival: string;
	expected_departure: string;
	guest_notes: string;
	relationship: Relationship | null;
	message_couple: string;
};

export type RsvpRecord = {
	country_residence: CountryResidence;
	other_country: string | null;
	full_name: string;
	email: string | null;
	phone: string;
	party_size: number;
	plus_one_name: string | null;
	event_traditional: boolean;
	event_white: boolean;
	expected_arrival: string | null;
	expected_departure: string | null;
	guest_notes: string | null;
	relationship: Relationship | null;
	message_couple: string | null;
};

const COUNTRY: ReadonlySet<string> = new Set(["nigeria", "uk", "usa", "other"]);
const RELATIONSHIP: ReadonlySet<string> = new Set([
	"family",
	"friend",
	"colleague",
	"church",
	"other",
]);

const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_WITH_COUNTRY_RE = /^\+[\d\s().-]+$/;

const phoneDigitCount = (raw: string): number => (raw.match(/\d/g) ?? []).length;

const checkboxOn = (fd: FormData, name: string): boolean =>
	String(fd.get(name) ?? "").toLowerCase() === "yes" || fd.get(name) === "on";

export const isInternationalResidence = (c: CountryResidence): boolean => c !== "nigeria";

export const parseCountryResidence = (raw: string | null | undefined): CountryResidence | null => {
	if (raw == null || raw === "") return null;
	return COUNTRY.has(raw) ? (raw as CountryResidence) : null;
};

export type RsvpRawFormFields = {
	country_residence: string;
	other_country: string;
	full_name: string;
	email: string;
	phone: string;
	has_plus_one: boolean;
	plus_one_name: string;
	event_traditional: boolean;
	event_white: boolean;
	expected_arrival: string;
	expected_departure: string;
	guest_notes: string;
	relationship: string;
	message_couple: string;
};

export const parseRsvpFormData = (fd: FormData): RsvpRawFormFields => ({
	country_residence: String(fd.get(RSVP_FIELD.countryResidence) ?? "").trim(),
	other_country: String(fd.get(RSVP_FIELD.otherCountry) ?? "").trim(),
	full_name: String(fd.get(RSVP_FIELD.fullName) ?? "").trim(),
	email: String(fd.get(RSVP_FIELD.email) ?? "").trim(),
	phone: String(fd.get(RSVP_FIELD.phone) ?? "").trim(),
	has_plus_one: checkboxOn(fd, RSVP_FIELD.hasPlusOne),
	plus_one_name: String(fd.get(RSVP_FIELD.plusOneName) ?? "").trim(),
	event_traditional: checkboxOn(fd, RSVP_FIELD.eventTraditional),
	event_white: checkboxOn(fd, RSVP_FIELD.eventWhite),
	expected_arrival: String(fd.get(RSVP_FIELD.expectedArrival) ?? "").trim(),
	expected_departure: String(fd.get(RSVP_FIELD.expectedDeparture) ?? "").trim(),
	guest_notes: String(fd.get(RSVP_FIELD.guestNotes) ?? "").trim(),
	relationship: String(fd.get(RSVP_FIELD.relationship) ?? "").trim(),
	message_couple: String(fd.get(RSVP_FIELD.messageCouple) ?? "").trim(),
});

export type RsvpValidationOk = { ok: true; values: RsvpFormValues };
export type RsvpValidationErr = { ok: false; fieldErrors: Record<string, string> };
export type RsvpValidationResult = RsvpValidationOk | RsvpValidationErr;

const err = (fieldErrors: Record<string, string>): RsvpValidationErr => ({
	ok: false,
	fieldErrors,
});

export const validateRsvpForm = (raw: ReturnType<typeof parseRsvpFormData>): RsvpValidationResult => {
	const fieldErrors: Record<string, string> = {};

	const country = parseCountryResidence(raw.country_residence);
	if (!country) {
		fieldErrors[RSVP_FIELD.countryResidence] = "Please tell us where you’re coming from.";
	}

	if (country === "other") {
		if (!raw.other_country) {
			fieldErrors[RSVP_FIELD.otherCountry] = "Enter your country.";
		} else if (raw.other_country.length < 2) {
			fieldErrors[RSVP_FIELD.otherCountry] = "Country name looks too short.";
		} else if (raw.other_country.length > RSVP_MAX_LEN.other_country) {
			fieldErrors[RSVP_FIELD.otherCountry] = "Country name is too long.";
		}
	}

	if (!raw.full_name) {
		fieldErrors[RSVP_FIELD.fullName] = "Enter your full name.";
	} else if (raw.full_name.length < 2) {
		fieldErrors[RSVP_FIELD.fullName] = "Name looks too short.";
	} else if (raw.full_name.length > RSVP_MAX_LEN.full_name) {
		fieldErrors[RSVP_FIELD.fullName] = "Name is too long.";
	}

	// Email is optional; the phone number is how the couple reaches guests.
	if (raw.email.length > RSVP_MAX_LEN.email) {
		fieldErrors[RSVP_FIELD.email] = "Email is too long.";
	} else if (raw.email && !EMAIL_RE.test(raw.email)) {
		fieldErrors[RSVP_FIELD.email] = "Enter a valid email address.";
	}

	if (!raw.phone) {
		fieldErrors[RSVP_FIELD.phone] = "Enter your phone number.";
	} else {
		if (raw.phone.length > RSVP_MAX_LEN.phone) {
			fieldErrors[RSVP_FIELD.phone] = "Phone number is too long.";
		} else if (!PHONE_WITH_COUNTRY_RE.test(raw.phone)) {
			fieldErrors[RSVP_FIELD.phone] =
				"Include country code starting with + (e.g. +1 214-577-1936).";
		} else if (phoneDigitCount(raw.phone) < 10) {
			fieldErrors[RSVP_FIELD.phone] = "Enter a valid phone number with country code.";
		}
	}

	const hasPlus = raw.has_plus_one;
	const partyN = hasPlus ? 2 : 1;

	if (hasPlus) {
		if (!raw.plus_one_name.trim()) {
			fieldErrors[RSVP_FIELD.plusOneName] = "Enter your guest’s name (plus one).";
		} else if (raw.plus_one_name.trim().length < 2) {
			fieldErrors[RSVP_FIELD.plusOneName] = "Name looks too short.";
		} else if (raw.plus_one_name.trim().length > RSVP_MAX_LEN.plus_one_name) {
			fieldErrors[RSVP_FIELD.plusOneName] = "Name is too long.";
		}
	}

	if (raw.guest_notes.length > RSVP_MAX_LEN.guest_notes) {
		fieldErrors[RSVP_FIELD.guestNotes] = "Please shorten your note a little.";
	}

	if (raw.message_couple.length > RSVP_MAX_LEN.message_couple) {
		fieldErrors[RSVP_FIELD.messageCouple] = "Please shorten your message a little.";
	}

	if (!raw.event_traditional && !raw.event_white) {
		fieldErrors[RSVP_EVENTS_ERROR_KEY] = "Choose at least one event you plan to attend.";
	}

	let expected_arrival = raw.expected_arrival;
	let expected_departure = raw.expected_departure;
	let other_country = country === "other" ? raw.other_country.trim() : "";

	if (country && isInternationalResidence(country)) {
		if (expected_arrival && (!ISO_DATE.test(expected_arrival))) {
			fieldErrors[RSVP_FIELD.expectedArrival] = "Use the date picker (YYYY-MM-DD).";
		}
		if (expected_departure && (!ISO_DATE.test(expected_departure))) {
			fieldErrors[RSVP_FIELD.expectedDeparture] = "Use the date picker (YYYY-MM-DD).";
		}
		if (expected_arrival && expected_departure && ISO_DATE.test(expected_arrival) && ISO_DATE.test(expected_departure)) {
			if (expected_departure < expected_arrival) {
				fieldErrors[RSVP_FIELD.expectedDeparture] = "Departure should be on or after arrival.";
			}
		}
	} else {
		expected_arrival = "";
		expected_departure = "";
	}

	if (Object.keys(fieldErrors).length) return err(fieldErrors);

	const relRaw = raw.relationship;
	const relationship =
		relRaw && RELATIONSHIP.has(relRaw) ? (relRaw as Relationship) : null;

	return {
		ok: true,
		values: {
			country_residence: country!,
			other_country,
			full_name: raw.full_name,
			email: raw.email.toLowerCase(),
			phone: raw.phone,
			party_size: partyN,
			plus_one_name: partyN > 1 ? raw.plus_one_name.trim() : "",
			event_traditional: raw.event_traditional,
			event_white: raw.event_white,
			expected_arrival,
			expected_departure,
			guest_notes: raw.guest_notes,
			relationship,
			message_couple: raw.message_couple,
		},
	};
};

/** Normalized RSVP row sent to the Google Sheet webhook. */
export const buildRsvpRecord = (values: RsvpFormValues): RsvpRecord => ({
	country_residence: values.country_residence,
	other_country: values.other_country.trim() ? values.other_country.trim() : null,
	full_name: values.full_name,
	email: values.email ? values.email : null,
	phone: values.phone.trim(),
	party_size: values.party_size,
	plus_one_name: values.plus_one_name.trim() ? values.plus_one_name.trim() : null,
	event_traditional: values.event_traditional,
	event_white: values.event_white,
	expected_arrival: values.expected_arrival.trim() ? values.expected_arrival.trim() : null,
	expected_departure: values.expected_departure.trim() ? values.expected_departure.trim() : null,
	guest_notes: values.guest_notes.trim() ? values.guest_notes.trim() : null,
	relationship: values.relationship,
	message_couple: values.message_couple.trim() ? values.message_couple.trim() : null,
});
