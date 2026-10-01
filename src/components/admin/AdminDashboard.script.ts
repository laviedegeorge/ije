import { invitationCard, inviteMessage, whatsAppHref } from "@/data/shareInvite";
import { inviteLink, type InviteKind } from "@/util/inviteLinks";
import { rsvpLink } from "@/util/rsvpLink";

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

const syncButtons = (item: HTMLElement): void => {
	for (const btn of item.querySelectorAll<HTMLButtonElement>("[data-set-status]")) {
		btn.disabled = btn.dataset.setStatus === item.dataset.status;
	}
};

const mountStatusButtons = (root: HTMLElement): void => {
	for (const item of root.querySelectorAll<HTMLElement>(".dash__response")) {
		syncButtons(item);
		const label = item.querySelector<HTMLElement>("[data-status-label]");

		for (const btn of item.querySelectorAll<HTMLButtonElement>("[data-set-status]")) {
			btn.addEventListener("click", async () => {
				const status = btn.dataset.setStatus;
				if (!status || !label) return;
				const previous = label.textContent;
				label.textContent = "Saving…";
				for (const b of item.querySelectorAll<HTMLButtonElement>("[data-set-status]")) b.disabled = true;

				try {
					const response = await fetch("/api/admin/status", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							list: item.dataset.list,
							submittedAt: item.dataset.submittedAt,
							code: item.dataset.code,
							status,
						}),
					});
					if (response.status === 401) {
						window.location.reload();
						return;
					}
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					item.dataset.status = status;
					label.textContent = status;
				} catch {
					label.textContent = previous;
					window.alert("Couldn't update the sheet. Please try again.");
				} finally {
					syncButtons(item);
				}
			});
		}
	}
};

/** Fills (or empties) a ShareButtons group for one personal link. */
const fillShareButtons = (group: Element | null, message: string, link: string): void => {
	if (!group) return;
	const [copyMessage, copyLink] = group.querySelectorAll<HTMLButtonElement>("[data-copy-value]");
	const whatsApp = group.querySelector<HTMLAnchorElement>("[data-whatsapp]");
	const shareCard = group.querySelector<HTMLButtonElement>("[data-share-card]");
	const empty = !message;
	if (copyMessage) copyMessage.dataset.copyValue = message;
	if (copyLink) copyLink.dataset.copyValue = link;
	if (shareCard) shareCard.dataset.shareText = message;
	for (const button of [copyMessage, copyLink, shareCard]) if (button) button.disabled = empty;
	if (whatsApp) {
		whatsApp.href = empty ? "#" : whatsAppHref(message);
		if (empty) whatsApp.setAttribute("aria-disabled", "true");
		else whatsApp.removeAttribute("aria-disabled");
	}
};

/**
 * The invitation card as a file, fetched up front: browsers only allow
 * navigator.share straight after a tap, so it can't wait for a download then.
 */
let invitationFile: File | null = null;

/** Copy and Share card buttons in every ShareButtons group (including inside the dialogs). */
const mountShareButtons = (root: HTMLElement): void => {
	root.addEventListener("click", async (e) => {
		const copy = (e.target as Element).closest<HTMLButtonElement>("[data-copy-value]");
		if (copy && !copy.disabled) {
			const value = copy.dataset.copyValue ?? "";
			const label = copy.textContent;
			try {
				await navigator.clipboard.writeText(value);
				copy.textContent = "Copied";
				window.setTimeout(() => (copy.textContent = label), 2000);
			} catch {
				window.prompt("Copy this:", value);
			}
			return;
		}

		const share = (e.target as Element).closest<HTMLButtonElement>("[data-share-card]");
		if (share && !share.disabled && invitationFile) {
			const text = share.dataset.shareText ?? "";
			try {
				await navigator.share({ files: [invitationFile], text });
			} catch (err) {
				// Closing the share sheet isn't an error; anything else falls back to WhatsApp text.
				if ((err as DOMException)?.name !== "AbortError") window.open(whatsAppHref(text), "_blank", "noopener");
			}
		}
	});

	// Offer "Share card" only where pictures can be shared (mostly phones).
	if (typeof navigator.canShare !== "function") return;
	void fetch(invitationCard.src)
		.then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
		.then((blob) => {
			const file = new File([blob], invitationCard.fileName, { type: blob.type || "image/jpeg" });
			if (!navigator.canShare({ files: [file], text: "" })) return;
			invitationFile = file;
			for (const button of root.querySelectorAll<HTMLButtonElement>("[data-share-card]")) button.hidden = false;
		})
		.catch(() => {
			// No card, no Share button: Copy and WhatsApp still work.
		});
};

