import { event, isPageEnabled } from "@/config/event";
import { schedulePageData } from "@/data/schedule";

export type FaqAnswerPart =
	| { type: "text"; value: string }
	| { type: "link"; label: string; href: string; external?: boolean };

export type FaqItem = {
	question: string;
	answer: FaqAnswerPart[];
};

// Dates, times and colours come from the schedule so the two pages always agree.
const [tradDay, churchDay] = schedulePageData.days;
const tradEvent = tradDay.events[0];
const churchEvent = churchDay.events[0];
const colourNames = (e: typeof tradEvent) => (e.colorsOfTheDay ?? []).map((c) => c.name).join(", ");

export const weddingFaq: FaqItem[] = [
  {
    question: "When and where are the celebrations?",
    answer: [
      {
        type: "text",
        value: `The Traditional Marriage (Ịgba Nkwụ) is on ${tradDay.dayLabel} at ${tradEvent.timeLabel}, at ${tradEvent.venue}, ${tradEvent.location}. The Church Wedding is on ${churchDay.dayLabel} at ${churchEvent.timeLabel}, at ${churchEvent.venue}, ${churchEvent.location}, and the reception follows immediately after the service. See the `,
      },
      { type: "link", label: "Schedule", href: "/schedule" },
      { type: "text", value: " for directions and to add each event to your calendar." },
    ],
  },
  {
    question: "Can I attend both ceremonies?",
    answer: [
      {
        type: "text",
        value:
          "Absolutely. They're on separate days, and we'd love to celebrate with you at both. When you RSVP, just tick each one you plan to attend.",
      },
    ],
  },
  {
    question: "What's the dress code?",
    answer: [
      {
        type: "text",
        value:
          "For the Traditional Marriage, come in Nigerian traditional attire (Ankara, Lace, George and more). For the Church Wedding, formal or semi-formal, church-appropriate attire is perfect. Bring your best dance shoes for the reception.",
      },
    ],
  },
  {
    question: "What are the colours of the day?",
    answer: [
      {
        type: "text",
        value: `Traditional Marriage: ${colourNames(tradEvent)}. Church Wedding: ${colourNames(churchEvent)}. You'll find the colour swatches on the `,
      },
      { type: "link", label: "Schedule", href: "/schedule" },
      { type: "text", value: "." },
    ],
  },
  {
    question: "What is Aso Ebi? Do I need to buy it?",
    answer: [
      {
        type: "text",
        value: `Aso Ebi is a matching fabric worn by family and close friends as a sign of unity and support. It's optional. If you'd like to join, use the personal asoebi link we sent you and register your interest by ${event.interestDeadline.label}.`,
      },
    ],
  },
  {
    question: "When should I RSVP by?",
    answer: [
      { type: "text", value: `Please RSVP by ${event.rsvpDeadline.label} on our ` },
      { type: "link", label: "RSVP", href: "/rsvp" },
      { type: "text", value: " page. It helps us plan for everyone." },
    ],
  },
  ...(isPageEnabled("registry")
    ? [
        {
          question: "Do you have a gift registry?",
          answer: [
            {
              type: "text",
              value:
                "Your presence is the greatest gift. For those who have asked, we're keeping things simple and accepting cash gifts and bank transfers only. You'll find our account details on the ",
            },
            { type: "link", label: "Registry", href: "/registry" },
            { type: "text", value: " page." },
          ],
        } satisfies FaqItem,
      ]
    : []),
];
