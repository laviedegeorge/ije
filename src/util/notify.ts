/**
 * Telegram alerts for new RSVPs and asoebi / groomsmen sign-ups. Optional:
 * without TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID nothing is sent. A failed
 * alert is only logged; the guest's submission has already been saved.
 */
import { INTEREST_EVENT_LABELS, type InterestValues } from "@/util/interestForm";
import type { InviteListKind } from "@/util/inviteList";
import type { RsvpRecord } from "@/util/rsvpForm";

const TIMEOUT_MS = 5_000;

// Same lookup as googleSheetsApi.ts: .env at build time, runtime variables on Vercel.
const botToken = (): string =>
	(import.meta.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (): string =>
	(import.meta.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim();

/** Sends a plain-text message to the couple's chat. Never throws. */
export const sendTelegram = async (text: string): Promise<void> => {
	const token = botToken();
	const chat = chatId();
	if (!token || !chat) return;

	try {
		const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) {
			console.warn(`[telegram] sendMessage failed: HTTP ${response.status}`);
		}
	} catch (err) {
		console.warn("[telegram] sendMessage request failed:", err);
	}
};

const lines = (...parts: (string | false | null | undefined)[]): string =>
	parts.filter(Boolean).join("\n");

const COUNTRY_LABELS: Record<RsvpRecord["country_residence"], string> = {
	nigeria: "Nigeria",
	uk: "United Kingdom",
	usa: "United States",
	other: "Other",
};

export const rsvpMessage = (r: RsvpRecord): string => {
	const events = [r.event_traditional && "Traditional", r.event_white && "White Wedding"]
		.filter(Boolean)
		.join(" + ");
	const from =
		r.country_residence === "other" && r.other_country
			? r.other_country
			: COUNTRY_LABELS[r.country_residence];
	const travel = [r.expected_arrival && `arrives ${r.expected_arrival}`, r.expected_departure && `leaves ${r.expected_departure}`]
		.filter(Boolean)
		.join(", ");

	return lines(
		"🎉 New RSVP",
		`${r.full_name}${r.plus_one_name ? ` (+1 ${r.plus_one_name})` : ""}`,
		`Events: ${events}`,
		`From: ${from}${travel ? ` (${travel})` : ""}`,
		`Phone: ${r.phone}`,
		r.email && `Email: ${r.email}`,
		r.guest_notes && `Notes: ${r.guest_notes}`,
		r.message_couple && `Message: ${r.message_couple}`,
	);
};

const INTEREST_TITLES: Record<InviteListKind, string> = {
	asoebi: "👗 New asoebi interest",
	join: "🤵 New groomsmen interest",
};

export const interestMessage = (list: InviteListKind, v: InterestValues): string =>
	lines(
		INTEREST_TITLES[list],
		v.full_name,
		`Events: ${INTEREST_EVENT_LABELS[v.events]}`,
		`WhatsApp: ${v.whatsapp}`,
		v.email && `Email: ${v.email}`,
	);
