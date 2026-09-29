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

export const mountAdminDashboard = (): void => {
	const root = document.querySelector<HTMLElement>("[data-admin-dashboard]");
	if (!root) return;
	mountTabs(root);
	mountStatusButtons(root);
};
