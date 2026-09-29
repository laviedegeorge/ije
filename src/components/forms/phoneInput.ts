/**
 * Country picker + formatting for phone fields, via intl-tel-input. The number
 * is submitted in E.164 (+2348031234567); the server re-checks it.
 */
import intlTelInput from "intl-tel-input";
import "intl-tel-input/styles";

export type PhoneInput = {
	/** E.164 when the number could be read, otherwise what was typed ("" when empty). */
	value(): string;
	/** True only when there's a value the library is sure is invalid. */
	isInvalid(): boolean;
};

export const mountPhoneInput = (input: HTMLInputElement): PhoneInput => {
	// Inside a modal <dialog> the country list must render in the dialog: anything
	// attached to <body> would sit underneath the modal and be unclickable.
	const dialog = input.closest("dialog");

	const iti = intlTelInput(input, {
		...(dialog ? { dropdownParent: dialog, fullscreenParent: dialog } : {}),
		initialCountry: "ng",
		countryOrder: ["ng", "gb", "us", "ca"],
		separateDialCode: true,
		strictMode: true,
		containerClass: "phone-input",
		// Validation/formatting rules load on demand so the page itself stays light.
		loadUtils: () => import("intl-tel-input/utils"),
	});

	return {
		value: () => {
			const typed = input.value.trim();
			if (!typed) return "";
			return iti.getNumber() || typed;
		},
		isInvalid: () => input.value.trim() !== "" && iti.isValidNumber() === false,
	};
};
