// Drives the garden invitation rendered by GardenExperience.astro: the envelope, the chapters and
// the three.js scene. A port of the React layer in Wedoo's Garden Experience template.
import { CHAPTERS, type ChapterId, type GardenContent, type GardenPhoto } from "./content";
import { createGardenScene, PLACES, type GardenScene, type TimeOfDay } from "./garden-scene";

const SPOTS = CHAPTERS.filter((c) => PLACES[c.id].anchor);
/** On phones a chapter opens as a bottom sheet; the camera lifts its object into the space above. */
const SHEET_SHIFT = 0.16;
/** Font-family values for canvas lettering in the 3D scene (loaded by the page). */
const FONTS = { display: '"Bodoni Moda"', body: '"Figtree"' };

const setStyle = (el: HTMLElement, prop: string, value: string) => {
  if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
};
const setEdge = (el: HTMLElement, edge: string) => {
  if (el.dataset.edge !== edge) el.dataset.edge = edge;
};

export function mountGarden(root: HTMLElement): void {
  const content = JSON.parse(root.dataset.content ?? "") as GardenContent;
  const find = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

  const canvas = find<HTMLCanvasElement>("[data-world]");
  const fallback = find("[data-fallback]");
  const loading = find("[data-loading]");
  const opening = find("[data-opening]");
  const sealed = find("[data-sealed]");
  const seal = find("[data-seal]");
  const spotsHost = find("[data-spots]");
  const app = find("[data-app]");
  const stage = find("[data-stage]");
  const toggles = find("[data-toggles]");
  const navButtons = [...root.querySelectorAll<HTMLButtonElement>(".chapters [data-go]")];
  const dots = [...root.querySelectorAll<HTMLElement>(".dots i")];
  const [prevStep, nextStep] = [...root.querySelectorAll<HTMLButtonElement>("[data-step]")];
  const spotEls = new Map<ChapterId, HTMLButtonElement>();
  root.querySelectorAll<HTMLButtonElement>("[data-spot]").forEach((el) => spotEls.set(el.dataset.spot as ChapterId, el));

  const phoneQuery = window.matchMedia("(max-width: 720px)");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const days = Math.max(0, Math.ceil((Date.parse(content.eventDate) - Date.now()) / 864e5));

  let scene: GardenScene | null = null;
  let panel = find("[data-panel]");
  // The render loop reads these every frame.
  let index = 0, opened = false, phone = phoneQuery.matches;
  let time: TimeOfDay = "golden";
  let answered = false;

  const frameShift = () => (phone && opened && CHAPTERS[index].id !== "welcome" ? SHEET_SHIFT : 0);

  // Labels follow their objects and the Welcome panel stays inside the arch. Runs on every rendered
  // frame, so it only touches the DOM when a value actually changes (each write costs a style pass).
  function placeOverlay() {
    const s = scene;
    if (!s || !opened) return;
    const welcome = CHAPTERS[index].id === "welcome";
    if (welcome) {
      const arch = s.projectArch();
      setStyle(panel, "--ax", `${Math.round(arch.x)}px`);
      setStyle(panel, "--ay", `${Math.round(arch.y)}px`);
    }
    const on = welcome && s.flight() > 0.85;
    if (spotsHost.classList.contains("on") !== on) spotsHost.classList.toggle("on", on);
    if (!on) return;
    const w = window.innerWidth, h = window.innerHeight;
    // Phones can't fit the sides of the garden, so labels line up down each edge below the arch.
    const lane = { left: 0, right: 0 };
    for (const c of SPOTS) {
      const el = spotEls.get(c.id), anchor = PLACES[c.id].anchor;
      if (!el || !anchor) continue;
      if (phone) {
        const side = anchor[0] < 0 ? "left" : "right";
        setEdge(el, side);
        setStyle(el, "transform", `translate(${side === "left" ? 12 : w - 12}px, ${Math.round(h * 0.7 + lane[side]++ * 42)}px)`);
        continue;
      }
      const p = s.project(anchor);
      let x = p.x;
      setEdge(el, p.behind || x < 80 ? "left" : x > w - 80 ? "right" : "");
      if (p.behind) x = x > w / 2 ? 0 : w;
      x = Math.min(w - 12, Math.max(12, x));
      setStyle(el, "transform", `translate(${Math.round(x)}px, ${Math.round(Math.min(h - 130, Math.max(120, p.y)))}px)`);
    }
  }

  function showFallback() {
    fallback.hidden = false;
    loading.classList.add("gone");
  }

  // Build the courtyard for the device class, and again if it changes (a rotated tablet, a resized window).
  function buildScene() {
    scene?.dispose();
    scene = createGardenScene(canvas, {
      content,
      phone,
      reduceMotion: motionQuery.matches,
      fonts: FONTS,
      onReady: () => loading.classList.add("gone"),
      onFrame: placeOverlay,
      onError: showFallback,
    });
    if (!scene) {
      requestAnimationFrame(showFallback);
      return;
    }
    if (!opened) return;
    // The scene holds a still frame behind the envelope and only renders once it is open.
    scene.setLive(true);
    scene.jumpTo(CHAPTERS[index].id);
    scene.setFrameShift(frameShift());
    if (time !== "golden") scene.setTime(time);
  }
  const onDeviceChange = () => {
    phone = phoneQuery.matches;
    buildScene();
  };
  phoneQuery.addEventListener("change", onDeviceChange);
  motionQuery.addEventListener("change", onDeviceChange);
  buildScene();

  // --- the envelope ---

  // The two seal halves and a few wax crumbs fall away under gravity.
  function dropSeal() {
    seal.querySelectorAll<HTMLElement>(".half").forEach((half, i) => {
      const side = i ? 1 : -1;
      half.animate(
        [
          { transform: "none", opacity: 1 },
          // The two halves crack apart and hang for a beat before they drop.
          { transform: `translate(${side * 14}px, 2px) rotate(${side * 7}deg)`, opacity: 1, offset: 0.14 },
          { transform: `translate(${side * 22}px, 8px) rotate(${side * 11}deg)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${side * (60 + Math.random() * 40)}px, 60vh) rotate(${side * (70 + Math.random() * 60)}deg)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${side * (70 + Math.random() * 40)}px, 70vh) rotate(${side * (90 + Math.random() * 60)}deg)`, opacity: 0 },
        ],
        { duration: 1600, easing: "cubic-bezier(.3,0,.85,.5)", fill: "forwards" },
      );
    });
    for (let i = 0; i < 8; i++) {
      const crumb = document.createElement("i"), size = 3 + Math.random() * 4, x = (Math.random() - 0.5) * 80;
      crumb.className = "crumb";
      crumb.style.width = crumb.style.height = `${size}px`;
      seal.appendChild(crumb);
      crumb.animate(
        [
          { transform: "translate(0, 0)", opacity: 1 },
          { transform: `translate(${x * 0.5}px, ${-8 - Math.random() * 16}px)`, opacity: 1, offset: 0.2 },
          { transform: `translate(${x * 1.5}px, 65vh) rotate(220deg)`, opacity: 0 },
        ],
        { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.3,0,.9,.6)", fill: "forwards" },
      );
    }
  }

  function openGarden() {
    opening.classList.replace("closed", "leaving");
    window.setTimeout(() => opening.classList.replace("leaving", "gone"), 450);
    opened = true;
    app.classList.add("ready");
    scene?.setLive(true);
    scene?.setFrameShift(frameShift());
    scene?.flyTo(CHAPTERS[index].id);
  }

  find("[data-envelope]").addEventListener("click", () => {
    if (sealed.classList.contains("cracked") || sealed.classList.contains("opened")) return;
    const reduceMotion = motionQuery.matches;
    navigator.vibrate?.([14, 40, 8]);
    if (!reduceMotion) dropSeal();
    sealed.classList.add("cracked");
    window.setTimeout(() => sealed.classList.replace("cracked", "opened"), reduceMotion ? 0 : 250);
    window.setTimeout(openGarden, reduceMotion ? 0 : 900);
  });

  // Every visit starts at the sealed envelope. A page restored from the back/forward cache would
  // otherwise come back mid-garden, so it reloads.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.location.reload();
  });

  // --- chapters ---

  // Each chapter gets a fresh panel, so its entrance animation plays again.
  function renderChapter() {
    const chapter = CHAPTERS[index];
    const welcome = chapter.id === "welcome";
    const next = document.createElement("article");
    next.className = `panel enter${welcome ? " anchored" : ""}`;
    next.tabIndex = -1;
    next.setAttribute("aria-live", "polite");
    if (!welcome) {
      // The phone sheet starts compact on every chapter; the handle expands it.
      const handle = document.createElement("button");
      handle.className = "sheet-handle";
      handle.type = "button";
      handle.append(document.createElement("i"));
      const setExpanded = (expanded: boolean) => {
        next.classList.toggle("expanded", expanded);
        handle.setAttribute("aria-expanded", String(expanded));
        handle.setAttribute("aria-label", expanded ? "Show less" : "Show more");
      };
      setExpanded(false);
      handle.addEventListener("click", () => setExpanded(!next.classList.contains("expanded")));
      next.append(handle);
    }
    next.append(find<HTMLTemplateElement>(`template[data-chapter="${chapter.id}"]`).content.cloneNode(true));
    const daysEl = next.querySelector("[data-days]");
    if (daysEl) daysEl.textContent = String(days);
    if (answered) showAnswered(next);
    panel.replaceWith(next);
    panel = next;

    stage.dataset.side = PLACES[chapter.id].side ?? "right";
    navButtons.forEach((b, n) => {
      b.setAttribute("aria-current", String(n === index));
      if (n === index) b.scrollIntoView({ block: "nearest", inline: "center" });
    });
    dots.forEach((d, n) => d.classList.toggle("on", n === index));
    const prev = CHAPTERS[index - 1], after = CHAPTERS[index + 1];
    prevStep.classList.toggle("ghost", !prev);
    prevStep.querySelector(".lbl")!.textContent = prev?.label ?? "";
    nextStep.classList.toggle("ghost", !after);
    nextStep.querySelector(".lbl")!.textContent = after?.label ?? "";
    toggles.classList.toggle("in-chapter", !welcome);
  }

  function go(target: number | ChapterId, focus = true) {
    const n = typeof target === "number" ? target : CHAPTERS.findIndex((c) => c.id === target);
    if (n < 0 || n >= CHAPTERS.length || n === index) return;
    index = n;
    renderChapter();
    scene?.setFrameShift(frameShift());
    if (!opened) return;
    scene?.flyTo(CHAPTERS[index].id);
    if (focus) panel.focus({ preventScroll: true });
  }

  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const goTo = target.closest<HTMLElement>("[data-go]");
    if (goTo) return go(goTo.dataset.go as ChapterId);
    const step = target.closest<HTMLElement>("[data-step]");
    if (step) return go(index + Number(step.dataset.step));
    const photo = target.closest<HTMLElement>("[data-photo]");
    if (photo) return openLightbox(content.gallery[Number(photo.dataset.photo)]);
    if (target.closest("[data-yes]")) {
      // The link itself opens WhatsApp in a new tab; the panel then says thank you.
      answered = true;
      window.setTimeout(() => showAnswered(panel), 300);
      return;
    }
    if (target.closest("[data-wait]")) {
      const message = panel.querySelector<HTMLElement>("[data-wait-msg]");
      if (message) message.hidden = false;
    }
  });

  function showAnswered(el: HTMLElement) {
    const ask = el.querySelector<HTMLElement>("[data-ask-open]"), done = el.querySelector<HTMLElement>("[data-ask-done]");
    if (!ask || !done) return;
    ask.hidden = true;
    done.hidden = false;
  }

  window.addEventListener("keydown", (e) => {
    if (!opened || !lightbox.hidden || (e.target as HTMLElement).closest("input, select, textarea")) return;
    if (e.key === "ArrowRight") go(index + 1, false);
    if (e.key === "ArrowLeft") go(index - 1, false);
  });
  let start: { x: number; y: number } | null = null;
  window.addEventListener("touchstart", (e) => {
    if ((e.target as HTMLElement).closest(".chapters, .panel, .lightbox")) return;
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (!start || !opened) return;
    const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1), false);
    start = null;
  });

  // Objects in the garden are clickable once the camera has landed.
  const pickAt = (e: MouseEvent) => (opened ? scene?.pick(e.clientX, e.clientY) ?? null : null);
  canvas.addEventListener("pointermove", (e) => {
    if (!opened || (scene?.flight() ?? 0) < 1) return;
    const id = pickAt(e);
    canvas.style.cursor = id ? "pointer" : "";
    spotEls.forEach((el, key) => el.classList.toggle("hot", key === id));
  });
  canvas.addEventListener("click", (e) => {
    const id = pickAt(e);
    if (id) go(id);
  });

  toggles.querySelectorAll<HTMLButtonElement>("[data-time]").forEach((button, _, all) => {
    button.addEventListener("click", () => {
      time = button.dataset.time as TimeOfDay;
      all.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      scene?.setTime(time);
    });
  });

  // --- full-screen photos and videos ---

  const lightbox = find("[data-lightbox]");
  const lightboxImg = find<HTMLImageElement>("[data-lightbox-img]");
  const lightboxVideo = find<HTMLVideoElement>("[data-lightbox-video]");
  const lightboxCaption = find("[data-lightbox-caption]");
  let returnFocus: HTMLElement | null = null;

  function openLightbox(photo: GardenPhoto | undefined) {
    if (!photo) return;
    returnFocus = document.activeElement as HTMLElement | null;
    lightbox.setAttribute("aria-label", photo.caption);
    lightboxCaption.textContent = photo.caption;
    lightboxImg.hidden = !!photo.video;
    lightboxVideo.hidden = !photo.video;
    if (photo.video) {
      // Videos only download when opened.
      lightboxVideo.poster = photo.src;
      lightboxVideo.src = photo.video;
      lightboxVideo.play().catch(() => {});
    } else {
      lightboxImg.src = photo.src;
      lightboxImg.alt = photo.caption;
    }
    lightbox.hidden = false;
    find("[data-lightbox-close]").focus();
  }

  function closeLightbox() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.load();
    returnFocus?.focus({ preventScroll: true });
  }

  lightbox.addEventListener("click", (e) => {
    // The video's own controls stay usable; a tap anywhere else closes.
    if ((e.target as HTMLElement).closest("video")) return;
    closeLightbox();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  renderChapter();
}
