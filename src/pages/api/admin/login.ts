import type { APIRoute } from "astro";
import { clearAdminCookie, isAdminCodeCorrect, setAdminCookie } from "@/util/adminAuth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return redirect("/admin?error=1", 303);
	}

	if (formData.get("logout")) {
		clearAdminCookie(cookies);
		return redirect("/admin", 303);
	}

	if (!isAdminCodeCorrect(String(formData.get("code") ?? ""))) {
		return redirect("/admin?error=1", 303);
	}

	setAdminCookie(cookies, url.protocol === "https:");
	return redirect("/admin", 303);
};
