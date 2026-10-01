import { describe, expect, it } from "vitest";
import { rsvpLink } from "@/util/rsvpLink";

const site = "https://site.test";
const nameFrom = (link: string) => new URL(link).searchParams.get("n");

describe("rsvpLink", () => {
	it("round-trips the name exactly as written", () => {
		for (const name of ["Mr. Anderson", "Anderson's Family", "Mr. & Mrs. Anderson", "Mary-Jane Okafor", "Ọ̀gbẹ́ni Ade"]) {
			expect(nameFrom(rsvpLink(site, name))).toBe(name);
		}
	});

	it("keeps links readable and safe to paste into chat apps", () => {
		expect(rsvpLink(site, "Mr. & Mrs. Anderson")).toBe("https://site.test/rsvp?n=Mr.+%26+Mrs.+Anderson");
		expect(rsvpLink(site, "Anderson's Family")).toBe("https://site.test/rsvp?n=Anderson%27s+Family");
	});

	it("tidies spacing and falls back to the plain RSVP link", () => {
		expect(nameFrom(rsvpLink(site, "  Ada   Obi "))).toBe("Ada Obi");
		expect(rsvpLink(site, "   ")).toBe("https://site.test/rsvp");
	});
});
