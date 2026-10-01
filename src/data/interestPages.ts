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
				"Traditional attire for the groomsmen: a deep green set with 3/4 sleeves and matching trousers, a red cap, double-strand coral neck beads, coral wrist beads and black shoes",
			guidance: [
				"The groomsmen wear the deep green fabric we provide, sewn in the style you prefer. The picture shows a 3/4-sleeve top with matching trousers.",
				"Finished with a traditional red cap, matching double-strand coral neck beads and coral wrist beads, with black shoes.",
				"We'll share fabric, tailoring and payment details on WhatsApp once you register your interest.",
			],
		},
		{
			id: "white",
			label: "White Wedding",
			date: "Saturday, December 26, 2026",
			image: "/assets/outfits/groomsmen-white.webp",
			imageAlt:
				"Formal suit for the groomsmen: a charcoal two-piece suit with a crisp white dress shirt, burgundy tie and pocket square, and polished black Oxford shoes",
			guidance: [
				"The groomsmen wear a charcoal suit in the premium wool fabric we provide, tailored in the style you prefer.",
				"Paired with a crisp white dress shirt, a rich burgundy tie and pocket square, and polished black Oxford shoes.",
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
			image: "/assets/outfits/asoebi-traditional.webp",
			imageAlt:
				"Asoebi for the Traditional Marriage: a fitted, off-the-shoulder burnt orange lace gown with an emerald green gele, a fine gold necklace and bracelet, and a gold clutch",
			guidance: [
				"A burnt orange lace dress in the premium lace we provide, sewn in the style you prefer. The picture shows a fitted, off-the-shoulder gown.",
				"Paired with an elegant green gele and minimal gold accessories: timeless and classy.",
				"We'll share prices and how to get your fabric on WhatsApp once you register your interest.",
			],
		},
		{
			id: "white",
			label: "White Wedding",
			date: "Saturday, December 26, 2026",
			image: "/assets/outfits/asoebi-white.webp",
			imageAlt:
				"Bridesmaid dress for the White Wedding: a floor-length, off-the-shoulder burgundy gown in satin with lace panels, a fine gold necklace and bracelet, and a burgundy clutch",
			guidance: [
				"A rich burgundy gown in the premium lace and satin we provide, sewn in the style you prefer. The picture shows a floor-length, off-the-shoulder fit and flare.",
				"Finished with delicate gold jewellery and a matching clutch.",
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
