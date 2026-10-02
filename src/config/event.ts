/**
 * Single source of truth for the couple and event this site is built for.
 * When repurposing the site for a new couple, start here — then work through
 * the content files in `src/data/` and the images in `public/assets/`.
 *
 * Keep this file free of imports: `astro.config.mjs` reads it too.
 */

export type PageKey =
  | "schedule"
  | "travel"
  | "faq"
  | "thingsToDo"
  | "asoebi"
  | "rsvp"
  | "join"
  | "registry";

type Person = {
  /** Shown in the hero, page titles and the footer brand. */
  firstName: string;
  fullName: string;
};

export const event = {
  partnerOne: {
    firstName: "Cynthia",
    fullName: "Cynthia Ibekwe",
  } satisfies Person,
  partnerTwo: {
    firstName: "Kelechi",
    fullName: "Kelechi Apugo",
  } satisfies Person,

  /** Production URL, used for canonical links and the sitemap. No trailing slash. */
  siteUrl: "https://ck-2026.vercel.app",

  /** Hero eyebrow on the home page. */
  dateLabel: "December 23 & 26, 2026",
  locationLabel: "Owerri, Imo State, Nigeria",

  /** The footer counts down to this moment (ISO 8601 with UTC offset). */
  countdownTarget: "2026-12-26T10:00:00+01:00",
  countdownLabel: "December 26, 2026",

  rsvpDeadline: {
    iso: "2026-11-30",
    label: "November 30, 2026",
  },

  /**
   * WhatsApp number guests message to change an RSVP or registration (the site
   * doesn't let them submit twice). International format.
   */
  contactWhatsApp: "+2348062242901",

  /** Last day to register on the Asoebi and Groomsmen pages (shown on both). */
  interestDeadline: {
    iso: "2026-10-31",
    label: "October 31, 2026",
  },

  /**
   * Cash gifts and transfers, the only gifts the couple accepts. Shown on
   * /registry. Leave accountName empty to hide that line.
   */
  gifts: {
    bankName: "Moniepoint Microfinance Bank",
    accountNumber: "8062242901",
    accountName: "",
  },

  /**
   * Pages that show a "Coming soon" notice instead of their content. They stay
   * in the nav. Remove an entry once it's ready.
   */
  comingSoon: ["travel"] as ("travel" | "registry")[],

  /**
   * Tab names in the Google Sheet. They must match TABS in apps-script/Code.gs,
   * whose "Set up tabs & protections" menu creates them.
   */
  sheets: {
    rsvp: "RSVPs",
    guests: "Guests",
    asoebi: "Asoebi",
    groomsmen: "Groomsmen",
  },

  /**
   * Site-wide password page (SITE_GATE_PASSWORD). When false the site is open;
   * /asoebi and /join still require a valid invite code and /admin its ADMIN_CODE.
   */
  passwordGate: false,

  /** Turn off pages this couple doesn't need. Disabled pages return 404 and leave the nav. */
  pages: {
    schedule: true,
    travel: true,
    faq: true,
    thingsToDo: false,
    asoebi: true,
    rsvp: true,
    join: true,
    registry: true,
  } satisfies Record<PageKey, boolean>,
};

export const pagePaths: Record<PageKey, string> = {
  schedule: "/schedule",
  travel: "/travel",
  faq: "/faq",
  thingsToDo: "/things-to-do",
  asoebi: "/asoebi",
  rsvp: "/rsvp",
  join: "/join",
  registry: "/registry",
};

/** API routes that only exist to serve a page; they are switched off with it. */
const pageApiPaths: Partial<Record<PageKey, string[]>> = {
  rsvp: ["/api/rsvp"],
  join: ["/api/join"],
  asoebi: ["/api/asoebi"],
};

/** "Cynthia & Kelechi" */
export const coupleNames = `${event.partnerOne.firstName} & ${event.partnerTwo.firstName}`;

/** "Cynthia Ibekwe and Kelechi Apugo" */
export const coupleFullNames = `${event.partnerOne.fullName} and ${event.partnerTwo.fullName}`;

/** Opens a WhatsApp chat with the couple's contact number. */
export const contactWhatsAppHref = `https://wa.me/${event.contactWhatsApp.replace(/\D/g, "")}`;

/** "C & K" */
export const coupleInitials = `${event.partnerOne.firstName[0]} & ${event.partnerTwo.firstName[0]}`;

export const isPageEnabled = (page: PageKey): boolean => event.pages[page];

/** True when `pathname` belongs to a page that is switched off in `event.pages`. */
export const isDisabledPath = (pathname: string): boolean => {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(pagePaths) as PageKey[]).some(
    (page) =>
      !isPageEnabled(page) &&
      [pagePaths[page], ...(pageApiPaths[page] ?? [])].some(
        (base) => path === base || path.startsWith(`${base}/`),
      ),
  );
};
