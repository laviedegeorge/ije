/**
 * Adding asoebi / groomsmen invitees from the admin page, and their personal
 * links. Links match the ones the sheet writes (apps-script/Code.gs).
 */

/** The Guests tab's Category dropdown. Must match CATEGORIES in apps-script/Code.gs. */
export const GUEST_CATEGORIES = [
	"Friends of groom",
	"Friends of bride",
	"Family of groom",
	"Family of bride",
	"Work colleagues",
	"Others",
] as const;

export type InviteKind = "asoebi" | "groomsmen";

export const INVITE_PATHS: Record<InviteKind, string> = {
	asoebi: "/asoebi",
	groomsmen: "/join",
};

/** /asoebi?n=ada&c=K7Q2M9: the code grants access, the first name personalises. */
export const inviteLink = (origin: string, kind: InviteKind, name: string, code: string): string => {
	const first = encodeURIComponent(name.trim().split(/\s+/)[0].toLowerCase());
	return `${origin}${INVITE_PATHS[kind]}?n=${first}&c=${code}`;
};

export type NewInvitee = {
	name: string;
	category: string;
	plusOne: number;
	asoebi: boolean;
	groomsmen: boolean;
};

/** Checks an "Invite" form from the admin page. */
export const validateNewInvitee = (
	raw: Record<string, unknown>,
): { ok: true; value: NewInvitee } | { ok: false; message: string } => {
	const name = String(raw.name ?? "").replace(/\s+/g, " ").trim();
	const category = String(raw.category ?? "");
	const plusOne = Number(raw.plusOne ?? 0);
	const asoebi = raw.asoebi === true;
	const groomsmen = raw.groomsmen === true;

	if (name.length < 2 || name.length > 100) return { ok: false, message: "Enter their name." };
	if (!(GUEST_CATEGORIES as readonly string[]).includes(category)) return { ok: false, message: "Choose a category." };
	if (!Number.isInteger(plusOne) || plusOne < 0 || plusOne > 10) return { ok: false, message: "Plus ones must be 0 to 10." };
	if (!asoebi && !groomsmen) return { ok: false, message: "Tick Asoebi, Groomsmen or both." };
	return { ok: true, value: { name, category, plusOne, asoebi, groomsmen } };
};
