import { describe, expect, it } from "vitest";
import { inviteLink, validateNewInvitee } from "@/util/inviteLinks";

describe("inviteLink", () => {
	it("matches the links the sheet writes", () => {
		expect(inviteLink("https://site.test", "asoebi", "Ada Obi", "K7Q2M9")).toBe("https://site.test/asoebi?n=ada&c=K7Q2M9");
		expect(inviteLink("http://localhost:4321", "groomsmen", "  Chidi ", "AB12CD")).toBe("http://localhost:4321/join?n=chidi&c=AB12CD");
	});
});

describe("validateNewInvitee", () => {
	const base = { name: "Ada  Obi ", category: "Friends of bride", plusOne: 1, asoebi: true, groomsmen: false };

	it("accepts a complete invite and tidies the name", () => {
		expect(validateNewInvitee(base)).toEqual({ ok: true, value: { ...base, name: "Ada Obi" } });
	});

	it("rejects missing names, unknown categories, bad plus ones and no list", () => {
		expect(validateNewInvitee({ ...base, name: " " }).ok).toBe(false);
		expect(validateNewInvitee({ ...base, category: "Neighbours" }).ok).toBe(false);
		expect(validateNewInvitee({ ...base, plusOne: 11 }).ok).toBe(false);
		expect(validateNewInvitee({ ...base, plusOne: 1.5 }).ok).toBe(false);
		expect(validateNewInvitee({ ...base, asoebi: false })).toEqual({ ok: false, message: "Tick Asoebi, Groomsmen or both." });
	});
});
