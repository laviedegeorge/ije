/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly SITE_GATE_PASSWORD?: string;
	/** Apps Script web app URL (…/exec) and the SITE_SECRET set in its script properties */
	readonly APPS_SCRIPT_URL?: string;
	readonly APPS_SCRIPT_SECRET?: string;
	/** Code for the /admin page (confirm asoebi / groomsmen, guest list) */
	readonly ADMIN_CODE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
