import { describe, expect, it } from "vitest";
import {
	buildRsvpRecord,
	parseRsvpFormData,
	RSVP_EVENTS_ERROR_KEY,
	RSVP_FIELD,
	RSVP_MAX_LEN,
	validateRsvpForm,
	type RsvpFormValues,
} from "./rsvpForm";

const fd = (extra: Record<string, string | Blob> = {}): FormData => {
	const f = new FormData();
	const base: Record<string, string> = {
		[RSVP_FIELD.fullName]: "Ada Okonkwo",
		[RSVP_FIELD.email]: "ada@example.com",
		[RSVP_FIELD.phone]: "+234 800 000 0000",
		[RSVP_FIELD.plusOneName]: "",
		[RSVP_FIELD.countryResidence]: "nigeria",
		[RSVP_FIELD.otherCountry]: "",
		[RSVP_FIELD.expectedArrival]: "",
		[RSVP_FIELD.expectedDeparture]: "",
		[RSVP_FIELD.guestNotes]: "",
		[RSVP_FIELD.messageCouple]: "",
		[RSVP_FIELD.relationship]: "",
		[RSVP_FIELD.eventTraditional]: "yes",
	};
	for (const [k, v] of Object.entries({ ...base, ...extra })) {
		if (typeof v === "string") f.set(k, v);
		else f.set(k, v);
	}
	return f;
};

describe("validateRsvpForm", () => {
	it("accepts complete Nigeria guest with one event", () => {
		const form = fd({
			[RSVP_FIELD.eventWhite]: "yes",
		});
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.values.country_residence).toBe("nigeria");
		expect(result.values.event_traditional).toBe(true);
		expect(result.values.event_white).toBe(true);
	});

	it("requires at least one event", () => {
		const form = fd();
		form.delete(RSVP_FIELD.eventTraditional);
		form.delete(RSVP_FIELD.eventWhite);
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_EVENTS_ERROR_KEY]).toBeDefined();
	});

	it("requires other country when coming from Other", () => {
		const form = fd({
			[RSVP_FIELD.countryResidence]: "other",
			[RSVP_FIELD.otherCountry]: "",
		});
		form.delete(RSVP_FIELD.eventWhite);
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.otherCountry]).toBeDefined();
	});

	it("treats Other + country as international and requires travel fields", () => {
		const form = fd({
			[RSVP_FIELD.countryResidence]: "other",
			[RSVP_FIELD.otherCountry]: "Canada",
			[RSVP_FIELD.expectedArrival]: "2027-01-01",
			[RSVP_FIELD.expectedDeparture]: "2027-01-10",
		});
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.values.country_residence).toBe("other");
		expect(result.values.other_country).toBe("Canada");
	});

	it("requires plus one name when plus one is checked", () => {
		const form = fd({
			[RSVP_FIELD.hasPlusOne]: "yes",
			[RSVP_FIELD.plusOneName]: "",
		});
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.plusOneName]).toBeDefined();
	});

	it("rejects invalid email", () => {
		const form = fd({ [RSVP_FIELD.email]: "not-an-email" });
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.email]).toBeDefined();
	});

	it("rejects phone without country code prefix when provided", () => {
		const form = fd({ [RSVP_FIELD.phone]: "2145771936" });
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.phone]).toBeDefined();
	});

	it("accepts phone with country code and formatting", () => {
		const form = fd({ [RSVP_FIELD.phone]: "+1 214-577-1936" });
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(true);
	});

	it("allows UK guests to leave travel dates blank", () => {
		const form = fd({
			[RSVP_FIELD.countryResidence]: "uk",
			[RSVP_FIELD.expectedArrival]: "",
			[RSVP_FIELD.expectedDeparture]: "",
		});
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(true);
	});

	it("rejects malformed travel dates for UK guests", () => {
		const form = fd({
			[RSVP_FIELD.countryResidence]: "uk",
			[RSVP_FIELD.expectedArrival]: "Jan 2",
			[RSVP_FIELD.expectedDeparture]: "2027/01/10",
		});
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.expectedArrival]).toBeDefined();
		expect(result.fieldErrors[RSVP_FIELD.expectedDeparture]).toBeDefined();
	});

	it("rejects departure before arrival for international", () => {
		const form = fd({
			[RSVP_FIELD.countryResidence]: "uk",
			[RSVP_FIELD.expectedArrival]: "2027-01-05",
			[RSVP_FIELD.expectedDeparture]: "2027-01-01",
		});
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.expectedDeparture]).toBeDefined();
	});

	it("rejects an over-long name", () => {
		const form = fd({ [RSVP_FIELD.fullName]: "a".repeat(RSVP_MAX_LEN.full_name + 1) });
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.fullName]).toBeDefined();
	});

	it("rejects an over-long guest note", () => {
		const form = fd({ [RSVP_FIELD.guestNotes]: "x".repeat(RSVP_MAX_LEN.guest_notes + 1) });
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.guestNotes]).toBeDefined();
	});

	it("rejects an over-long message to the couple", () => {
		const form = fd({
			[RSVP_FIELD.messageCouple]: "x".repeat(RSVP_MAX_LEN.message_couple + 1),
		});
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.fieldErrors[RSVP_FIELD.messageCouple]).toBeDefined();
	});

	it("accepts free-text at the maximum length", () => {
		const form = fd({
			[RSVP_FIELD.guestNotes]: "x".repeat(RSVP_MAX_LEN.guest_notes),
			[RSVP_FIELD.messageCouple]: "y".repeat(RSVP_MAX_LEN.message_couple),
		});
		const result = validateRsvpForm(parseRsvpFormData(form));
		expect(result.ok).toBe(true);
	});
});

describe("buildRsvpRecord", () => {
	it("nulls empty optionals", () => {
		const values: RsvpFormValues = {
			country_residence: "nigeria",
			other_country: "",
			full_name: "Test",
			email: "t@example.com",
			phone: "",
			party_size: 1,
			plus_one_name: "",
			event_traditional: true,
			event_white: false,
			expected_arrival: "",
			expected_departure: "",
			guest_notes: "",
			relationship: null,
			message_couple: "",
		};
		const row = buildRsvpRecord(values);
		expect(row.phone).toBeNull();
		expect(row.plus_one_name).toBeNull();
		expect(row.message_couple).toBeNull();
	});
});