/** "RSVP link" dialog: type a name, copy or share the personal link. */
const mountRsvpLinkDialog = (root: HTMLElement): void => {
	const dialog = root.querySelector<HTMLDialogElement>("[data-rsvp-link-dialog]");
	const form = dialog?.querySelector<HTMLFormElement>("[data-rsvp-link-form]");
	const name = dialog?.querySelector<HTMLInputElement>("[data-rsvp-link-name]");
	const output = dialog?.querySelector<HTMLInputElement>("[data-rsvp-link-output]");
	const buttons = dialog?.querySelector("[data-share-buttons]") ?? null;
	// Links point at whichever site the admin is open on (localhost, a preview, or live).
	const siteUrl = window.location.origin;
	if (!dialog || !form || !name || !output) return;

	const update = () => {
		const hasName = name.value.trim() !== "";
		output.value = hasName ? rsvpLink(siteUrl, name.value) : "";
		fillShareButtons(buttons, hasName ? inviteMessage("rsvp", name.value, output.value) : "", output.value);
	};

	root.querySelector("[data-open-rsvp-link]")?.addEventListener("click", () => {
		name.value = "";
		update();
		dialog.showModal();
		name.focus();
	});
	name.addEventListener("input", update);
	output.addEventListener("focus", () => output.select());

	// Enter in the name field copies the message.
	form.addEventListener("submit", (e) => {
		e.preventDefault();
		buttons?.querySelector<HTMLButtonElement>("[data-copy-value]")?.click();
	});

	dialog.querySelector("[data-close-dialog]")?.addEventListener("click", () => dialog.close());
	dialog.addEventListener("click", (e) => {
		if (e.target === dialog) dialog.close();
	});
};

/** "Invite" dialog: add someone to Guests for asoebi / groomsmen, then copy their links. */
const mountInviteDialog = (root: HTMLElement): void => {
	const dialog = root.querySelector<HTMLDialogElement>("[data-invite-dialog]");
	const form = dialog?.querySelector<HTMLFormElement>("[data-invite-form]");
	const result = dialog?.querySelector<HTMLElement>("[data-invite-result]");
	const error = dialog?.querySelector<HTMLElement>("[data-invite-error]");
	const submit = dialog?.querySelector<HTMLButtonElement>("[data-invite-submit]");
	const added = dialog?.querySelector<HTMLElement>("[data-invite-added]");
	if (!dialog || !form || !result || !error || !submit || !added) return;

	// After adding someone, reload on close so they appear on the Invitations tab.
	let addedSomeone = false;
	dialog.addEventListener("close", () => {
		if (addedSomeone) window.location.reload();
	});

	const showForm = () => {
		form.reset();
		form.hidden = false;
		result.hidden = true;
		error.hidden = true;
	};

	root.querySelector("[data-open-invite]")?.addEventListener("click", () => {
		showForm();
		dialog.showModal();
		form.querySelector<HTMLInputElement>('[name="name"]')?.focus();
	});
	dialog.querySelector("[data-invite-again]")?.addEventListener("click", () => {
		showForm();
		form.querySelector<HTMLInputElement>('[name="name"]')?.focus();
	});
	dialog.querySelector("[data-close-dialog]")?.addEventListener("click", () => dialog.close());
	dialog.addEventListener("click", (e) => {
		if (e.target === dialog) dialog.close();
	});

	for (const output of dialog.querySelectorAll<HTMLInputElement>("[data-link-output]")) {
		output.addEventListener("focus", () => output.select());
	}

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		error.hidden = true;
		const data = new FormData(form);
		const payload = {
			name: String(data.get("name") ?? ""),
			category: String(data.get("category") ?? ""),
			plusOne: Number(data.get("plusOne") || 0),
			asoebi: data.get("asoebi") === "on",
			groomsmen: data.get("groomsmen") === "on",
		};

		submit.disabled = true;
		submit.textContent = "Adding…";
		try {
			const response = await fetch("/api/admin/guest", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (response.status === 401) {
				window.location.reload();
				return;
			}
			const body = (await response.json().catch(() => null)) as
				| { ok?: boolean; code?: string; name?: string; message?: string }
				| null;
			if (!response.ok || !body?.ok || !body.code) {
				error.textContent = body?.message ?? "Couldn't add them to the sheet. Try again.";
				error.hidden = false;
				return;
			}

			const name = body.name ?? payload.name;
			added.textContent = `${name} is on the guest list. Send them their link:`;
			for (const block of dialog.querySelectorAll<HTMLElement>("[data-invite-link]")) {
				const kind = block.dataset.inviteLink as InviteKind;
				block.hidden = !payload[kind];
				if (block.hidden) continue;
				const link = inviteLink(window.location.origin, kind, name, body.code);
				const output = block.querySelector<HTMLInputElement>("[data-link-output]");
				if (output) output.value = link;
				fillShareButtons(block.querySelector("[data-share-buttons]"), inviteMessage(kind, name, link), link);
			}
			addedSomeone = true;
			form.hidden = true;
			result.hidden = false;
		} catch {
			error.textContent = "Couldn't reach the server. Check your connection and try again.";
			error.hidden = false;
		} finally {
			submit.disabled = false;
			submit.textContent = "Add and get link";
		}
	});
};

export const mountAdminDashboard = (): void => {
	const root = document.querySelector<HTMLElement>("[data-admin-dashboard]");
	if (!root) return;
	mountTabs(root);
	mountStatusButtons(root);
	mountRsvpLinkDialog(root);
	mountInviteDialog(root);
	mountShareButtons(root);
};
