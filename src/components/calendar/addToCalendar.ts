export type Celebration = "traditional" | "white";

/** Reveals the AddToCalendar rows for the celebrations the guest chose. */
export const showChosenCelebrations = (root: ParentNode, chosen: Celebration[]): void => {
	for (const row of root.querySelectorAll<HTMLElement>("[data-add-to-calendar] [data-celebration]")) {
		row.hidden = !chosen.includes(row.dataset.celebration as Celebration);
	}
};
