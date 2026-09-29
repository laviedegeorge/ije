/**
 * Content for the personal-link pages /join (wedding train) and /asoebi.
 * Each page has a Traditional and a White Wedding tab with a fabric photo,
 * dress guidance, and an "I'm interested" button.
 *
 * Fabric photos: put them in public/assets/ and set `image` (e.g.
 * "/assets/asoebi-traditional.webp"). Without one, a placeholder is shown.
 */

export type InterestTabId = "traditional" | "white";

export type InterestTab = {
	id: InterestTabId;
	label: string;
	date: string;
	image?: string;
	imageAlt: string;
	guidance: string[];
};

export type InterestPageContent = {
	eyebrow: string;
	title: string;
	intro: string;
	tabs: [InterestTab, InterestTab];
	buttonLabel: string;
	formTitle: string;
	successTitle: string;
	successMessage: string;
	invalidMessage: string;
};

export const joinPageContent: InterestPageContent = {
	eyebrow: "Wedding Train",
	title: "Join the Wedding Train",
	intro:
		"We'd love for you to stand with us. Have a look at the outfit for each celebration, then let us know which one you'd like to join.",
	tabs: [
		{
			id: "traditional",
			label: "Traditional",
			date: "Wednesday, December 23, 2026",
			image: "/assets/outfits/groomsmen-traditional.webp",
			imageAlt:
				"The groom's train traditional outfit: an olive-green tailored set with 3/4 sleeves, a red cap, double-strand coral neck beads and coral wrist beads",
			guidance: [
				"The groom's train wears a tailored olive-green set: a 3/4-sleeve top with matching trousers.",
				"Finished with a traditional red cap, double-strand coral neck beads and coral wrist beads, with black shoes.",
				"We'll share fabric, tailoring and payment details on WhatsApp once you register your interest.",
			],
		},
		{
			id: "white",
			label: "White Wedding",
			date: "Saturday, December 26, 2026",
			imageAlt: "Wedding train outfit for the White Wedding",
			guidance: [
				"The train wears a coordinated look for the church service and reception.",
				"Colours of the day are Brown, Tan, Green, Black, Champagne Gold and Burgundy.",
				"We'll share outfit, tailoring and payment details on WhatsApp once you register your interest.",
			],
		},
	],
	buttonLabel: "I'm interested",
	formTitle: "Join the wedding train",
	successTitle: "Thank you!",
	successMessage:
		"We've got your details and will reach out on WhatsApp with next steps.",
	invalidMessage:
		"This link doesn't appear to be valid. Please use the personal link we sent you — you're still very much invited to the wedding.",
};

export const asoebiPageContent: InterestPageContent = {
	eyebrow: "Asoebi",
	title: "Dress With Us",
	intro:
		"Dressing together is one of the most beautiful parts of our celebrations. Here's the asoebi for each event — let us know which you'd like.",
	tabs: [
		{
			id: "traditional",
			label: "Traditional",
			date: "Wednesday, December 23, 2026",
			imageAlt: "Asoebi fabric for the Traditional Marriage",
			guidance: [
				"Any traditional style is welcome — sew the asoebi fabric in the style you love.",
				"Colours of the day are Brown, Green, Burnt Orange, Champagne Gold and Tan.",
				"We'll share prices and how to get your fabric on WhatsApp once you register your interest.",
			],
		},
		{
			id: "white",
			label: "White Wedding",
			date: "Saturday, December 26, 2026",
			imageAlt: "Asoebi fabric for the White Wedding",
			guidance: [
				"Elegant, church-appropriate styles in the asoebi fabric.",
				"Colours of the day are Brown, Tan, Green, Black, Champagne Gold and Burgundy.",
				"We'll share prices and how to get your fabric on WhatsApp once you register your interest.",
			],
		},
	],
	buttonLabel: "I'm interested",
	formTitle: "Register your interest",
	successTitle: "Thank you!",
	successMessage:
		"We've got your details and will reach out on WhatsApp about your asoebi.",
	invalidMessage:
		"This link doesn't appear to be valid. Please use the personal link we sent you — you're still very much invited to the wedding.",
};
