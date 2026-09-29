/**
 * The guest list (the workbook's "Guests" tab) and personal-link lookup for
 * /asoebi and /join. Links look like `/asoebi?n=ada&c=K7Q2M9`: the code grants
 * access, the first name is only there to make the link personal.
 */
import { event } from "@/config/event";
import { readSheetValues } from "@/util/googleSheetsApi";

export type InviteListKind = "join" | "asoebi";

export type Guest = {
	code: string;
	name: string;
	category: string;
	source: string;
	plusOne: number;
	asoebi: boolean;
	groomsmen: boolean;
};

export type Invitee = { code: string; name: string };

/** How long a fetched guest list is reused before asking the sheet again. */
const CACHE_TTL_MS = 60_000;

const TRUTHY = new Set(["true", "yes", "y", "x", "✓", "✔", "1"]);
const isYes = (cell: string | undefined): boolean => TRUTHY.has((cell ?? "").trim().toLowerCase());

/** Codes are case-insensitive in links; the sheet stores them upper-case. */
export const normalizeCode = (s: string | null | undefined): string =>
	(s ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();

/** Header text → column index, matched case-insensitively. */
export const headerColumns = (header: string[]): ((label: string) => number) => {
	const index = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
	return (label) => index.get(label.toLowerCase()) ?? -1;
};

/** Rows from the Guests tab → guests. The header row decides which column is which. */
export const parseGuestRows = (values: string[][]): Guest[] => {
	const [header, ...rows] = values;
	if (!header) return [];
	const col = headerColumns(header);
	const c = {
		code: col("Code"),
		name: col("Name"),
		category: col("Category"),
		source: col("Source"),
		plusOne: col("Plus One"),
		asoebi: col("Asoebi"),
		groomsmen: col("Groomsmen"),
	};
	if (c.name === -1) return [];
	const cell = (row: string[], i: number) => (i === -1 ? "" : (row[i] ?? "").trim());

	return rows
		.map((row) => ({
			code: normalizeCode(cell(row, c.code)),
			name: cell(row, c.name),
			category: cell(row, c.category),
			source: cell(row, c.source),
			plusOne: Number.parseInt(cell(row, c.plusOne), 10) || 0,
			asoebi: isYes(cell(row, c.asoebi)),
			groomsmen: isYes(cell(row, c.groomsmen)),
		}))
		.filter((g) => g.name);
};

let cache: { guests: Guest[]; fetchedAt: number } | null = null;

/** Test hook: forget the cached list. */
export const resetGuestCache = (): void => {
	cache = null;
};

/**
 * The guest list, cached for a minute. If the sheet can't be read, the last
 * good list is reused; null means no list has been read yet.
 */
export const loadGuests = async (opts?: { fresh?: boolean }): Promise<Guest[] | null> => {
	const now = Date.now();
	if (!opts?.fresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.guests;

	const result = await readSheetValues(event.sheets.guests);
	if (result.ok) {
		cache = { guests: parseGuestRows(result.values), fetchedAt: now };
		return cache.guests;
	}

	console.warn(
		cache
			? "[guests] sheet unavailable; using the last list read"
			: "[guests] sheet unavailable and no cached list; trusting link names",
	);
	return cache?.guests ?? null;
};

const titleCase = (s: string): string => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

const findGuest = (guests: Guest[], kind: InviteListKind, code: string): Guest | undefined =>
	guests.find((g) => g.code === code && (kind === "asoebi" ? g.asoebi : g.groomsmen));

/**
 * Strict check used by the password gate: true only when the code is on a guest
 * list actually read from the sheet (fresh or cached) and ticked for this page.
 * Unlike resolveInvitee, it never trusts a link during an outage.
 */
export const isValidInviteCode = async (
	kind: InviteListKind,
	rawCode: string | null | undefined,
): Promise<boolean> => {
	const code = normalizeCode(rawCode);
	if (!code) return false;
	const guests = await loadGuests();
	return guests !== null && findGuest(guests, kind, code) !== undefined;
};

/**
 * The guest a personal link belongs to, or null when the code isn't on the
 * list or isn't ticked for this page. If the sheet has never been readable
 * (e.g. an outage right after a deploy), the link is trusted and the first name
 * from it is shown; the site password still guards the page, and the form
 * can't save without the sheet anyway.
 */
export const resolveInvitee = async (
	kind: InviteListKind,
	rawCode: string | null | undefined,
	linkName?: string | null,
): Promise<Invitee | null> => {
	const code = normalizeCode(rawCode);
	if (!code) return null;

	const guests = await loadGuests();
	if (guests === null) {
		const name = titleCase((linkName ?? "").replace(/[-_]+/g, " ").trim());
		return { code, name: name || "there" };
	}

	const guest = findGuest(guests, kind, code);
	return guest ? { code: guest.code, name: guest.name } : null;
};
