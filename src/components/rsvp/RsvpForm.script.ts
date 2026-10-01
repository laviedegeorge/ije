import {
	isInternationalResidence,
	parseCountryResidence,
	parseRsvpFormData,
	RSVP_EVENTS_ERROR_KEY,
	RSVP_FIELD,
	validateRsvpForm,
} from "@/util/rsvpForm";
import { showChosenCelebrations, type Celebration } from "@/components/calendar/addToCalendar";
import { mountPhoneInput } from "@/components/forms/phoneInput";
import { RSVP_SUBMIT_COPY, submitRsvpFormData } from "@/util/rsvpSubmit";

const ERROR_IDS = [
	...Object.values(RSVP_FIELD).map((name) => `rsvp-error-${name}`),
	`rsvp-error-${RSVP_EVENTS_ERROR_KEY}`,
];

const inputByField: Partial<Record<string, string>> = {
	[RSVP_FIELD.countryResidence]: "rsvp-field-country",
	[RSVP_FIELD.otherCountry]: "rsvp-field-other-country",
	[RSVP_FIELD.fullName]: "rsvp-field-full-name",
	[RSVP_FIELD.email]: "rsvp-field-email",
	[RSVP_FIELD.phone]: "rsvp-field-phone",
	[RSVP_FIELD.hasPlusOne]: "rsvp-check-plus-one",
	[RSVP_FIELD.plusOneName]: "rsvp-field-plus-one",
	[RSVP_FIELD.expectedArrival]: "rsvp-field-arrival",
	[RSVP_FIELD.expectedDeparture]: "rsvp-field-departure",
	[RSVP_FIELD.guestNotes]: "rsvp-field-guest-notes",
	[RSVP_FIELD.messageCouple]: "rsvp-field-message-couple",
};

const focusOrder = [
	RSVP_FIELD.fullName,
	RSVP_FIELD.email,
	RSVP_FIELD.phone,
	RSVP_FIELD.countryResidence,
	RSVP_FIELD.otherCountry,
	RSVP_FIELD.hasPlusOne,
	RSVP_FIELD.plusOneName,
	RSVP_FIELD.eventTraditional,
	RSVP_FIELD.eventWhite,
	RSVP_EVENTS_ERROR_KEY,
	RSVP_FIELD.expectedArrival,
	RSVP_FIELD.expectedDeparture,
	RSVP_FIELD.guestNotes,
	RSVP_FIELD.relationship,
	RSVP_FIELD.messageCouple,
];

const getPartyCount = (form: HTMLFormElement): number => {
	const cb = form.querySelector<HTMLInputElement>(`input[name="${RSVP_FIELD.hasPlusOne}"]`);
	return cb?.checked === true ? 2 : 1;
};

const clearInternationalInputs = (root: HTMLElement): void => {
	for (const name of [RSVP_FIELD.expectedArrival, RSVP_FIELD.expectedDeparture]) {
		const el = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
		if (el) el.value = "";
	}
};

const syncRsvpSections = (form: HTMLFormElement): void => {
	const plusOne = document.getElementById("rsvp-plus-one");
	const otherCountry = document.getElementById("rsvp-other-country");
	const internationalShell = document.getElementById("rsvp-international-shell");
	const international = document.getElementById("rsvp-international");
	const internationalInner = internationalShell?.querySelector<HTMLElement>(
		".rsvp__conditional-shell-inner",
	);

	const sel = form.querySelector(`select[name="${RSVP_FIELD.countryResidence}"]`);
	const countryRaw = sel instanceof HTMLSelectElement ? sel.value : "";
	const country = parseCountryResidence(countryRaw);

	const party = getPartyCount(form);

	if (plusOne) {
		plusOne.hidden = party <= 1;
		if (party <= 1) {
			const plusOneNameInput = form.querySelector<HTMLInputElement>(
				`[name="${RSVP_FIELD.plusOneName}"]`,
			);
			if (plusOneNameInput) plusOneNameInput.value = "";
		}
	}
	if (otherCountry) otherCountry.hidden = country !== "other";

	const intl = country != null && isInternationalResidence(country);
	if (internationalShell && international && internationalInner) {
		internationalShell.dataset.expanded = intl ? "true" : "false";
		if (intl) {
			international.removeAttribute("aria-hidden");
			internationalInner.removeAttribute("inert");
		} else {
			international.setAttribute("aria-hidden", "true");
			internationalInner.setAttribute("inert", "");
			clearInternationalInputs(international);
		}
	}
};

