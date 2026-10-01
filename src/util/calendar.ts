/**
 * "Add to calendar" links: Google Calendar URLs and .ics files (Apple Calendar,
 * Outlook and most phones). Used by the schedule and the forms' thank-you views.
 */
import { coupleNames } from "@/config/event";

export type CalendarEvent = {
	title: string;
	/** UTC "20261223T120000Z", or a date "20261008" for an all-day event. */
	start: string;
	/** Exclusive end, in the same format as start. */
	end: string;
	location?: string;
	details?: string;
	/** Repeat weekly up to and including this date ("20261031"). */
	weeklyUntil?: string;
	/**
	 * When the .ics alert fires, relative to the start (an iCalendar duration,
	 * e.g. "-P7D" a week before, "PT9H" at 9am on an all-day event). Google
	 * Calendar links use the guest's own default notifications instead.
	 */
	alert?: string;
};

const isAllDay = (e: CalendarEvent): boolean => !e.start.includes("T");

/** One event per link: Google Calendar can't add several at once. */
export const googleCalendarHref = (e: CalendarEvent): string => {
	const query = new URLSearchParams({
		action: "TEMPLATE",
		text: e.title,
		dates: `${e.start}/${e.end}`,
		...(e.location ? { location: e.location } : {}),
		...(e.details ? { details: e.details } : {}),
		...(e.weeklyUntil ? { recur: `RRULE:FREQ=WEEKLY;UNTIL=${e.weeklyUntil}` } : {}),
	});
	return `https://calendar.google.com/calendar/render?${query.toString()}`;
};

const escapeIcsText = (value: string): string =>
	value
		.replace(/\\/g, "\\\\")
		.replace(/\n/g, "\\n")
		.replace(/,/g, "\\,")
		.replace(/;/g, "\\;");

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const icsEvent = (e: CalendarEvent, stamp: string): string[] => {
	const date = (value: string) => (isAllDay(e) ? `;VALUE=DATE:${value}` : `:${value}`);
	return [
		"BEGIN:VEVENT",
		`UID:${slug(`${e.title}-${e.start}`)}@${slug(coupleNames)}-wedding`,
		`DTSTAMP:${stamp}`,
		`DTSTART${date(e.start)}`,
		`DTEND${date(e.end)}`,
		...(e.weeklyUntil ? [`RRULE:FREQ=WEEKLY;UNTIL=${e.weeklyUntil}`] : []),
		`SUMMARY:${escapeIcsText(e.title)}`,
		...(e.location ? [`LOCATION:${escapeIcsText(e.location)}`] : []),
		...(e.details ? [`DESCRIPTION:${escapeIcsText(e.details)}`] : []),
		...(e.alert
			? [
					"BEGIN:VALARM",
					"ACTION:DISPLAY",
					`DESCRIPTION:${escapeIcsText(e.title)}`,
					`TRIGGER:${e.alert}`,
					"END:VALARM",
				]
			: []),
		"END:VEVENT",
	];
};

/** A .ics file holding one or more events, as a link the browser can open or download. */
export const icsHref = (events: CalendarEvent[]): string => {
	const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		`PRODID:-//${coupleNames} Wedding//EN`,
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		...events.flatMap((e) => icsEvent(e, stamp)),
		"END:VCALENDAR",
	];
	return `data:text/calendar;charset=utf-8,${encodeURIComponent(`${lines.join("\r\n")}\r\n`)}`;
};

/** "2026-10-31" → "20261031" */
export const icsDate = (iso: string): string => iso.replace(/-/g, "");

/** The date `days` after `iso` (both "YYYY-MM-DD"). */
export const addDays = (iso: string, days: number): string => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};

/**
 * An all-day reminder that repeats weekly from a week after `today` until
 * `deadline` (both "YYYY-MM-DD"), alerting at 9am. Starts on the deadline
 * itself when it's less than a week away; null once the deadline has passed.
 */
export const weeklyReminder = (
	title: string,
	details: string,
	today: string,
	deadline: string,
): CalendarEvent | null => {
	if (today > deadline) return null;
	const nextWeek = addDays(today, 7);
	const first = nextWeek > deadline ? deadline : nextWeek;
	return {
		title,
		details,
		start: icsDate(first),
		end: icsDate(addDays(first, 1)),
		weeklyUntil: icsDate(deadline),
		alert: "PT9H",
	};
};
