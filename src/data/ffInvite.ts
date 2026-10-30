/**
 * Content for /ff, Cynthia's 3D invitation asking Nonye to be her chief
 * bridesmaid. The wedding details come from src/config/event.ts and
 * src/data/schedule.ts; everything personal is written here, taken from
 * Cynthia's letter to her.
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
	photo1: photo(1, "Us, before we knew", 0.62),
	video1: video(1, "Family, long before anyone said it out loud"),
	video2: video(2, "Late nights, talking about everything and nothing"),
	video3: video(3, "Home, Lagos edition"),
	video4: video(4, "You chose me, and kept choosing me"),
	video5: video(5, "Early mornings in traffic"),
	video6: video(6, "Not by blood. By years."),
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
		headline: "From school desks to Lagos keys",
		paragraphs: [
			"Do you remember us in school? Two girls in uniform, neither of us knowing we were starting something that would follow us for the rest of our lives.",
			"Then came Lagos. One roof, early mornings in traffic, late nights on the couch talking about everything and nothing. You saw me at my most tired and my most hopeful, and you stayed for all of it.",
			"Somewhere along the way we started calling ourselves FF. Family, because that is what you became long before anyone said it out loud. Friends, because you chose me, and kept choosing me. Forever, because that is how long this lasts.",
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
		headline: "Every story has chapters",
		intro: "Ours has three so far, and I want you in the next one. Tap a picture to open it. The videos play with sound.",
	},
	wall: [memories.video1, memories.photo1, memories.video4],
	gallery: Object.values(memories),
	ask: {
		eyebrow: `${event.partnerOne.firstName} & ${event.partnerTwo.firstName} · ${event.countdownLabel}`,
		question: "will you be my chief bridesmaid?",
		role: "Chief Bridesmaid",
		paragraphs: [
			"On December 26, I marry Kelechi in Owerri. I cannot picture walking towards that day without you beside me.",
			"You were there for school and for Lagos. I need my FF for this chapter too, standing right beside me.",
		],
		yesLabel: "Yes, FF forever",
		waitLabel: "I need a moment",
		waitMessage: "Take all the time you need. This page will be right here, and so will I.",
		whatsApp: "+2347038644533",
		reply:
			"Cynthia!! I just opened my invitation and I'm in tears. YES, a thousand times yes. I'd be honoured to be your chief bridesmaid. From our school days to Lagos to Owerri, FF forever ❤️\n\nNonye",
		doneTitle: "FF, forever.",
		doneMessage: "WhatsApp should have opened with your reply to Cynthia. Edit it if you like, then send.",
	},
};
