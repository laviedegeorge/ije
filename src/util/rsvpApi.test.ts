import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { event } from "@/config/event";
import { RSVP_FIELD, RSVP_HONEYPOT_FIELD } from "@/util/rsvpForm";
import { POST } from "@/pages/api/rsvp";

vi.mock("@/util/googleSheetsApi", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/util/googleSheetsApi")>()),
	appendRowsToSheet: vi.fn().mockResolvedValue({ ok: true }),
	readSheetValues: vi.fn(),
}));

import { appendRowsToSheet, readSheetValues } from "@/util/googleSheetsApi";
import { RSVP_HEADERS } from "@/util/rsvpSheet";

/** An RSVPs tab row with only the given columns filled. */
const rsvpRow = (cells: Record<string, string>) => RSVP_HEADERS.map((h) => cells[h] ?? "");

const validForm = (extra: Record<string, string> = {}): FormData => {
	const f = new FormData();
	f.set(RSVP_FIELD.fullName, "Ada Okonkwo");
	f.set(RSVP_FIELD.email, "ada@example.com");
	f.set(RSVP_FIELD.phone, "+2348031234567");
	f.set(RSVP_FIELD.countryResidence, "nigeria");
	f.set(RSVP_FIELD.eventTraditional, "yes");
	for (const [k, v] of Object.entries(extra)) f.set(k, v);
	return f;
};

const post = (form: FormData): Promise<Response> => {
	const request = new Request("https://site.test/api/rsvp", {
		method: "POST",
		body: form,
	});
	return POST({ request } as Parameters<typeof POST>[0]);
};

beforeEach(() => {
	vi.stubEnv("APPS_SCRIPT_URL", "https://script.google.com/macros/s/fake/exec");
	vi.stubEnv("APPS_SCRIPT_SECRET", "fake-secret");
	vi.mocked(appendRowsToSheet).mockClear().mockResolvedValue({ ok: true });
	vi.mocked(readSheetValues).mockResolvedValue({ ok: true, values: [[...RSVP_HEADERS]] });
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("POST /api/rsvp", () => {
	it("returns 503 when the Apps Script is not configured", async () => {
		vi.stubEnv("APPS_SCRIPT_URL", "");

		const res = await post(validForm());
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({ ok: false, kind: "not_configured" });
		expect(appendRowsToSheet).not.toHaveBeenCalled();
	});

	it("silently accepts and drops honeypot (spam) submissions", async () => {
		const res = await post(validForm({ [RSVP_HONEYPOT_FIELD]: "buy-cheap-stuff" }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(appendRowsToSheet).not.toHaveBeenCalled();
	});

	it("returns 400 with field errors for invalid input", async () => {
		const form = validForm({ [RSVP_FIELD.email]: "not-an-email" });
		const res = await post(form);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toMatchObject({ ok: false, kind: "validation" });
		expect(body.fieldErrors[RSVP_FIELD.email]).toBeDefined();
		expect(appendRowsToSheet).not.toHaveBeenCalled();
	});

	it("forwards a valid submission and returns ok", async () => {
		const res = await post(validForm());
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(appendRowsToSheet).toHaveBeenCalledTimes(1);
		expect(appendRowsToSheet).toHaveBeenCalledWith(
			event.sheets.rsvp,
			expect.any(Array),
			expect.objectContaining({ headers: expect.any(Array) }),
		);
	});

	it("refuses a second RSVP from the same phone number, however it's formatted", async () => {
		vi.mocked(readSheetValues).mockResolvedValue({
			ok: true,
			values: [
				[...RSVP_HEADERS],
				rsvpRow({ "Submitted At": "2026-10-01T10:00:00Z", "Full Name": "Ada", "Guest Role": "Primary", Phone: "+234 803 123 4567" }),
			],
		});
		const res = await post(validForm({ [RSVP_FIELD.phone]: "08031234567" }));
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ ok: false, kind: "duplicate" });
		expect(appendRowsToSheet).not.toHaveBeenCalled();
	});

	it("accepts a new phone number, and still saves when the RSVPs tab can't be read", async () => {
		vi.mocked(readSheetValues).mockResolvedValue({
			ok: true,
			values: [[...RSVP_HEADERS], rsvpRow({ "Full Name": "Someone", "Guest Role": "Primary", Phone: "+2348099999999" })],
		});
		expect((await post(validForm({ [RSVP_FIELD.phone]: "+2348031234567" }))).status).toBe(200);

		vi.mocked(readSheetValues).mockResolvedValue({ ok: false, reason: "upstream" });
		expect((await post(validForm({ [RSVP_FIELD.phone]: "+2348031234567" }))).status).toBe(200);
		expect(appendRowsToSheet).toHaveBeenCalledTimes(2);
	});

	it("returns 502 when the upstream sheet write fails", async () => {
		vi.mocked(appendRowsToSheet).mockResolvedValueOnce({ ok: false, reason: "upstream" });

		const res = await post(validForm());
		expect(res.status).toBe(502);
		expect(await res.json()).toMatchObject({ ok: false, kind: "upstream" });
	});
});