const clearErrors = (form: HTMLFormElement): void => {
	const summary = form.querySelector("#rsvp-form-summary");
	if (summary instanceof HTMLElement) {
		summary.hidden = true;
		summary.textContent = "";
	}

	for (const id of ERROR_IDS) {
		const el = document.getElementById(id);
		if (!el) continue;
		el.hidden = true;
		el.textContent = "";
	}

	for (const el of form.querySelectorAll('[aria-invalid="true"]')) {
		el.setAttribute("aria-invalid", "false");
	}
};

const RADIO_GROUP_FIELDS = new Set<string>([RSVP_FIELD.relationship]);

const markRadioGroupInvalid = (form: HTMLFormElement, name: string): void => {
	for (const r of form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
		r.setAttribute("aria-invalid", "true");
	}
};

const markEventsInvalid = (form: HTMLFormElement): void => {
	for (const name of [RSVP_FIELD.eventTraditional, RSVP_FIELD.eventWhite]) {
		form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.setAttribute("aria-invalid", "true");
	}
};

const showErrors = (form: HTMLFormElement, fieldErrors: Record<string, string>): void => {
	for (const [field, message] of Object.entries(fieldErrors)) {
		const el = document.getElementById(`rsvp-error-${field}`);
		if (el) {
			el.textContent = message;
			el.hidden = false;
		}

		if (field === RSVP_EVENTS_ERROR_KEY) {
			markEventsInvalid(form);
			continue;
		}

		if (RADIO_GROUP_FIELDS.has(field)) {
			markRadioGroupInvalid(form, field);
			continue;
		}

		const inputId = inputByField[field];
		if (inputId) {
			const input = document.getElementById(inputId);
			if (input) input.setAttribute("aria-invalid", "true");
		}
	}

	const multiMsg = Object.values(fieldErrors);
	const summary = form.querySelector("#rsvp-form-summary");
	if (summary instanceof HTMLElement && multiMsg.length > 1) {
		summary.hidden = false;
		summary.textContent = `Please fix ${String(multiMsg.length)} fields — each one is marked in the form.`;
	}
};

const showSubmitError = (form: HTMLFormElement, message: string): void => {
	const summary = form.querySelector("#rsvp-form-summary");
	if (!(summary instanceof HTMLElement)) return;
	summary.hidden = false;
	summary.textContent = message;
	scrollFieldIntoView(summary);
};

const scrollFieldIntoView = (el: HTMLElement | null | undefined): void => {
	if (!el) return;
	const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		? "auto"
		: "smooth";
	el.scrollIntoView({ behavior, block: "center" });
};

const focusFirstInvalid = (form: HTMLFormElement, fieldErrors: Record<string, string>): void => {
	for (const field of focusOrder) {
		if (!(field in fieldErrors)) continue;

		let target: HTMLElement | null | undefined;

		if (RADIO_GROUP_FIELDS.has(field)) {
			target = form.querySelector<HTMLInputElement>(`input[name="${field}"]:not([disabled])`);
		} else if (field === RSVP_EVENTS_ERROR_KEY) {
			target = form.querySelector<HTMLInputElement>(`input[name="${RSVP_FIELD.eventTraditional}"]`);
		} else if (field === RSVP_FIELD.eventTraditional || field === RSVP_FIELD.eventWhite) {
			target = form.querySelector<HTMLInputElement>(`input[name="${field}"]:not([disabled])`);
		} else if (field === RSVP_FIELD.countryResidence) {
			target = document.getElementById("rsvp-field-country");
		} else {
			const inputId = inputByField[field];
			target = inputId ? document.getElementById(inputId) : null;
		}

		target?.focus({ preventScroll: true });
		scrollFieldIntoView(target);
		return;
	}
};

