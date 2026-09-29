import type { APIRoute } from "astro";
import { getGatePassword, safeEqual, safeNextPath, setGateCookie } from "@/util/siteGate";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
	const password = getGatePassword();

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return redirect("/unlock?error=1", 303);
	}

	const nextPath = safeNextPath(formData.get("next"));
	if (!password) {
		return redirect(nextPath, 303);
	}

	const attempt = String(formData.get("password") ?? "");
	if (!safeEqual(attempt, password)) {
		return redirect(`/unlock?error=1&next=${encodeURIComponent(nextPath)}`, 303);
	}

	setGateCookie(cookies, password, url.protocol === "https:");
	return redirect(nextPath, 303);
};
