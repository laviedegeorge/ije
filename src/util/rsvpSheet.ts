import type { CountryResidence, RsvpRecord } from "@/util/rsvpForm";
import { event } from "@/config/event";
import { appendRowsToSheet } from "@/util/googleSheetsApi";
import { sanitizeSheetCell } from "@/util/sheetCell";

export { sanitizeSheetCell };

const SHEET_NAME = event.sheets.rsvp;

const COUNTRY_LABELS: Record<CountryResidence, string> = {
	nigeria: "Nigeria",
	uk: "United Kingdom",
	usa: "United States",
	other: "Other",
};

const boolLabel = (value: boolean): string => (value ? "Yes" : "No");

const sanitizeRow = (row: RsvpSheetGuestRow): RsvpSheetGuestRow => {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(row)) {
		out[key] = sanitizeSheetCell(value);
	}
	return out as RsvpSheetGuestRow;
};

/** One spreadsheet row = one attending guest. */
export type RsvpSheetGuestRow = {
	submitted_at: string;
	full_name: string;
	guest_role: "Primary" | "Plus one";
	primary_guest: string;
	email: string;
	phone: string;
	country: string;
	other_country: string;
	event_traditional: string;
	event_white: string;
	expected_arrival: string;
	expected_departure: string;
	guest_notes: string;
	relationship: string;
	message_couple: string;
};

const countryLabelForRecord = (record: RsvpRecord): { country: string; other_country: string } => {
	const countryLabel = COUNTRY_LABELS[record.country_residence];
	const country =
		record.country_residence === "other" && record.other_country
			? `${countryLabel} (${record.other_country})`
			: countryLabel;
	return {
		country,
		other_country: record.other_country ?? "",
	};
};

/** Plus-one row: shared trip/event fields only — no email, phone, or free-text duplicates. */
const plusOneRowFields = (
	record: RsvpRecord,
	submittedAt: string,
): Omit<RsvpSheetGuestRow, "full_name" | "guest_role" | "primary_guest"> => {
	const primary = primaryGuestFields(record, submittedAt);
	return {
		submitted_at: primary.submitted_at,
		email: "",
		phone: "",
		country: primary.country,
		other_country: primary.other_country,
		event_traditional: primary.event_traditional,
		event_white: primary.event_white,
		expected_arrival: primary.expected_arrival,
		expected_departure: primary.expected_departure,
		guest_notes: "",
		relationship: primary.relationship,
		message_couple: "",
	};
};

const primaryGuestFields = (
	record: RsvpRecord,
	submittedAt: string,
): Omit<RsvpSheetGuestRow, "full_name" | "guest_role" | "primary_guest"> => {
	const { country, other_country } = countryLabelForRecord(record);
	return {
		submitted_at: submittedAt,
		email: record.email,
		phone: record.phone ?? "",
		country,
		other_country,
		event_traditional: boolLabel(record.event_traditional),
		event_white: boolLabel(record.event_white),
		expected_arrival: record.expected_arrival ?? "",
		expected_departure: record.expected_departure ?? "",
		guest_notes: record.guest_notes ?? "",
		relationship: record.relationship ?? "",
		message_couple: record.message_couple ?? "",
	};
};

/** Build one sheet row per guest (plus one gets their own row). */
export const recordToSheetRows = (
	record: RsvpRecord,
	opts?: { submittedAt?: string },
): RsvpSheetGuestRow[] => {
	const submittedAt = opts?.submittedAt ?? new Date().toISOString();
	const primaryFields = primaryGuestFields(record, submittedAt);

	const rows: RsvpSheetGuestRow[] = [
		{
			...primaryFields,
			full_name: record.full_name,
			guest_role: "Primary",
			primary_guest: "",
		},
	];

	const plusOne = record.plus_one_name?.trim();
	if (record.party_size > 1 && plusOne) {
		rows.push({
			...plusOneRowFields(record, submittedAt),
			full_name: plusOne,
			guest_role: "Plus one",
			primary_guest: record.full_name,
		});
	}

	return rows.map(sanitizeRow);
};

const rowToValues = (row: RsvpSheetGuestRow): string[] => [
	row.submitted_at,
	row.full_name,
	row.guest_role,
	row.primary_guest,
	row.email,
	row.phone,
	row.country,
	row.other_country,
	row.event_traditional,
	row.event_white,
	row.expected_arrival,
	row.expected_departure,
	row.guest_notes,
	row.relationship,
	row.message_couple,
];

export type ForwardRsvpResult = { ok: true } | { ok: false; reason: "upstream" };

export const forwardRsvpToGoogleSheet = async (
	record: RsvpRecord,
	opts?: { submittedAt?: string },
): Promise<ForwardRsvpResult> => {
	const rows = recordToSheetRows(record, opts).map(rowToValues);
	const result = await appendRowsToSheet(SHEET_NAME, rows, {
		headers: [
			"Submitted At", "Full Name", "Guest Role", "Primary Guest",
			"Email", "Phone", "Country", "Other Country",
			"Traditional Event", "White Wedding", "Expected Arrival", "Expected Departure",
			"Guest Notes", "Relationship", "Message for Couple",
		],
	});
	if (!result.ok) return { ok: false, reason: "upstream" };
	return { ok: true };
};
