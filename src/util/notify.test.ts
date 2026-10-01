import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { interestMessage, rsvpMessage, sendTelegram } from "@/util/notify";
import type { RsvpRecord } from "@/util/rsvpForm";

const record = (overrides: Partial<RsvpRecord> = {}): RsvpRecord => ({
	country_residence: "uk",
	other_country: null,
	full_name: "Ada Obi",
	email: "ada@example.com",
	phone: "+447700900123",
	party_size: 2,
	plus_one_name: "Jordan Lee",
	event_traditional: true,
	event_white: true,
	expected_arrival: "2026-12-20",
	expected_departure: null,
	guest_notes: null,
	relationship: "friend",
	message_couple: "Can't wait!",
	...overrides,
});

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
	vi.stubGlobal("fetch", fetchMock);
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("sendTelegram", () => {
	it("does nothing until both settings are set", async () => {
		vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
		vi.stubEnv("TELEGRAM_CHAT_ID", "");
		await sendTelegram("hi");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("posts the text to the configured chat", async () => {
		vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
		vi.stubEnv("TELEGRAM_CHAT_ID", "-10042");
		await sendTelegram("hi");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.telegram.org/bot123:abc/sendMessage",
			expect.objectContaining({ method: "POST" }),
		);
		expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toMatchObject({ chat_id: "-10042", text: "hi" });
	});

	it("never throws when Telegram fails", async () => {
		vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
		vi.stubEnv("TELEGRAM_CHAT_ID", "-10042");
		fetchMock.mockRejectedValueOnce(new Error("offline"));
		await expect(sendTelegram("hi")).resolves.toBeUndefined();
		fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
		await expect(sendTelegram("hi")).resolves.toBeUndefined();
	});
});

describe("messages", () => {
	it("summarises an RSVP", () => {
		expect(rsvpMessage(record())).toBe(
			[
				"🎉 New RSVP",
				"Ada Obi (+1 Jordan Lee)",
				"Events: Traditional + White Wedding",
				"From: United Kingdom (arrives 2026-12-20)",
				"Phone: +447700900123",
				"Email: ada@example.com",
				"Message: Can't wait!",
			].join("\n"),
		);
	});

	it("leaves out empty details and names other countries", () => {
		const text = rsvpMessage(
			record({
				country_residence: "other",
				other_country: "Ghana",
				plus_one_name: null,
				email: null,
				expected_arrival: null,
				event_traditional: false,
				message_couple: null,
			}),
		);
		expect(text).toContain("Ada Obi\n");
		expect(text).toContain("Events: White Wedding");
		expect(text).toContain("From: Ghana\n");
		expect(text).toContain("Phone: +447700900123");
		expect(text).not.toMatch(/Email|Message|\+1 /);
	});

	it("labels asoebi and groomsmen sign-ups", () => {
		const values = { full_name: "Chidi Okafor", email: "c@example.com", whatsapp: "+2348031234567", events: "both" } as const;
		expect(interestMessage("asoebi", values)).toMatch(/^👗 New asoebi interest\nChidi Okafor\nEvents: Both\n/);
		expect(interestMessage("join", values)).toMatch(/^🤵 New groomsmen interest/);
	});
});
