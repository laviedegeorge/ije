import { showChosenCelebrations, type Celebration } from "@/components/calendar/addToCalendar";
import { mountPhoneInput } from "@/components/forms/phoneInput";
import { parseApiBody } from "@/util/apiResponse";
import { INTEREST_FIELD, parseInterestFormData, validateInterestForm } from "@/util/interestForm";

const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";

const mountTabs = (root: HTMLElement): void => {
	const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

	const select = (tab: HTMLButtonElement, focus = false) => {
		for (const t of tabs) {
			const on = t === tab;
			t.setAttribute("aria-selected", String(on));
			t.tabIndex = on ? 0 : -1;
			const panel = root.querySelector<HTMLElement>(`#${t.getAttribute("aria-controls")}`);
			if (panel) panel.hidden = !on;
		}
		if (focus) tab.focus();
	};

	for (const [i, tab] of tabs.entries()) {
		tab.addEventListener("click", () => select(tab));
		tab.addEventListener("keydown", (e) => {
			const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
			if (!step) return;
			e.preventDefault();
			select(tabs[(i + step + tabs.length) % tabs.length], true);
		});
	}
};

const clearErrors = (form: HTMLFormElement): void => {
	for (const el of form.querySelectorAll<HTMLElement>(".form-field__error, .form-choice-group__error")) {
		el.hidden = true;
		el.textContent = "";
	}
	for (const el of form.querySelectorAll("[aria-invalid]")) el.setAttribute("aria-invalid", "false");
	const summary = form.querySelector<HTMLElement>("[data-form-error]");
	if (summary) summary.hidden = true;
};

const showFieldErrors = (form: HTMLFormElement, errors: Record<string, string>): void => {
	let first: HTMLElement | null = null;
	for (const [name, message] of Object.entries(errors)) {
		const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
		if (!input) continue;
		const container = input.closest(".form-field, .form-choice-group");
		const errorEl = container?.querySelector<HTMLElement>(".form-field__error, .form-choice-group__error");
		if (errorEl) {
			errorEl.textContent = message;
			errorEl.hidden = false;
		}
		input.setAttribute("aria-invalid", "true");
		first ??= input;
	}
	first?.focus();
};

const showFormError = (form: HTMLFormElement, message: string): void => {
	const summary = form.querySelector<HTMLElement>("[data-form-error]");
	if (!summary) return;
	summary.textContent = message;
	summary.hidden = false;
};

const mountForm = (root: HTMLElement): void => {
	const dialog = root.querySelector<HTMLDialogElement>("dialog");
	const form = root.querySelector<HTMLFormElement>("[data-interest-form]");
	const formView = root.querySelector<HTMLElement>("[data-form-view]");
	const successView = root.querySelector<HTMLElement>("[data-success-view]");
	const submit = root.querySelector<HTMLButtonElement>("[data-submit]");
	const endpoint = root.dataset.endpoint;
	if (!dialog || !form || !formView || !successView || !submit || !endpoint) return;

	const whatsappInput = form.querySelector<HTMLInputElement>(`[name="${INTEREST_FIELD.whatsapp}"]`);
	const whatsapp = whatsappInput ? mountPhoneInput(whatsappInput) : null;

	const resetViews = () => {
		formView.hidden = false;
		successView.hidden = true;
	};

	for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-open-form]")) {
		btn.addEventListener("click", () => {
			resetViews();
			clearErrors(form);
			// Preselect the tab the guest was looking at, unless they already chose.
			const chosen = form.querySelector<HTMLInputElement>(`[name="${INTEREST_FIELD.events}"]:checked`);
			if (!chosen) {
				const preset = form.querySelector<HTMLInputElement>(
					`[name="${INTEREST_FIELD.events}"][value="${btn.dataset.openForm}"]`,
				);
				if (preset) preset.checked = true;
			}
			dialog.showModal();
		});
	}

	for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-close-form]")) {
		btn.addEventListener("click", () => dialog.close());
	}

	// Close when clicking the backdrop.
	dialog.addEventListener("click", (e) => {
		if (e.target === dialog) dialog.close();
	});

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		clearErrors(form);

		const formData = new FormData(form);
		if (whatsapp) formData.set(INTEREST_FIELD.whatsapp, whatsapp.value());

		// Same rules as the server, so typos are caught without a round trip.
		const local = validateInterestForm(parseInterestFormData(formData));
		const fieldErrors = local.ok ? {} : { ...local.fieldErrors };
		if (whatsapp?.isInvalid()) {
			fieldErrors[INTEREST_FIELD.whatsapp] = "Enter a valid WhatsApp number for the country selected.";
		}
		if (Object.keys(fieldErrors).length) {
			showFieldErrors(form, fieldErrors);
			return;
		}

		submit.disabled = true;
		submit.textContent = "Submitting…";

		try {
			const response = await fetch(endpoint, { method: "POST", body: formData });
			const body = parseApiBody(await response.json().catch(() => null));

			if (response.ok && body?.ok) {
				const events = String(formData.get(INTEREST_FIELD.events));
				const chosen: Celebration[] = events === "both" ? ["traditional", "white"] : [events as Celebration];
				showChosenCelebrations(successView, chosen);
				form.reset();
				formView.hidden = true;
				successView.hidden = false;
				successView.querySelector<HTMLElement>("h2")?.focus();
				return;
			}
			if (body?.kind === "validation" && body.fieldErrors) {
				showFieldErrors(form, body.fieldErrors);
				return;
			}
			showFormError(form, body?.message ?? GENERIC_ERROR);
		} catch {
			showFormError(form, "We couldn't reach the server. Check your connection and try again.");
		} finally {
			submit.disabled = false;
			submit.textContent = "Submit";
		}
	});
};

export const mountInterestPage = (): void => {
	const root = document.querySelector<HTMLElement>("[data-interest-page]");
	if (!root) return;
	mountTabs(root);
	mountForm(root);
};
