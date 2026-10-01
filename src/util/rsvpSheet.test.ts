import { describe, expect, it } from "vitest";
import { buildRsvpRecord, type RsvpFormValues } from "./rsvpForm";
import { parseRsvpRows, recordToSheetRows, RSVP_HEADERS, sanitizeSheetCell } from "./rsvpSheet";

const baseValues = (): RsvpFormValues => ({
	country_residence: "nigeria",
	other_country: "",
	full_name: "Ada Okonkwo",
	email: "ada@example.com",
	phone: "+2348000000000",
	party_size: 1,
	plus_one_name: "",
	event_traditional: true,
	event_white: false,
	expected_arrival: "",
	expected_departure: "",
	guest_notes: "",
	relationship: "friend",
	message_couple: "See you soon!",
});

describe("recordToSheetRows", () => {
	it("maps Nigeria guest to one sheet row", () => {
		const rows = recordToSheetRows(buildRsvpRecord(baseValues()), {
			submittedAt: "2026-05-29T12:00:00.000Z",
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]?.full_name).toBe("Ada Okonkwo");
		expect(rows[0]?.guest_role).toBe("Primary");
		expect(rows[0]?.primary_guest).toBe("");
		expect(rows[0]?.country).toBe("Nigeria");
	});

	it("adds a second row for plus one so row count equals headcount", () => {
		const values = baseValues();
		values.party_size = 2;
		values.plus_one_name = "Jordan Lee";
		const rows = recordToSheetRows(buildRsvpRecord(values));
		expect(rows).toHaveLength(2);
		expect(rows[0]?.full_name).toBe("Ada Okonkwo");
		expect(rows[0]?.guest_role).toBe("Primary");
		expect(rows[1]?.full_name).toBe("Jordan Lee");
		expect(rows[1]?.guest_role).toBe("Plus one");
		expect(rows[1]?.primary_guest).toBe("Ada Okonkwo");
		expect(rows[1]?.email).toBe("");
		expect(rows[1]?.phone).toBe("");
		expect(rows[1]?.guest_notes).toBe("");
		expect(rows[1]?.message_couple).toBe("");
		expect(rows[1]?.country).toBe("Nigeria");
		expect(rows[1]?.relationship).toBe("friend");
		expect(rows[1]?.event_traditional).toBe("Yes");
		expect(rows[1]?.event_white).toBe("No");
		expect(rows[0]?.email).toBe("ada@example.com");
	});

	it("copies international travel dates onto the plus-one row", () => {
		const values = baseValues();
		values.country_residence = "uk";
		values.party_size = 2;
		values.plus_one_name = "Jordan Lee";
		values.expected_arrival = "2027-01-02";
		values.expected_departure = "2027-01-10";
		const rows = recordToSheetRows(buildRsvpRecord(values));
		expect(rows[1]?.expected_arrival).toBe("2027-01-02");
		expect(rows[1]?.expected_departure).toBe("2027-01-10");
		expect(rows[1]?.country).toBe("United Kingdom");
	});

	it("includes other country in country label when applicable", () => {
		const values = baseValues();
		values.country_residence = "other";
		values.other_country = "Canada";
		const rows = recordToSheetRows(buildRsvpRecord(values));
		expect(rows[0]?.country).toBe("Other (Canada)");
	});

	it("neutralizes spreadsheet formula injection in user text", () => {
		const values = baseValues();
		values.full_name = "=HYPERLINK(\"http://evil\",\"x\")";
		values.message_couple = "@SUM(A1:A2)";
		const rows = recordToSheetRows(buildRsvpRecord(values));
		expect(rows[0]?.full_name.startsWith("'=")).toBe(true);
		expect(rows[0]?.message_couple.startsWith("'@")).toBe(true);
	});

	it("leaves ordinary text untouched", () => {
		const values = baseValues();
		const rows = recordToSheetRows(buildRsvpRecord(values));
		expect(rows[0]?.full_name).toBe("Ada Okonkwo");
		expect(rows[0]?.email).toBe("ada@example.com");
	});
});

describe("sanitizeSheetCell", () => {
	it("prefixes values that start with a formula trigger", () => {
		for (const c of ["=", "+", "-", "@"]) {
			expect(sanitizeSheetCell(`${c}danger`)).toBe(`'${c}danger`);
		}
	});

	it("still flags + and - when followed by a function", () => {
		expect(sanitizeSheetCell("+HYPERLINK(1)")).toBe("'+HYPERLINK(1)");
		expect(sanitizeSheetCell("-cmd|x")).toBe("'-cmd|x");
	});

	it("leaves phone numbers alone", () => {
		expect(sanitizeSheetCell("+234 803 123 4567")).toBe("+234 803 123 4567");
		expect(sanitizeSheetCell("+2348031234567")).toBe("+2348031234567");
		expect(sanitizeSheetCell("+1 (214) 577-1936")).toBe("+1 (214) 577-1936");
	});

	it("does not touch safe values", () => {
		expect(sanitizeSheetCell("Ada")).toBe("Ada");
		expect(sanitizeSheetCell("a+b")).toBe("a+b");
		expect(sanitizeSheetCell("")).toBe("");
	});
});

describe("parseRsvpRows", () => {
	it("reads the RSVPs tab newest first, linking plus ones to their guest", () => {
		const blank = (overrides: Record<string, string>) =>
			RSVP_HEADERS.map((h) => overrides[h] ?? "");
		const guests = parseRsvpRows([
			[...RSVP_HEADERS],
			blank({ "Submitted At": "2026-10-01T10:00:00Z", "Full Name": "Ada Obi", "Guest Role": "Primary", Phone: "+2348031234567", Country: "Nigeria", "Traditional Event": "Yes", "White Wedding": "No" }),
			blank({ "Submitted At": "2026-10-01T10:00:00Z", "Full Name": "Jordan Lee", "Guest Role": "Plus one", "Primary Guest": "Ada Obi", "Traditional Event": "Yes" }),
			blank({ "Submitted At": "2026-10-02T09:00:00Z", "Full Name": "Chidi Eze", "Guest Role": "Primary", Country: "United Kingdom", "White Wedding": "Yes" }),
			blank({}),
		]);
		expect(guests.map((g) => g.name)).toEqual(["Chidi Eze", "Jordan Lee", "Ada Obi"]);
		expect(guests[1]).toMatchObject({ plusOneOf: "Ada Obi", traditional: true, white: false });
		expect(guests[2]).toMatchObject({ plusOneOf: "", phone: "+2348031234567", traditional: true });
	});
});
