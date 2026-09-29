import { coupleNames } from "@/config/event";

export type ScheduleEventIcon = "marriage" | "church" | "reception" | "party";

export type ColorOfTheDay = {
  name: string;
  /** Swatch colour shown next to the name. */
  hex: string;
};

export type ScheduleEvent = {
  icon?: ScheduleEventIcon;
  title: string;
  timeLabel?: string;
  venue: string;
  location: string;
  notes?: string;
  colorsOfTheDay?: ColorOfTheDay[];
  mapHref?: string;
  googleCalendarHref?: string;
  appleCalendarHref?: string;
};

export type ScheduleDay = {
  id: string;
  dayLabel: string;
  events: ScheduleEvent[];
};

export type SchedulePageData = {
  eyebrow: string;
  title: string;
  days: ScheduleDay[];
};

const googleCalendarBase =
  "https://calendar.google.com/calendar/render?action=TEMPLATE";

const makeGoogleCalendarHref = (
  title: string,
  startUtc: string,
  endUtc: string,
  location?: string | undefined,
  details?: string,
): string => {
  const query = new URLSearchParams({
    text: title,
    dates: `${startUtc}/${endUtc}`,
    ...(location ? { location } : {}),
    ...(details ? { details } : {}),
  });
  return `${googleCalendarBase}&${query.toString()}`;
};

const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const makeAppleCalendarHref = (
  title: string,
  startUtc: string,
  endUtc: string,
  location?: string | undefined,
  details?: string,
): string => {
  const uidBase = `${title}-${startUtc}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const uid = `${uidBase}@${coupleNames.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-wedding`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${coupleNames} Wedding//Schedule//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${startUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${escapeIcsText(title)}`,
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
    ...(details ? [`DESCRIPTION:${escapeIcsText(details)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const ics = `${lines.join("\r\n")}\r\n`;
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
};

/** Google Maps search link for an address (use a maps.app.goo.gl pin instead when you have one). */
const makeMapSearchHref = (query: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/** Colours sampled from the invitation cards. */
const palette = {
  brown: { name: "Brown", hex: "#502c16" },
  green: { name: "Green", hex: "#88976e" },
  burntOrange: { name: "Burnt Orange", hex: "#9f4b27" },
  champagneGold: { name: "Champagne Gold", hex: "#deba7e" },
  tan: { name: "Tan", hex: "#d4bea7" },
  black: { name: "Black", hex: "#000000" },
  burgundy: { name: "Burgundy", hex: "#6d1f2f" },
} satisfies Record<string, ColorOfTheDay>;

const traditionalColors = [
  palette.brown,
  palette.green,
  palette.burntOrange,
  palette.champagneGold,
  palette.tan,
];
const churchColors = [
  palette.brown,
  palette.tan,
  palette.green,
  palette.black,
  palette.champagneGold,
  palette.burgundy,
];

const colorsLabel = (colors: ColorOfTheDay[]): string =>
  `Colours of the day: ${colors.map((c) => c.name).join(", ")}`;

const traditionalVenue =
  "Late Mr. Kenneth Chukwuma Ibekwe's Compound, Umunebo Obokwu, Obinze, Owerri West LGA, Imo State, Nigeria";
const churchVenue = "St. James Anglican Church, Uzii, Owerri, Imo State, Nigeria";

export const schedulePageData: SchedulePageData = {
  eyebrow: "Schedule",
  title: "Wedding Celebrations",
  days: [
    {
      id: "traditional-marriage",
      dayLabel: "Wednesday, December 23, 2026",
      events: [
        {
          icon: "marriage",
          title: "Traditional Marriage (Ịgba Nkwụ)",
          timeLabel: "1:00 pm",
          venue: "Late Mr. Kenneth Chukwuma Ibekwe's Compound",
          location: "Umunebo Obokwu, Obinze, Owerri West LGA, Imo State, Nigeria",
          colorsOfTheDay: traditionalColors,
          notes: "For directions, call Mr. Bright (08038723638) or Christopher (07060969839).",
          mapHref: makeMapSearchHref("Umunebo Obokwu, Obinze, Owerri West, Imo State, Nigeria"),
          googleCalendarHref: makeGoogleCalendarHref(
            `${coupleNames}'s Traditional Marriage (Ịgba Nkwụ)`,
            "20261223T120000Z",
            "20261223T170000Z",
            traditionalVenue,
            colorsLabel(traditionalColors),
          ),
          appleCalendarHref: makeAppleCalendarHref(
            `${coupleNames}'s Traditional Marriage (Ịgba Nkwụ)`,
            "20261223T120000Z",
            "20261223T170000Z",
            traditionalVenue,
            colorsLabel(traditionalColors),
          ),
        },
      ],
    },
    {
      id: "church-wedding",
      dayLabel: "Saturday, December 26, 2026",
      events: [
        {
          icon: "church",
          title: "Church Wedding",
          timeLabel: "10:00 am",
          venue: "St. James Anglican Church",
          location: "Uzii, Owerri, Imo State, Nigeria",
          colorsOfTheDay: churchColors,
          notes: "The reception follows immediately after the church service.",
          mapHref: "https://maps.app.goo.gl/7tFyDPf72jgfJ5hM8",
          googleCalendarHref: makeGoogleCalendarHref(
            `${coupleNames}'s Church Wedding & Reception`,
            "20261226T090000Z",
            "20261226T150000Z",
            churchVenue,
            `Reception follows immediately after the church service. ${colorsLabel(churchColors)}`,
          ),
          appleCalendarHref: makeAppleCalendarHref(
            `${coupleNames}'s Church Wedding & Reception`,
            "20261226T090000Z",
            "20261226T150000Z",
            churchVenue,
            `Reception follows immediately after the church service. ${colorsLabel(churchColors)}`,
          ),
        },
      ],
    },
  ],
};
