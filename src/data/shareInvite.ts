/**
 * What gets sent with a personal link from the admin page: the message for
 * each kind of invite, the invitation card shared alongside it, and the link
 * preview those pages show (/rsvp, /asoebi, /join).
 */
import { coupleNames, event } from "@/config/event";

export type ShareKind = "rsvp" | "asoebi" | "groomsmen";

/** The link preview for personal invitation links. */
export const invitePreviewImage = {
	src: "/og-invite.jpg",
	alt: `You're invited to celebrate ${coupleNames}`,
};

/** The full invitation card, shared as a picture from phones. */
export const invitationCard = {
	src: "/assets/invitation.jpg",
	fileName: "invitation.jpg",
};

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

/** The message sent with a personal link. `name` is as typed (RSVP) or from the guest list. */
export const inviteMessage = (kind: ShareKind, name: string, link: string): string => {
	switch (kind) {
		case "groomsmen":
			return [
				"My guy! 👊🏾",
				"",
				"I dey marry o! 😂💍",
				"",
				`I wan make you come celebrate with me for my Marriage on ${event.dateLabel}.`,
				"",
				"Abeg, use your personal link below confirm whether you go fit make am or you no go fit.",
				"",
				"I know say to be part of the train fit involve some cost and commitment, so no pressure at all. If you no fit join the train, you fit still come celebrate with us for either or both occasions. ❤️",
				"",
				`👉🏾 ${link}`,
				"",
				"E go really mean a lot to me if you fit dey there as I start this new chapter.",
				"",
				"Make we turn up! 🥂🔥",
			].join("\n");
		case "asoebi":
			return `Hi ${firstName(name)}, ${coupleNames} would love to celebrate with you! 💛 Please register your asoebi interest here: ${link}`;
		case "rsvp":
			return name.trim()
				? `Hi ${name.trim()}, ${coupleNames} would love to celebrate with you! 💛 Please RSVP here: ${link}`
				: `${coupleNames} would love to celebrate with you! 💛 Please RSVP here: ${link}`;
	}
};

/** A WhatsApp link that opens a chat with the message filled in (the sender picks the contact). */
export const whatsAppHref = (message: string): string =>
	`https://wa.me/?text=${encodeURIComponent(message)}`;
