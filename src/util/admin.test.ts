import type { AstroCookies } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { event } from "@/config/event";
import { ADMIN_COOKIE, isAdmin, isAdminCodeCorrect } from "@/util/adminAuth";
import { createGateToken } from "@/util/siteGate";
import { POST as postStatus } from "@/pages/api/admin/status";
import { POST as postGuest } from "@/pages/api/admin/guest";

vi.mock("@/util/googleSheetsApi", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/util/googleSheetsApi")>()),
	setResponseStatus: vi.fn().mockResolvedValue({ ok: true }),
	addGuestToSheet: vi.fn().mockResolvedValue({ ok: true, code: "NEW123" }),
}));

import { addGuestToSheet, setResponseStatus } from "@/util/googleSheetsApi";

const cookiesWith = (value?: string) =>
	({ get: (name: string) => (name === ADMIN_COOKIE && value ? { value } : undefined) }) as unknown as AstroCookies;

const adminToken = () => createGateToken("admin-code", Date.now(), { purpose: "admin" });

const callStatus = (body: unknown, cookies: AstroCookies) =>
	postStatus({
		request: new Request("https://site.test/api/admin/status", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		cookies,
	} as Parameters<typeof postStatus>[0]) as Promise<Response>;

beforeEach(() => {
	vi.stubEnv("ADMIN_CODE", "admin-code");
	vi.mocked(setResponseStatus).mockClear();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("admin auth", () => {
	it("checks the admin code", () => {
		expect(isAdminCodeCorrect("admin-code")).toBe(true);
		expect(isAdminCodeCorrect(" admin-code ")).toBe(true);
		expect(isAdminCodeCorrect("wrong")).toBe(false);
	});

	it("is off when ADMIN_CODE is empty", () => {
		vi.stubEnv("ADMIN_CODE", "");
		expect(isAdminCodeCorrect("")).toBe(false);
		expect(isAdmin(cookiesWith(adminToken()))).toBe(false);
	});

	it("accepts an admin token but not a site-gate token made with the same code", () => {
		expect(isAdmin(cookiesWith(adminToken()))).toBe(true);
		expect(isAdmin(cookiesWith(createGateToken("admin-code")))).toBe(false);
		expect(isAdmin(cookiesWith())).toBe(false);
	});
});

describe("POST /api/admin/status", () => {
	const body = { list: "asoebi", submittedAt: "2026-10-01T00:00:00.000Z", code: "ADA111", status: "Confirmed" };

	it("requires the admin cookie", async () => {
		const res = await callStatus(body, cookiesWith());
		expect(res.status).toBe(401);
		expect(setResponseStatus).not.toHaveBeenCalled();
	});

	it("updates the response's status on the right tab", async () => {
		const res = await callStatus(body, cookiesWith(adminToken()));
		expect(res.status).toBe(200);
		expect(setResponseStatus).toHaveBeenCalledWith(
			event.sheets.asoebi,
			body.submittedAt,
			"ADA111",
			"Confirmed",
		);
	});

	it("rejects unknown lists and statuses", async () => {
		const token = adminToken();
		expect((await callStatus({ ...body, list: "rsvps" }, cookiesWith(token))).status).toBe(400);
		expect((await callStatus({ ...body, status: "Maybe" }, cookiesWith(token))).status).toBe(400);
		expect(setResponseStatus).not.toHaveBeenCalled();
	});

	it("reports sheet failures", async () => {
		vi.mocked(setResponseStatus).mockResolvedValueOnce({ ok: false, reason: "upstream" });
		const res = await callStatus(body, cookiesWith(adminToken()));
		expect(res.status).toBe(502);
	});
});

describe("POST /api/admin/guest", () => {
	const invite = { name: "Ada Obi", category: "Friends of bride", plusOne: 1, asoebi: true, groomsmen: true };
	const callGuest = (body: unknown, cookies: AstroCookies) =>
		postGuest({
			request: new Request("https://site.test/api/admin/guest", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			}),
			cookies,
		} as Parameters<typeof postGuest>[0]) as Promise<Response>;

	beforeEach(() => vi.mocked(addGuestToSheet).mockClear());

	it("requires the admin cookie", async () => {
		const res = await callGuest(invite, cookiesWith());
		expect(res.status).toBe(401);
		expect(addGuestToSheet).not.toHaveBeenCalled();
	});

	it("adds the guest and returns their code", async () => {
		const res = await callGuest(invite, cookiesWith(adminToken()));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, code: "NEW123", name: "Ada Obi" });
		expect(addGuestToSheet).toHaveBeenCalledWith(invite);
	});

	it("explains what's missing", async () => {
		const res = await callGuest({ ...invite, asoebi: false, groomsmen: false }, cookiesWith(adminToken()));
		expect(res.status).toBe(400);
		expect((await res.json()).message).toBe("Tick Asoebi, Groomsmen or both.");
		expect(addGuestToSheet).not.toHaveBeenCalled();
	});

	it("reports a sheet failure", async () => {
		vi.mocked(addGuestToSheet).mockResolvedValueOnce({ ok: false, reason: "upstream" });
		const res = await callGuest(invite, cookiesWith(adminToken()));
		expect(res.status).toBe(502);
	});
});
