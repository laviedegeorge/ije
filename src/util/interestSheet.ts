import { appendRowsToSheet, type ResponseStatus } from "@/util/googleSheetsApi";
import { headerColumns } from "@/util/inviteList";
import { INTEREST_EVENT_LABELS, type InterestValues } from "@/util/interestForm";
import { sanitizeSheetCell } from "@/util/sheetCell";

/** Columns of the Asoebi / Groomsmen tabs. Must match RESPONSE_HEADERS in apps-script/Code.gs. */
export const RESPONSE_HEADERS = [
	"Submitted At",
	"Code",
	"Name",
	"Email",
	"WhatsApp",
	"Events",
	"Status",
] as const;

export type InterestResponse = {
	submittedAt: string;
	code: string;
	name: string;
	email: string;
	whatsapp: string;
	events: string;
	status: ResponseStatus;
};

export const interestToSheetRow = (
	code: string,
	values: InterestValues,
	opts?: { submittedAt?: string },
): string[] =>
	[
		opts?.submittedAt ?? new Date().toISOString(),
		code,
		values.full_name,
		values.email,
		values.whatsapp,
		INTEREST_EVENT_LABELS[values.events],
		"Pending",
	].map(sanitizeSheetCell);

export const forwardInterestToGoogleSheet = async (
	sheetName: string,
	code: string,
	values: InterestValues,
): Promise<{ ok: boolean }> => {
	const result = await appendRowsToSheet(sheetName, [interestToSheetRow(code, values)], {
		headers: [...RESPONSE_HEADERS],
	});
	return { ok: result.ok };
};

const STATUSES: ReadonlySet<string> = new Set(["Pending", "Confirmed", "Declined"]);

/** Rows from an Asoebi / Groomsmen tab → responses, newest first. */
export const parseResponseRows = (values: string[][]): InterestResponse[] => {
	const [header, ...rows] = values;
	if (!header) return [];
	const col = headerColumns(header);
	const cell = (row: string[], label: string) => {
		const i = col(label);
		return i === -1 ? "" : (row[i] ?? "").trim();
	};

	return rows
		.map((row) => {
			const status = cell(row, "Status");
			return {
				submittedAt: cell(row, "Submitted At"),
				code: cell(row, "Code"),
				name: cell(row, "Name"),
				email: cell(row, "Email"),
				whatsapp: cell(row, "WhatsApp"),
				events: cell(row, "Events"),
				status: (STATUSES.has(status) ? status : "Pending") as ResponseStatus,
			};
		})
		.filter((r) => r.submittedAt && r.code)
		.reverse();
};
