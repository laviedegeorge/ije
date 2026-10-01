import { describe, expect, it } from "vitest";
import { addDays, googleCalendarHref, icsHref, weeklyReminder } from "@/util/calendar";

const ics = (href: string) => decodeURIComponent(href.replace(/^data:text\/calendar;charset=utf-8,/, ""));

const party = { title: "Party", start: "20261223T120000Z", end: "20261223T170000Z", location: "Owerri, Imo" };

describe("calendar links", () => {
	it("builds a Google Calendar link for one event", () => {
		const url = new URL(googleCalendarHref(party));
		expect(url.searchParams.get("dates")).toBe("20261223T120000Z/20261223T170000Z");
		expect(url.searchParams.get("location")).toBe("Owerri, Imo");
		expect(url.searchParams.has("recur")).toBe(false);
	});

	it("puts several events and a week-before alert in one .ics file", () => {
		const file = ics(icsHref([{ ...party, alert: "-P7D" }, { ...party, title: "Church", start: "20261226T090000Z" }]));
		expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(2);
		expect(file).toContain("TRIGGER:-P7D");
		expect(file).toContain("LOCATION:Owerri\\, Imo");
		expect(file.match(/BEGIN:VALARM/g)).toHaveLength(1);
	});
});

describe("weeklyReminder", () => {
	it("repeats weekly from next week until the deadline, as all-day events", () => {
		const r = weeklyReminder("Asoebi reminder", "Pay by Oct 31", "2026-10-01", "2026-10-31");
		expect(r).toMatchObject({ start: "20261008", end: "20261009", weeklyUntil: "20261031", alert: "PT9H" });
		const file = ics(icsHref([r!]));
		expect(file).toContain("DTSTART;VALUE=DATE:20261008");
		expect(file).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261031");
		expect(new URL(googleCalendarHref(r!)).searchParams.get("recur")).toBe("RRULE:FREQ=WEEKLY;UNTIL=20261031");
	});

	it("lands on the deadline when it's under a week away, and stops after it", () => {
		expect(weeklyReminder("R", "", "2026-10-28", "2026-10-31")?.start).toBe("20261031");
		expect(weeklyReminder("R", "", "2026-11-01", "2026-10-31")).toBeNull();
	});

	it("adds days across month ends", () => {
		expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
	});
});
