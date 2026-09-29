/** Which full-screen loader a page shows (see PageLoader.astro). */
export type LoaderConfig =
	| { kind: "welcome"; photo: string }
	| { kind: "seal"; guestName?: string | null }
	| { kind: "curtain"; title: string; photo: string };
