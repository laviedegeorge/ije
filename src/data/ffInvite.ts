/**
 * Content for /ff, Cynthia's 3D invitation asking Nonye to be her chief
 * bridesmaid. The wedding details come from src/config/event.ts and
 * src/data/schedule.ts; everything personal is written here.
 *
 * Text in [square brackets] is a placeholder: replace it before sending the link.
 *
 * Media lives in public/assets/ff/. Each video has a poster frame (video-N.jpg)
 * and a small thumbnail (video-N-thumb.jpg); videos only download when opened.
 */
import type { GardenContent, GardenPhoto } from "@/components/garden/content";
import { event } from "@/config/event";
import { schedulePageData } from "@/data/schedule";

const media = (name: string) => `/assets/ff/${name}`;
const photo = (n: number, caption: string, focusX?: number): GardenPhoto => ({
	src: media(`photo-${n}.jpg`),
	thumb: media(`photo-${n}-thumb.jpg`),
	caption,
	focusX,
});
const video = (n: number, caption: string): GardenPhoto => ({
	src: media(`video-${n}.jpg`),
	thumb: media(`video-${n}-thumb.jpg`),
	video: media(`video-${n}.mp4`),
	caption,
});

const memories = {
	photo1: photo(1, "[Caption for this photo]", 0.62),
	video1: video(1, "[Caption for video 1]"),
	video2: video(2, "[Caption for video 2]"),
	video3: video(3, "[Caption for video 3]"),
	video4: video(4, "[Caption for video 4]"),
	video5: video(5, "[Caption for video 5]"),
	video6: video(6, "[Caption for video 6]"),
};

const [traditionalDay, churchDay] = schedulePageData.days;
const traditional = traditionalDay.events[0];
const church = churchDay.events[0];

export const ffInviteContent: GardenContent = {
	names: [event.partnerOne.firstName, event.partnerTwo.firstName],
	from: event.partnerOne.firstName,
	guestName: "Nonye",
	sealInitials: "FF",
	eventDate: event.countdownTarget,
	dateLabel: event.dateLabel,
	city: "Owerri",
	cardPlace: event.locationLabel,
	welcome: {
		eyebrow: `From ${event.partnerOne.firstName}, to her FF`,
		note: "Tap anything in the garden to explore.",
	},
	story: {
		eyebrow: "Family · Friends · Forever",
		headline: "[A headline for your story, e.g. From school desks to Lagos keys]",
		paragraphs: [
			"[How you met: the school, the year, the first memory you share.]",
			"[The Lagos years: living together, the late-night talks, what she has meant to you.]",
			"Somewhere along the way we started calling ourselves FF. Family, friends, forever.",
		],
		portrait: memories.photo1,
	},
	gathering: {
		eyebrow: "Owerri",
		headline: "Two celebrations",
		items: [
			{
				day: "Wed, Dec 23",
				time: traditional.timeLabel ?? "",
				boardWhen: "Wednesday 23 · 1 pm",
				name: traditional.title,
				boardName: "Traditional",
				details: `${traditional.venue}, ${traditional.location}.`,
			},
			{
				day: "Sat, Dec 26",
				time: church.timeLabel ?? "",
				boardWhen: "Saturday 26 · 10 am",
				name: church.title,
				boardName: "Church wedding",
				details: `${church.venue}, ${church.location}.`,
			},
			{
				day: "Sat, Dec 26",
				time: "After church",
				boardWhen: "Saturday 26 · after church",
				name: "Reception",
				boardName: "Reception",
				details: church.notes ?? "",
			},
		],
	},
	memories: {
		eyebrow: "Memories",
		headline: "[A headline for your memories, e.g. Us, through the years]",
		intro: "Tap a picture to open it. The videos play with sound.",
	},
	wall: [memories.video1, memories.photo1, memories.video4],
	gallery: Object.values(memories),
	ask: {
		eyebrow: `${event.partnerOne.firstName} & ${event.partnerTwo.firstName} · ${event.countdownLabel}`,
		question: "will you be my chief bridesmaid?",
		role: "Chief Bridesmaid",
		paragraphs: [
			"[A few words from Cynthia: why it has to be her, standing right beside you.]",
		],
		yesLabel: "Yes, FF forever",
		waitLabel: "I need a moment",
		waitMessage: "Take all the time you need. This page will be right here, and so will I.",
		whatsApp: "+2347038644533",
		reply:
			"Cynthia!! I just opened my invitation. YES, a thousand times yes. I'd be honoured to be your chief bridesmaid. FF forever ❤️\n\nNonye",
		doneTitle: "FF, forever.",
		doneMessage: "WhatsApp should have opened with your reply to Cynthia. Edit it if you like, then send.",
	},
};
