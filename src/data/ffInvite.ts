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
	video3: video(3, "One roof in Ajah"),
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
		note: "I hid a letter in this garden. Walk through it with me.",
	},
	story: {
		eyebrow: "Family · Friends · Forever",
		headline: "It started at Feddy",
		paragraphs: [
			"Do you remember us at Feddy? Two girls in different dormitories, in our school uniforms, sharing provisions after prep and finding little ways to make memories together. We had no idea we were building a friendship that would keep growing long after we left school.",
			"Then there's FF. 🥹 We started calling ourselves that simply because we lived close to each other, a little name that became our thing. Now people who know you through me call me FF, and people who know me through you call you FF. Our names almost belong to each other.",
			"Isn't that what the best friendships do? They leave little pieces of each other everywhere they go.",
			"FF: Family and Friends, forever. Family, because you became one without us ever needing to define it. Friends, because we've stood the test of time, distance and growing up. Forever, because I can't tell my story without finding you in it.",
		],
		portrait: memories.photo1,
	},
	gathering: {
		eyebrow: "Owerri",
		headline: "Our next chapter",
		intro:
			"On December 26, I marry Kelechi. As I count down, I keep thinking of the people who knew me before this moment and loved me through every version of myself. You are one of those people.",
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
		headline: "Then came Lagos",
		intro:
			"One roof in Ajah, early mornings battling traffic, late nights on the couch talking about everything and nothing. You saw me at my most exhausted and my most hopeful, and through it all you were there. Tap a picture to open it; the videos play with sound.",
	},
	inOrder: true,
	wall: [memories.video1, memories.photo1, memories.video4],
	gallery: Object.values(memories),
	// Spotify until there's an audio file; to switch, replace `spotify` with
	// src: media("beautiful-things.mp3") and add the file to public/assets/ff/.
	song: { title: "Beautiful Things", artist: "Benson Boone", spotify: "6tNQ70jh4OwmPGpYy6R2o9" },
	ask: {
		eyebrow: `${event.partnerOne.firstName} & ${event.partnerTwo.firstName} · ${event.countdownLabel}`,
		question: "will you be my chief bridesmaid?",
		role: "Chief Bridesmaid",
		paragraphs: [
			"I have prayed, hoped and dreamed about this day for so long, and now that it's here, my heart is overflowing with gratitude.",
			"I can't imagine standing there without you beside me. I want to look over and see your face, feel that familiar comfort, and know that one of my oldest, most precious friendships is right there as I begin this new chapter.",
			"My darling Nonye, my friend, my family, my original FF, my forever person: after all the years and all the life we've shared, it would mean more than words can say to have you walk this part with me too. 🥹❤️",
		],
		signoff: "With all my love,\nyour Cynthia ❤️",
		yesLabel: "Yes, FF forever",
		waitLabel: "I need a moment",
		waitMessage: "Take all the time you need. This page will be right here, and so will I.",
		whatsApp: "+2347038644533",
		reply:
			"Cynthia!! I just opened my invitation and I'm in tears. YES, a thousand times yes. I'd be honoured to be your chief bridesmaid. From Feddy to Ajah to Owerri, FF forever ❤️\n\nNonye",
		doneTitle: "FF, forever.",
		doneMessage: "WhatsApp should have opened with your reply to Cynthia. Edit it if you like, then send.",
	},
};
