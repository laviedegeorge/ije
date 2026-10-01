import { describe, expect, it } from "vitest";
import { event } from "@/config/event";
import { inviteMessage, whatsAppHref } from "@/data/shareInvite";

const link = "https://site.test/join?n=kelechi&c=AB12CD";

describe("inviteMessage", () => {
	it("uses the groom's message for groomsmen, with the dates and link filled in", () => {
		const text = inviteMessage("groomsmen", "Kelechi Apugo", link);
		expect(text.startsWith("My guy! 👊🏾\n\nI dey marry o! 😂💍")).toBe(true);
		expect(text).toContain(`for my Marriage on ${event.dateLabel}.`);
		expect(text).toContain(`👉🏾 ${link}`);
		expect(text.endsWith("Make we turn up! 🥂🔥")).toBe(true);
		expect(text).not.toContain("{");
	});

	it("greets asoebi guests by first name", () => {
		expect(inviteMessage("asoebi", "Nonye Nwosu", link)).toBe(
			`Hi Nonye, Cynthia & Kelechi would love to celebrate with you! 💛 Please register your asoebi interest here: ${link}`,
		);
	});

	it("greets RSVP guests as typed, or not at all", () => {
		expect(inviteMessage("rsvp", "Mr. & Mrs. Anderson", link)).toMatch(/^Hi Mr\. & Mrs\. Anderson, .*Please RSVP here: https/);
		expect(inviteMessage("rsvp", "  ", link)).toMatch(/^Cynthia & Kelechi would love/);
	});
});

describe("whatsAppHref", () => {
	it("keeps line breaks, emoji and the link intact", () => {
		const text = inviteMessage("groomsmen", "Kelechi", link);
		expect(decodeURIComponent(new URL(whatsAppHref(text)).searchParams.get("text") ?? "")).toBe(text);
	});
});
