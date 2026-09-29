import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { event } from "@/config/event";
import {
	isValidInviteCode,
	normalizeCode,
	parseGuestRows,
	resetGuestCache,
	resolveInvitee,
} from "@/util/inviteList";
import {
	INTEREST_FIELD,
	INTEREST_HONEYPOT_FIELD,
	parseInterestFormData,
	validateInterestForm,
} from "@/util/interestForm";
import { interestToSheetRow, parseResponseRows, RESPONSE_HEADERS } from "@/util/interestSheet";
import { POST as postAsoebi } from "@/pages/api/asoebi";
import { POST as postJoin } from "@/pages/api/join";

vi.mock("@/util/googleSheetsApi", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/util/googleSheetsApi")>()),
	appendRowsToSheet: vi.fn().mockResolvedValue({ ok: true }),
	readSheetValues: vi.fn(),
}));

import { appendRowsToSheet, readSheetValues } from "@/util/googleSheetsApi";

const GUESTS: string[][] = [
	["Code", "Name", "Category", "Source", "Plus One", "Asoebi", "Groomsmen", "Asoebi Link", "Groomsmen Link"],
	["ADA111", "Ada Obi", "Friends of bride", "", "0", "TRUE", "TRUE", "", ""],
	["CHI222", "Chidi Okafor", "Family of groom", "", "", "TRUE", "FALSE", "", ""],
	["NGO333", "Ngozi Eze", "Work colleagues", "Groomsmen", "1", "FALSE", "TRUE", "", ""],
];

const form = (overrides: Record<string, string> = {}): FormData => {
	const f = new FormData();
	const values: Record<string, string> = {
		c: "ADA111",
		[INTEREST_FIELD.fullName]: "Ada Obi",
		[INTEREST_FIELD.email]: "ada@example.com",
		[INTEREST_FIELD.whatsapp]: "0803 123 4567",
		[INTEREST_FIELD.events]: "both",
		...overrides,
	};
	for (const [k, v] of Object.entries(values)) f.set(k, v);
	return f;
};

const call = (handler: typeof postJoin, body: FormData) =>
	handler({
		request: new Request("https://site.test/api", { method: "POST", body }),
	} as Parameters<typeof postJoin>[0]) as Promise<Response>;