const scrollRsvpSuccessBelowHeader = (el: HTMLElement): void => {
	const scrollBehavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)")
		.matches
		? "auto"
		: "smooth";
	const gapPx = 400;

	const run = (): void => {
		const header = document.querySelector("[data-app-header]");
		const headerBottom =
			header instanceof HTMLElement ? header.getBoundingClientRect().bottom : 0;
		const elTop = el.getBoundingClientRect().top;
		const delta = elTop - headerBottom - gapPx;
		if (Math.abs(delta) > 1) {
			window.scrollBy({ top: delta, behavior: scrollBehavior });
		}
	};

	requestAnimationFrame(() => {
		requestAnimationFrame(run);
	});
};

export const mountRsvpForm = (): void => {
	const form = document.getElementById("rsvp-form");
	const success = document.getElementById("rsvp-success");
	const submitBtn = document.getElementById("rsvp-submit");

	if (!(form instanceof HTMLFormElement) || !success) {
		throw new Error("RSVP form markup missing");
	}

	const phoneInput = form.querySelector<HTMLInputElement>(`[name="${RSVP_FIELD.phone}"]`);
	const phone = phoneInput ? mountPhoneInput(phoneInput) : null;

	syncRsvpSections(form);

	form.addEventListener("change", (e) => {
		const t = e.target;
		if (
			(t instanceof HTMLInputElement && t.name === RSVP_FIELD.hasPlusOne) ||
			(t instanceof HTMLSelectElement && t.name === RSVP_FIELD.countryResidence)
		) {
			syncRsvpSections(form);
		}
	});

	form.addEventListener("submit", async (e: SubmitEvent) => {
		e.preventDefault();
		clearErrors(form);
		syncRsvpSections(form);

		const formData = new FormData(form);
		if (phone) formData.set(RSVP_FIELD.phone, phone.value());

		const result = validateRsvpForm(parseRsvpFormData(formData));
		const fieldErrors = result.ok ? {} : { ...result.fieldErrors };
		if (phone?.isInvalid()) {
			fieldErrors[RSVP_FIELD.phone] = "Enter a valid phone number for the country selected.";
		}
		if (Object.keys(fieldErrors).length) {
			showErrors(form, fieldErrors);
			focusFirstInvalid(form, fieldErrors);

			const summary = form.querySelector("#rsvp-form-summary");
			if (summary instanceof HTMLElement && !summary.hidden) {
				scrollFieldIntoView(summary);
			}
			return;
		}

		if (submitBtn instanceof HTMLButtonElement) {
			submitBtn.disabled = true;
			submitBtn.textContent = RSVP_SUBMIT_COPY.submitting;
		}

		const saved = await submitRsvpFormData(formData);

		if (submitBtn instanceof HTMLButtonElement) {
			submitBtn.disabled = false;
			submitBtn.textContent = RSVP_SUBMIT_COPY.submitLabel;
		}

		if (!saved.ok) {
			if (saved.kind === "validation") {
				showErrors(form, saved.fieldErrors);
				focusFirstInvalid(form, saved.fieldErrors);
				return;
			}
			showSubmitError(form, saved.message);
			return;
		}

		const chosen: Celebration[] = [];
		if (result.ok && result.values.event_traditional) chosen.push("traditional");
		if (result.ok && result.values.event_white) chosen.push("white");
		showChosenCelebrations(success, chosen);

		form.hidden = true;
		success.hidden = false;
		scrollRsvpSuccessBelowHeader(success);
		success.focus({ preventScroll: true });
	});
};
