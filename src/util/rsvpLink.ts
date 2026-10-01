/**
 * Personal RSVP links: /rsvp?n=Mr.+%26+Mrs.+Anderson greets the guest with the
 * name exactly as written (see src/pages/rsvp.astro).
 */
export const rsvpLink = (siteUrl: string, name: string): string => {
	const n = name.replace(/\s+/g, " ").trim();
	if (!n) return `${siteUrl}/rsvp`;
	// Apostrophes are legal in URLs, but some chat apps end the link at one.
	const encoded = encodeURIComponent(n).replace(/'/g, "%27").replace(/%20/g, "+");
	return `${siteUrl}/rsvp?n=${encoded}`;
};
