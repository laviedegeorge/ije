const ACTIVE = "page-loader-active";

/** Removes the loader after its set length, or early on a tap or key press. */
export const mountPageLoader = (): void => {
	const root = document.documentElement;
	const loader = document.querySelector<HTMLElement>("[data-page-loader]");
	if (!loader) return;

	if (!root.classList.contains(ACTIVE)) {
		loader.remove();
		return;
	}

	let finished = false;
	const finish = () => {
		if (finished) return;
		finished = true;
		loader.remove();
		root.classList.remove(ACTIVE);
		const key = loader.dataset.seenKey;
		if (key) {
			try {
				sessionStorage.setItem(key, "1");
			} catch {
				// Private browsing: the loader simply plays again next time.
			}
		}
	};

	const duration = Number(loader.dataset.duration) || 1200;
	const timer = window.setTimeout(finish, duration);

	const skip = () => {
		if (finished || loader.classList.contains("page-loader--skipping")) return;
		window.clearTimeout(timer);
		loader.classList.add("page-loader--skipping");
		window.setTimeout(finish, 450);
	};
	loader.addEventListener("click", skip);
	window.addEventListener("keydown", skip, { once: true });

	// The home welcome counts to 100 alongside its gold bar.
	const count = loader.querySelector<HTMLElement>("[data-loader-count]");
	if (count) {
		const start = performance.now();
		const total = 4000;
		const tick = (now: number) => {
			const progress = Math.min(1, (now - start) / total);
			count.textContent = String(Math.round(100 * (1 - (1 - progress) ** 2))).padStart(2, "0");
			if (progress < 1 && !finished) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}
};
