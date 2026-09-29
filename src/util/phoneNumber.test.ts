import { describe, expect, it } from "vitest";
import { normalizePhoneField, toE164 } from "@/util/phoneNumber";

describe("toE164", () => {
	it("reads local Nigerian numbers", () => {
		expect(toE164("0803 123 4567")).toBe("+2348031234567");
		expect(toE164("08031234567")).toBe("+2348031234567");
	});

	it("keeps international numbers, dropping formatting", () => {
		expect(toE164("+234 803 123 4567")).toBe("+2348031234567");
		expect(toE164("+44 7911 123456")).toBe("+447911123456");
		expect(toE164("+1 (214) 577-1936")).toBe("+12145771936");
	});

	it("rejects things that aren't phone numbers", () => {
		expect(toE164("call me")).toBeNull();
		expect(toE164("123")).toBeNull();
		expect(toE164("")).toBeNull();
	});
});

describe("normalizePhoneField", () => {
	it("rewrites a valid number in place", () => {
		const fd = new FormData();
		fd.set("phone", "0803 123 4567");
		expect(normalizePhoneField(fd, "phone", "bad")).toBeNull();
		expect(fd.get("phone")).toBe("+2348031234567");
	});

	it("returns the message for an invalid number and leaves empty fields alone", () => {
		const bad = new FormData();
		bad.set("phone", "12");
		expect(normalizePhoneField(bad, "phone", "bad")).toBe("bad");
		expect(normalizePhoneField(new FormData(), "phone", "bad")).toBeNull();
	});
});
