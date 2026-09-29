import { describe, expect, it } from "vitest";
import { event, isDisabledPath } from "@/config/event";
import { createGateToken, GATE_TTL_SECONDS, safeNextPath, verifyGateToken } from "@/util/siteGate";

describe("gate token", () => {
	const now = Date.UTC(2026, 0, 1);

	it("verifies a token made with the same password", () => {
		expect(verifyGateToken(createGateToken("secret", now), "secret", now)).toBe(true);
	});

	it("rejects a token after the password changes", () => {
		expect(verifyGateToken(createGateToken("secret", now), "new-secret", now)).toBe(false);
	});

	it("rejects an expired token", () => {
		const later = now + (GATE_TTL_SECONDS + 1) * 1000;
		expect(verifyGateToken(createGateToken("secret", now), "secret", later)).toBe(false);
	});

	it("rejects a token with a forged expiry", () => {
		const [, signature] = createGateToken("secret", now).split(".");
		const forged = `${Math.floor(now / 1000) + 10 * GATE_TTL_SECONDS}.${signature}`;
		expect(verifyGateToken(forged, "secret", now)).toBe(false);
	});

	it("rejects malformed tokens", () => {
		for (const token of ["", "abc", "1.2.3", "x.sig"]) {
			expect(verifyGateToken(token, "secret", now)).toBe(false);
		}
	});
});

describe("safeNextPath", () => {
	it("keeps same-site paths", () => {
		expect(safeNextPath("/rsvp?x=1")).toBe("/rsvp?x=1");
	});

	it("falls back to / for off-site or missing targets", () => {
		for (const value of [null, "", "https://evil.test", "//evil.test", "/\\evil.test"]) {
			expect(safeNextPath(value)).toBe("/");
		}
	});
});

describe("isDisabledPath", () => {
	it("allows enabled pages and unknown paths", () => {
		expect(isDisabledPath("/")).toBe(false);
		expect(isDisabledPath("/unlock")).toBe(false);
	});

	it("blocks a switched-off page and its API routes", () => {
		const original = event.pages.join;
		event.pages.join = false;
		try {
			expect(isDisabledPath("/join")).toBe(true);
			expect(isDisabledPath("/join/")).toBe(true);
			expect(isDisabledPath("/api/join")).toBe(true);
			expect(isDisabledPath("/joined")).toBe(false);
		} finally {
			event.pages.join = original;
		}
	});
});
