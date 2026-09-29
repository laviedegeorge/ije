import { coupleNames, event, isPageEnabled, type PageKey } from "@/config/event";

/** Shared nav + routes for Header and static pages */
export const siteTitleSuffix = coupleNames;
export const defaultPageDescription = `${siteTitleSuffix} · Wedding details coming soon.`;

const registryComingSoon = event.comingSoon.includes("registry");

/** While the registry is coming soon, links point at the site's /registry notice. */
export const registryHref = registryComingSoon ? "/registry" : event.registryHref;
export const registryIsExternal = !registryComingSoon;

export type HomeEventPreview = {
	title: string;
	dateLabel: string;
	location: string;
	href: string;
};

export const homePageContent = {
	subheading:
		"We are so grateful to celebrate with you. Here are the key details for our wedding celebrations in Owerri, Imo State, Nigeria.",
	primaryCta: {
		label: "RSVP",
		href: "/rsvp",
	},
	events: [
		{
			title: "Traditional Marriage (Ịgba Nkwụ)",
			dateLabel: "December 23, 2026 · 1:00 pm",
			location:
				"Late Mr. Kenneth Chukwuma Ibekwe's Compound, Umunebo Obokwu, Obinze, Owerri West LGA, Imo State.",
			href: "/schedule#traditional-marriage",
		},
		{
			title: "Church Wedding & Reception",
			dateLabel: "December 26, 2026 · 10:00 am",
			location: "St. James Anglican Church, Uzii, Owerri, Imo State.",
			href: "/schedule#church-wedding",
		},
	] as HomeEventPreview[],
};

export type NavTopLink = {
	kind: "link";
	href: string;
	label: string;
	target: "_self" | "_blank";
};

type NavEntry = NavTopLink & { page?: PageKey };

const allNavItems: NavEntry[] = [
	{
		kind: "link",
		label: "Schedule",
		href: "/schedule",
		target: "_self",
		page: "schedule",
	},
	{
		kind: "link",
		label: "Travel",
		href: "/travel",
		target: "_self",
		page: "travel",
	},
	{
		kind: "link",
		label: "Registry",
		href: registryHref,
		target: registryIsExternal ? "_blank" : "_self",
	},
	{
		kind: "link",
		label: "FAQs",
		href: "/faq",
		target: "_self",
		page: "faq",
	},
	{
		kind: "link",
		label: "Things to Do",
		href: "/things-to-do",
		target: "_self",
		page: "thingsToDo",
	},
	// Asoebi and Join are reached through personal links (?n=name), not the nav.
];

/**
 * Nav links, minus pages switched off in `src/config/event.ts`. The registry
 * shows while it's coming soon, or once live when showRegistryInNav is on.
 */
export const navItems: NavTopLink[] = allNavItems
	.filter(({ page, href }) =>
		page
			? isPageEnabled(page)
			: registryComingSoon || (href !== "" && event.showRegistryInNav),
	)
	.map(({ page: _page, ...link }) => link);

export function navHref(path: string, slug: string): string {
	return `${path.replace(/\/$/, "")}/${slug}`;
}
