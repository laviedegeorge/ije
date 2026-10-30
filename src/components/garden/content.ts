// Everything the garden invitation shows, ported from Wedoo's Garden Experience template. The
// wording and media for a given invitation live in src/data/ (see ffInvite.ts).

export type GardenPhoto = {
  /** The picture, or a video's poster frame. */
  src: string;
  /** Smaller copy for grids; falls back to src. */
  thumb?: string;
  /** A video that plays when the picture is opened. */
  video?: string;
  caption: string;
  /** Horizontal focus for cover-cropping, 0 = left edge, 1 = right edge. */
  focusX?: number;
};

export type GardenGathering = {
  day: string;
  time: string;
  /** Short line for the painted board in the garden. */
  boardWhen: string;
  name: string;
  /** Short name for the painted board in the garden. */
  boardName: string;
  details: string;
};

export type GardenContent = {
  names: [string, string];
  /** Who the invitation is from, and who it is addressed to. */
  from: string;
  guestName: string;
  /** Pressed into the wax seal. */
  sealInitials: string;
  /** The countdown runs to this moment (ISO 8601 with UTC offset). */
  eventDate: string;
  dateLabel: string;
  city: string;
  cardPlace: string;
  welcome: { eyebrow: string; note: string };
  story: { eyebrow: string; headline: string; paragraphs: string[]; portrait: GardenPhoto };
  gathering: { eyebrow: string; headline: string; items: GardenGathering[] };
  memories: { eyebrow: string; headline: string; intro: string };
  /** The three pictures hung on the hedge. */
  wall: GardenPhoto[];
  gallery: GardenPhoto[];
  ask: {
    eyebrow: string;
    /** Shown after the guest's name: "Nonye, will you be my chief bridesmaid?" */
    question: string;
    /** The role, lettered large on the card on the table. */
    role: string;
    paragraphs: string[];
    yesLabel: string;
    waitLabel: string;
    waitMessage: string;
    /** International format; the yes opens a WhatsApp chat with this number. */
    whatsApp: string;
    reply: string;
    doneTitle: string;
    doneMessage: string;
  };
};

export type ChapterId = "welcome" | "story" | "memories" | "days" | "ask";

export const CHAPTERS: { id: ChapterId; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "story", label: "Our story" },
  { id: "memories", label: "Memories" },
  { id: "days", label: "The days" },
  { id: "ask", label: "The question" },
];

/** Opens WhatsApp with the reply typed in, ready to edit and send. */
export const replyHref = ({ whatsApp, reply }: GardenContent["ask"]): string =>
  `https://wa.me/${whatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(reply)}`;