beforeEach(() => {
	resetGuestCache();
	vi.mocked(readSheetValues).mockReset().mockResolvedValue({ ok: true, values: GUESTS });
	vi.mocked(appendRowsToSheet).mockClear();
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("parseGuestRows", () => {
	it("reads guests by header, in any column order", () => {
		const rows = parseGuestRows([
			["groomsmen", "Name", "PLUS ONE", "code", "Asoebi", "Category"],
			["✓", "Ada Obi", "2", "k7q2m9", "", "Friends of bride"],
			["", "  ", "", "", "", ""],
		]);
		expect(rows).toEqual([
			{
				code: "K7Q2M9",
				name: "Ada Obi",
				category: "Friends of bride",
				source: "",
				plusOne: 2,
				asoebi: false,
				groomsmen: true,
			},
		]);
	});

	it("returns nothing without a Name column", () => {
		expect(parseGuestRows([["Guest", "Asoebi"], ["Ada", "TRUE"]])).toEqual([]);
	});
});

describe("resolveInvitee", () => {
	it("finds guests by code, case-insensitively", async () => {
		expect(normalizeCode(" ada-111 ")).toBe("ADA111");
		expect(await resolveInvitee("asoebi", "chi222")).toEqual({ code: "CHI222", name: "Chidi Okafor" });
	});

	it("only admits guests ticked for that page", async () => {
		expect(await resolveInvitee("join", "CHI222")).toBeNull();
		expect(await resolveInvitee("asoebi", "NGO333")).toBeNull();
		expect(await resolveInvitee("join", "NGO333")).toEqual({ code: "NGO333", name: "Ngozi Eze" });
	});

	it("ignores the name in the link and returns null for unknown codes", async () => {
		expect(await resolveInvitee("asoebi", "ADA111", "someone-else")).toEqual({ code: "ADA111", name: "Ada Obi" });
		expect(await resolveInvitee("asoebi", "NOPE00", "ada")).toBeNull();
		expect(await resolveInvitee("asoebi", "", "ada")).toBeNull();
	});

	it("reads the sheet at most once a minute", async () => {
		await resolveInvitee("asoebi", "ADA111");
		await resolveInvitee("join", "ADA111");
		expect(readSheetValues).toHaveBeenCalledTimes(1);
		expect(readSheetValues).toHaveBeenCalledWith(event.sheets.guests);
	});

	it("keeps using the last list when the sheet becomes unreachable", async () => {
		const now = vi.spyOn(Date, "now");
		now.mockReturnValue(0);
		await resolveInvitee("asoebi", "ADA111");
		vi.mocked(readSheetValues).mockResolvedValue({ ok: false, reason: "upstream" });
		now.mockReturnValue(120_000);
		expect(await resolveInvitee("asoebi", "ADA111")).toEqual({ code: "ADA111", name: "Ada Obi" });
		expect(await resolveInvitee("asoebi", "NOPE00")).toBeNull();
		now.mockRestore();
	});

	it("trusts the link when the sheet has never been readable", async () => {
		vi.mocked(readSheetValues).mockResolvedValue({ ok: false, reason: "upstream" });
		expect(await resolveInvitee("asoebi", "ada111", "ada")).toEqual({ code: "ADA111", name: "Ada" });
	});
});

describe("isValidInviteCode (password gate bypass)", () => {
	it("accepts a code ticked for the page, case-insensitively", async () => {
		expect(await isValidInviteCode("asoebi", "ada111")).toBe(true);
		expect(await isValidInviteCode("join", "NGO333")).toBe(true);
	});

	it("rejects codes for the other page, unknown codes and missing codes", async () => {
		expect(await isValidInviteCode("join", "CHI222")).toBe(false);
		expect(await isValidInviteCode("asoebi", "NOPE00")).toBe(false);
		expect(await isValidInviteCode("asoebi", null)).toBe(false);
	});

	it("never trusts a code when the sheet has never been readable", async () => {
		vi.mocked(readSheetValues).mockResolvedValue({ ok: false, reason: "upstream" });
		expect(await isValidInviteCode("asoebi", "ADA111")).toBe(false);
	});

	it("uses the cached list during an outage", async () => {
		const now = vi.spyOn(Date, "now");
		now.mockReturnValue(0);
		await isValidInviteCode("asoebi", "ADA111");
		vi.mocked(readSheetValues).mockResolvedValue({ ok: false, reason: "upstream" });
		now.mockReturnValue(120_000);
		expect(await isValidInviteCode("asoebi", "ADA111")).toBe(true);
		now.mockRestore();
	});
});

describe("validateInterestForm", () => {
	it("accepts a complete submission with a local WhatsApp number", () => {
		expect(validateInterestForm(parseInterestFormData(form())).ok).toBe(true);
	});

	it("accepts an international WhatsApp number", () => {
		const result = validateInterestForm(
			parseInterestFormData(form({ [INTEREST_FIELD.whatsapp]: "+44 7700 900123" })),
		);
		expect(result.ok).toBe(true);
	});

	it("reports every missing or invalid field", () => {
		const result = validateInterestForm(
			parseInterestFormData(
				form({
					[INTEREST_FIELD.fullName]: "",
					[INTEREST_FIELD.email]: "not-an-email",
					[INTEREST_FIELD.whatsapp]: "call me",
					[INTEREST_FIELD.events]: "reception",
				}),
			),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(Object.keys(result.fieldErrors).sort()).toEqual(
			[INTEREST_FIELD.email, INTEREST_FIELD.events, INTEREST_FIELD.fullName, INTEREST_FIELD.whatsapp].sort(),
		);
	});
});

describe("response rows", () => {
	it("writes the code, keeps phone numbers, neutralizes formulas and starts as Pending", () => {
		const row = interestToSheetRow(
			"ADA111",
			{ full_name: "=IMPORTXML(1)", email: "a@b.co", whatsapp: "+2348031234567", events: "white" },
			{ submittedAt: "2026-10-01T00:00:00.000Z" },
		);
		expect(row).toEqual([
			"2026-10-01T00:00:00.000Z",
			"ADA111",
			"'=IMPORTXML(1)",
			"a@b.co",
			"+2348031234567",
			"White Wedding",
			"Pending",
		]);
	});

	it("parses a response tab newest first, skipping blank rows", () => {
		const rows = parseResponseRows([
			[...RESPONSE_HEADERS],
			["2026-10-01T00:00:00.000Z", "ADA111", "Ada Obi", "a@b.co", "0803", "Both", "Confirmed"],
			["", "", "", "", "", "", ""],
			["2026-10-02T00:00:00.000Z", "CHI222", "Chidi Okafor", "c@d.co", "0805", "Traditional Marriage", ""],
		]);
		expect(rows.map((r) => [r.code, r.status])).toEqual([
			["CHI222", "Pending"],
			["ADA111", "Confirmed"],
		]);
	});
});

describe("interest API", () => {
	beforeEach(() => {
		vi.stubEnv("APPS_SCRIPT_URL", "https://script.google.com/macros/s/fake/exec");
		vi.stubEnv("APPS_SCRIPT_SECRET", "fake-secret");
	});

	it("returns 503 when the Apps Script is not configured", async () => {
		vi.stubEnv("APPS_SCRIPT_SECRET", "");
		const res = await call(postJoin, form());
		expect(res.status).toBe(503);
	});

	it("saves a join submission to the Groomsmen tab with the guest's code", async () => {
		const res = await call(postJoin, form({ c: "ada111" }));
		expect(res.status).toBe(200);
		expect(appendRowsToSheet).toHaveBeenCalledWith(
			event.sheets.groomsmen,
			[expect.arrayContaining(["ADA111", "Ada Obi", "ada@example.com", "+2348031234567", "Both", "Pending"])],
			{ headers: [...RESPONSE_HEADERS] },
		);
	});

	it("saves an asoebi submission to the Asoebi tab", async () => {
		const res = await call(postAsoebi, form({ c: "CHI222", [INTEREST_FIELD.fullName]: "Chidi Okafor" }));
		expect(res.status).toBe(200);
		expect(appendRowsToSheet).toHaveBeenCalledWith(event.sheets.asoebi, expect.any(Array), expect.any(Object));
	});

	it("rejects codes that aren't ticked for the page", async () => {
		// Chidi is ticked for Asoebi but not Groomsmen.
		const res = await call(postJoin, form({ c: "CHI222" }));
		expect(res.status).toBe(403);
		expect(appendRowsToSheet).not.toHaveBeenCalled();
	});

	it("rejects a WhatsApp number that isn't a real number", async () => {
		const res = await call(postJoin, form({ [INTEREST_FIELD.whatsapp]: "0803" }));
		expect(res.status).toBe(400);
		expect((await res.json()).fieldErrors).toHaveProperty(INTEREST_FIELD.whatsapp);
		expect(appendRowsToSheet).not.toHaveBeenCalled();
	});

	it("returns field errors for invalid input", async () => {
		const res = await call(postJoin, form({ [INTEREST_FIELD.email]: "" }));
		expect(res.status).toBe(400);
		expect((await res.json()).fieldErrors).toHaveProperty(INTEREST_FIELD.email);
	});

	it("drops honeypot submissions without saving", async () => {
		const res = await call(postJoin, form({ [INTEREST_HONEYPOT_FIELD]: "Acme" }));
		expect(res.status).toBe(200);
		expect(appendRowsToSheet).not.toHaveBeenCalled();
	});
});
