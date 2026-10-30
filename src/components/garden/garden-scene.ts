// A golden-hour garden ceremony built in three.js (adapted from Wedoo's Garden Experience
// template): rows of chairs down an aisle runner, string lights overhead and a floral arbour.
// Each chapter of the invitation is a place in the garden (an easel, a photo wall, a board, a
// table) and a camera shot. garden.script.ts drives it through the handle returned by createGardenScene.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { mergeBufferGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ChapterId, GardenContent, GardenPhoto } from "./content";

export type TimeOfDay = "golden" | "evening";
type Vec3 = [number, number, number];
/** A camera shot: [position, look-at]. */
type Shot = [Vec3, Vec3];

/**
 * Where each chapter lives. `side` is where its panel sits (opposite the object) and `anchor`
 * is where its label floats on the Welcome view. Phone shots sit further back.
 */
export const PLACES: Record<
  ChapterId,
  { desk: Shot; phone: Shot; side?: "left" | "right"; anchor?: Vec3 }
> = {
  welcome: { desk: [[0, 2.3, 11], [0, 3.5, -7.6]], phone: [[0, 3.1, 8.5], [0, 3.5, -7.6]] },
  story: { desk: [[-1.3, 1.7, 6.4], [-4, 1.4, 3.6]], phone: [[-1, 1.9, 7.4], [-4, 1.4, 3.6]], side: "right", anchor: [-4, 2.25, 3.6] },
  memories: { desk: [[-1.4, 1.7, 2.2], [-5.2, 1.65, -0.6]], phone: [[-0.6, 1.8, 3.2], [-5.2, 1.65, -0.6]], side: "right", anchor: [-4.85, 2.45, -0.6] },
  days: { desk: [[0.3, 1.7, 0.2], [3.95, 1.3, -0.7]], phone: [[0.66, 1.45, 1.19], [3.95, 1.34, -0.7]], side: "left", anchor: [3.95, 2.25, -0.7] },
  // Shot from just outside the last chair on the right, so no chair back crowds the lens.
  ask: { desk: [[2.45, 1.6, 6.1], [3.45, 1, 4.35]], phone: [[2.55, 1.35, 6.0], [3.45, 1, 4.35]], side: "left", anchor: [3.5, 1.15, 4.3] },
};
const INTRO: Shot = [[0, 3.4, 19.5], [0, 2.4, -7.5]];
/** Centre of the floral arbour; the Welcome panel sits inside it. */
const GATE = new THREE.Vector3(0, 3.5, -7.6);
/** The arbour's pillars stand this far either side of the aisle; its beam sits at ARBOUR_TOP. */
const ARBOUR_HALF = 2.6, ARBOUR_TOP = 6.7;

export type GardenScene = {
  /** Fly the camera to a chapter's shot. */
  flyTo: (chapter: ChapterId) => void;
  /** Put the camera at a chapter's shot with no flight. */
  jumpTo: (chapter: ChapterId) => void;
  setTime: (time: TimeOfDay) => void;
  /**
   * Moves what the camera looks at up the screen by a fraction of its height, so an object stays
   * visible above a bottom sheet. Eases to the new value.
   */
  setFrameShift: (fraction: number) => void;
  /** Screen position of a world point in CSS pixels; `behind` when it is behind the camera. */
  project: (point: Vec3) => { x: number; y: number; behind: boolean };
  /** Screen position of the arch centre. */
  projectArch: () => { x: number; y: number };
  /** The chapter whose object is under a screen point, if any. */
  pick: (x: number, y: number) => ChapterId | null;
  /** 0..1 progress of the current camera flight (1 when still). */
  flight: () => number;
  /** While false (the envelope is showing) the scene holds a still frame instead of rendering. */
  setLive: (live: boolean) => void;
  dispose: () => void;
};

export type GardenSceneOptions = {
  content: GardenContent;
  phone: boolean;
  reduceMotion: boolean;
  fonts: { display: string; body: string };
  /** Called after the first frames render. */
  onReady: () => void;
  /** Called every frame after the camera moves, to place DOM overlays. */
  onFrame: () => void;
  /** Called if rendering fails (some phone GPUs), after the loop stops. */
  onError: () => void;
};

/** Returns null when WebGL is unavailable, so the page can fall back to a still background. */
export function createGardenScene(
  canvas: HTMLCanvasElement,
  { content, phone, reduceMotion, fonts, onReady, onFrame, onError }: GardenSceneOptions,
): GardenScene | null {
  // Low-end phones get a lighter scene from the start; any other phone that turns out slow switches
  // to it at runtime (see adaptQuality).
  let lite = phone && isLowEndDevice();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: phone && !lite,
      precision: lite ? "mediump" : "highp",
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  const T = THREE;
  const col = (hex: string) => new T.Color(hex).convertSRGBToLinear();
  const rand = (() => {
    let v = 7;
    return () => ((v = (v * 9301 + 49297) % 233280), v / 233280);
  })();
  const display = (size: number, style = "") => `${style} ${size}px ${fonts.display}`.trim();
  const body = (size: number, weight: number) => `${weight} ${size}px ${fonts.body}`;

  // Phones render straight to the screen: no bloom or grading passes, which are full-screen work a
  // phone GPU pays for every frame. The renderer tone-maps and antialiases instead. That buys the
  // pixels for sharp photos and lettering; phones step down only if they still can't keep up.
  let minDpr = lite ? 1 : 1.5;
  if (phone) {
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.outputEncoding = T.sRGBEncoding;
  }
  let DPR = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : phone ? 2 : 1.75);
  renderer.setPixelRatio(DPR);
  // Shadows cost every lit pixel a filtered lookup; the light scene goes without them.
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  // Nothing that casts a shadow moves, so the shadow map is drawn once.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  /** Behind the envelope nothing renders (live); otherwise a frame is drawn when dirty or animating. */
  let live = false, dirty = true;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(phone ? 52 : 42, 1, 0.1, 200);
  const disposables: { dispose: () => void }[] = [];
  const redraws: (() => void)[] = [];

  // --- canvas texture helpers ---
  function canvasTex(
    w: number,
    h: number,
    draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
    repeat?: [number, number],
  ) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!, w, h);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    disposables.push(t);
    return t;
  }
  /** Draws at 2x so lettering stays crisp up close, and again once the web fonts arrive. */
  function letteredTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    const paint = (g: CanvasRenderingContext2D) => {
      g.setTransform(2, 0, 0, 2, 0, 0);
      draw(g, w, h);
      g.setTransform(1, 0, 0, 1, 0, 0);
    };
    const tex = canvasTex(w * 2, h * 2, paint);
    redraws.push(() => {
      paint((tex.image as HTMLCanvasElement).getContext("2d")!);
      tex.needsUpdate = true;
    });
    return tex;
  }
  /**
   * A material for photos and lettering. On phones these surfaces are seen small, so the GPU samples
   * a pre-shrunk, softened copy of the image; a negative LOD bias picks a sharper one.
   */
  function printMaterial(map: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}) {
    const material = new T.MeshStandardMaterial({ map, ...opts });
    if (phone) {
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          "#ifdef USE_MAP\n  diffuseColor *= texture2D( map, vUv, -1.0 );\n#endif",
        );
      };
      material.customProgramCacheKey = () => "print";
    }
    return material;
  }
  /** Phones show the boards small, so their lettering is drawn larger there. */
  const LETTER = phone ? 1.3 : 1;

  function skyTexture(evening: boolean) {
    return canvasTex(lite ? 1024 : 2048, lite ? 512 : 1024, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.5);
      if (evening) {
        sky.addColorStop(0, "#0b1022"); sky.addColorStop(0.55, "#2a2f55"); sky.addColorStop(0.85, "#7a4f6a"); sky.addColorStop(1, "#c9786a");
      } else {
        sky.addColorStop(0, "#5b79a8"); sky.addColorStop(0.5, "#c9a9a6"); sky.addColorStop(0.82, "#f2b583"); sky.addColorStop(1, "#ffd7a1");
      }
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h * 0.5);
      // sun (behind the arch, toward -z which maps to u = 0.25)
      const sx = w * 0.25, sy = h * (evening ? 0.505 : 0.455);
      const sunGlow = g.createRadialGradient(sx, sy, 0, sx, sy, h * (evening ? 0.18 : 0.3));
      sunGlow.addColorStop(0, evening ? "rgba(255,170,120,0.55)" : "rgba(255,248,225,1)");
      sunGlow.addColorStop(0.08, evening ? "rgba(255,140,110,0.35)" : "rgba(255,214,150,0.9)");
      sunGlow.addColorStop(1, "rgba(255,180,120,0)");
      g.fillStyle = sunGlow;
      g.fillRect(0, 0, w, h * 0.5);
      if (evening) {
        for (let i = 0; i < 260; i++) {
          g.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.6})`;
          g.fillRect(rand() * w, rand() * h * 0.3, 1.4, 1.4);
        }
      }
      // distant tree line on the horizon
      g.fillStyle = evening ? "#121522" : "#5d5a63";
      g.beginPath();
      g.moveTo(0, h * 0.5);
      for (let x = 0; x <= w; x += 6) g.lineTo(x, h * (0.5 - 0.012 - Math.abs(Math.sin(x * 0.013) * Math.sin(x * 0.0031)) * 0.03 - rand() * 0.004));
      g.lineTo(w, h * 0.5);
      g.fill();
      g.fillStyle = evening ? "#0d0f17" : "#3d3f3f";
      g.fillRect(0, h * 0.5, w, h * 0.5);
    });
  }
  const STONE = lite ? 512 : 1024;
  const travertine = canvasTex(STONE, STONE, (g, w, h) => {
    g.fillStyle = "#d9cbb4";
    g.fillRect(0, 0, w, h);
    const tile = w / 4;
    for (let i = 0; i < (lite ? 1200 : 4000); i++) {
      g.fillStyle = `rgba(${150 + rand() * 60},${130 + rand() * 50},${100 + rand() * 40},${rand() * 0.12})`;
      g.fillRect(rand() * w, rand() * h, 2 + rand() * 30, 1 + rand() * 3);
    }
    g.strokeStyle = "rgba(120,100,80,0.35)";
    g.lineWidth = 2;
    for (let y = 0; y <= h; y += tile) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let r = 0; r < 4; r++) for (let x = (r % 2) * tile; x <= w; x += tile * 2) { g.beginPath(); g.moveTo(x, r * tile); g.lineTo(x, r * tile + tile); g.stroke(); }
  }, [8, 14]);
  const LEAF = lite ? 256 : 512;
  const leafTex = canvasTex(LEAF, LEAF, (g, w, h) => {
    g.fillStyle = "#2c4630";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < (lite ? 2300 : 9000); i++) {
      const s = (2 + rand() * 7) * (w / 512), l = 16 + rand() * 22;
      g.fillStyle = `hsl(${95 + rand() * 30},${18 + rand() * 18}%,${l}%)`;
      g.beginPath();
      g.ellipse(rand() * w, rand() * h, s, s * 0.55, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }, [4, 1]);
  // The aisle runner: ivory linen with burgundy borders and a fine gold line.
  const runnerTex = canvasTex(128, 1024, (g, w, h) => {
    g.fillStyle = "#ddd0bb";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(150,120,90,${rand() * 0.06})`; g.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1); }
    g.fillStyle = "#6d1f2f";
    g.fillRect(6, 0, 9, h);
    g.fillRect(w - 15, 0, 9, h);
    g.fillStyle = "#deba7e";
    g.fillRect(20, 0, 2, h);
    g.fillRect(w - 22, 0, 2, h);
  }, [1, 4]);
  // A printed photo: the image cover-cropped around focusX, with a caption over a soft shade.
  // A video shows its poster frame with a play mark.
  function photoTex({ src, caption, video, focusX = 0.5 }: GardenPhoto) {
    const w = lite ? 640 : 1024, h = lite ? 800 : 1280, img = new Image();
    const draw = (g: CanvasRenderingContext2D) => {
      g.fillStyle = "#3a2e2a";
      g.fillRect(0, 0, w, h);
      if (img.complete && img.naturalWidth) {
        const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        g.drawImage(img, Math.min(0, Math.max(w - dw, w / 2 - dw * focusX)), (h - dh) / 2, dw, dh);
      }
      const shade = g.createLinearGradient(0, h * 0.72, 0, h);
      shade.addColorStop(0, "rgba(20,14,12,0)");
      shade.addColorStop(1, "rgba(20,14,12,0.6)");
      g.fillStyle = shade;
      g.fillRect(0, h * 0.72, w, h * 0.28);
      if (video) {
        const r = 84 * (w / 1024), cx = w / 2, cy = h * 0.45;
        g.fillStyle = "rgba(20,14,12,0.42)";
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 5 * (w / 1024); g.stroke();
        g.fillStyle = "rgba(255,255,255,0.94)";
        g.beginPath(); g.moveTo(cx - r * 0.3, cy - r * 0.45); g.lineTo(cx + r * 0.5, cy); g.lineTo(cx - r * 0.3, cy + r * 0.45); g.fill();
      }
      g.fillStyle = "rgba(255,255,255,0.94)";
      // Long captions shrink to stay inside the frame.
      const pad = 56 * (w / 1024);
      g.font = display(60 * (w / 1024), "italic");
      const fit = Math.min(1, (w - pad * 2) / g.measureText(caption).width);
      g.font = display(60 * (w / 1024) * fit, "italic");
      g.fillText(caption, pad, h - 64 * (w / 1024));
    };
    const tex = canvasTex(w, h, draw);
    const redraw = () => {
      draw((tex.image as HTMLCanvasElement).getContext("2d")!);
      tex.needsUpdate = true;
    };
    img.onload = () => { redraw(); dirty = true; };
    img.src = src;
    redraws.push(redraw);
    return tex;
  }
  const cardTex = letteredTex(720, 1040, (g, w, h) => {
    g.fillStyle = "#f6f0e4";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(160,140,110,${rand() * 0.05})`; g.fillRect(rand() * w, rand() * h, 2, 2); }
    g.strokeStyle = "#b38a43"; g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68); g.lineWidth = 1; g.strokeRect(48, 48, w - 96, h - 96);
    g.textAlign = "center";
    const [roleTop, ...roleRest] = content.ask.role.split(" ");
    g.fillStyle = "#6e523c"; g.font = body(22 * LETTER, 600); g.fillText(`FROM ${content.from.toUpperCase()}, TO HER FF`, w / 2, 210, w - 110);
    g.fillStyle = "#3a2e26"; g.font = display(104, "italic"); g.fillText(`${content.guestName},`, w / 2, 350, w - 110);
    g.fillStyle = "#6d1f2f"; g.font = display(40, "italic"); g.fillText("will you be my", w / 2, 430, w - 110);
    g.fillStyle = "#3a2e26"; g.font = display(84, "italic"); g.fillText(roleTop, w / 2, 530, w - 110);
    g.fillText(`${roleRest.join(" ")}?`, w / 2, 620, w - 110);
    // On phones the card is seen small, so the details are larger, darker and heavier there.
    if (phone) {
      g.fillStyle = "#3a2e26"; g.font = display(42, "600"); g.fillText(content.dateLabel, w / 2, 730, w - 110);
      g.font = display(40, "500"); g.fillText(content.city, w / 2, 790, w - 110);
      g.fillStyle = "#6e523c"; g.font = body(31, 700); g.fillText("FAMILY · FRIENDS · FOREVER", w / 2, 900, w - 110);
    } else {
      g.fillStyle = "#5c4a3d"; g.font = display(30); g.fillText(content.dateLabel, w / 2, 720); g.fillText(content.cardPlace, w / 2, 768, w - 110);
      g.fillStyle = "#6e523c"; g.font = body(20, 600); g.fillText("FAMILY · FRIENDS · FOREVER", w / 2, 890);
    }
  });

  // --- environment and lights ---
  const pmrem = new T.PMREMGenerator(renderer);
  const skies = { golden: skyTexture(false), evening: skyTexture(true) };
  Object.values(skies).forEach((t) => { t.mapping = T.EquirectangularReflectionMapping; });
  const envs = { golden: pmrem.fromEquirectangular(skies.golden).texture, evening: pmrem.fromEquirectangular(skies.evening).texture };
  disposables.push(pmrem, envs.golden, envs.evening);
  scene.background = skies.golden;
  scene.environment = envs.golden;
  const fog = new T.Fog(col("#d9a98a"), 30, 90);
  scene.fog = fog;

  const sun = new T.DirectionalLight(col("#ffc58f"), 3.2);
  sun.position.set(-3, 7, -26);
  sun.castShadow = !lite;
  sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const hemi = new T.HemisphereLight(col("#ffe2c4"), col("#3a3a30"), 0.55);
  scene.add(hemi);

  // --- materials ---
  const M = {
    stone: new T.MeshStandardMaterial({ map: travertine, roughness: 0.62 }),
    plinth: new T.MeshStandardMaterial({ color: col("#e8dcc8"), roughness: 0.5 }),
    hedge: new T.MeshStandardMaterial({ map: leafTex, bumpMap: leafTex, bumpScale: 0.05, roughness: 0.95 }),
    cypress: new T.MeshStandardMaterial({ color: col("#9fb38c"), map: leafTex, bumpMap: leafTex, bumpScale: 0.04, roughness: 1 }),
    grass: new T.MeshStandardMaterial({ color: col("#4f6339"), roughness: 1 }),
    runner: new T.MeshStandardMaterial({ map: runnerTex, roughness: 0.92 }),
    chairWood: new T.MeshStandardMaterial({ color: col("#7a5233"), roughness: 0.62 }),
    cushion: new T.MeshStandardMaterial({ color: col("#efe6d6"), roughness: 0.95 }),
    gold: new T.MeshStandardMaterial({ color: col("#caa25a"), metalness: 1, roughness: 0.28 }),
    iron: new T.MeshStandardMaterial({ color: col("#2b2622"), metalness: 0.7, roughness: 0.45 }),
    bulb: new T.MeshBasicMaterial({ color: new T.Color(3.2, 2.2, 1.1), toneMapped: false }),
    linen: new T.MeshStandardMaterial({ color: col("#cfc6b8"), roughness: 0.95 }),
    wood: new T.MeshStandardMaterial({ color: col("#6b4a33"), roughness: 0.7 }),
    leaf: new T.MeshStandardMaterial({ color: col("#3c5a3a"), roughness: 0.8, side: T.DoubleSide }),
    petal: new T.MeshStandardMaterial({ roughness: 0.62, side: T.DoubleSide }),
    card: printMaterial(cardTex, { roughness: 0.85, color: col("#eee8dc") }),
    sealRed: new T.MeshStandardMaterial({ color: col("#6d1f2f"), roughness: 0.35 }),
  };
  const mesh = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material | THREE.Material[],
    pos?: Vec3,
    opts: { rot?: Vec3; scale?: Vec3; cast?: boolean; receive?: boolean } = {},
  ) => {
    const m = new T.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (opts.rot) m.rotation.set(...opts.rot);
    if (opts.scale) m.scale.set(...opts.scale);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = opts.receive !== false;
    scene.add(m);
    return m;
  };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: Vec3, rot?: Vec3) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // --- ground, terrace, the dais under the arbour and the aisle runner ---
  mesh(new T.PlaneGeometry(200, 200), M.grass, [0, -0.02, 0], { rot: [-Math.PI / 2, 0, 0], cast: false });
  mesh(new T.PlaneGeometry(12, 22), M.stone, [0, 0, 1.5], { rot: [-Math.PI / 2, 0, 0], cast: false });
  mesh(new T.BoxGeometry(6.2, 0.12, 1.8), M.plinth, [0, 0.06, GATE.z + 0.1]);
  mesh(new T.PlaneGeometry(1.1, 15.2), M.runner, [0, 0.008, 1.0], { rot: [-Math.PI / 2, 0, 0], cast: false });

  // --- hedges and cypress ---
  [-5.4, 5.4].forEach((x) => mesh(new T.BoxGeometry(0.9, 2.4, 20), M.hedge, [x, 1.2, 1.5]));
  mesh(new T.BoxGeometry(11.7, 2.4, 0.9), M.hedge, [0, 1.2, -8.9]);
  const cypressGeo = new T.LatheGeometry([0, 0.35, 0.55, 0.6, 0.52, 0.35, 0.12, 0].map((r, i) => new T.Vector2(r, i * 0.78)), 20);
  for (let i = 0; i < 9; i++) {
    [-6.4, 6.4].forEach((x) => {
      const s = 0.9 + rand() * 0.35;
      mesh(cypressGeo, M.cypress, [x, 0, -8 + i * 2.6], { scale: [s, s * (1.1 + rand() * 0.3), s] });
    });
  }
  [-4.2, -2.6, 2.6, 4.2].forEach((x) => mesh(cypressGeo, M.cypress, [x, 0, -10.3], { scale: [1.1, 1.55, 1.1] }));

  // --- the floral arbour: square pillars and a beam, flowers cascading from one corner ---
  [-1, 1].forEach((side) => mesh(new T.BoxGeometry(0.32, ARBOUR_TOP, 0.32), M.plinth, [side * ARBOUR_HALF, ARBOUR_TOP / 2 + 0.12, GATE.z]));
  mesh(new T.BoxGeometry(ARBOUR_HALF * 2 + 0.7, 0.3, 0.4), M.plinth, [0, ARBOUR_TOP + 0.12, GATE.z]);
  const ROSE_N = lite ? 320 : phone ? 560 : 1050;
  const cupGeo = new T.LatheGeometry([[0.0, 0], [0.05, 0.004], [0.085, 0.03], [0.1, 0.065], [0.095, 0.095]].map(([x, y]) => new T.Vector2(x, y)), 12);
  cupGeo.rotateX(Math.PI / 2);
  const budGeo = new T.SphereGeometry(0.08, 12, 10);
  budGeo.scale(1, 1, 0.8);
  budGeo.translate(0, 0, 0.05);
  const leafGeo = new T.SphereGeometry(1, 8, 6);
  leafGeo.scale(0.11, 0.022, 0.06);
  const roseCups = new T.InstancedMesh(cupGeo, M.petal, ROSE_N);
  const roseBuds = new T.InstancedMesh(budGeo, M.petal, ROSE_N);
  const leaves = new T.InstancedMesh(leafGeo, M.leaf, ROSE_N);
  [roseCups, roseBuds, leaves].forEach((m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  // Ivory, blush, burnt orange, burgundy and champagne: the wedding's colours.
  const palette: [string, number][] = [["#f4ede2", 0.34], ["#e9c1b6", 0.26], ["#b8623a", 0.18], ["#6d1f2f", 0.12], ["#deba7e", 0.1]];
  const pickColor = () => {
    let r = rand();
    for (const [c, w] of palette) if ((r -= w) <= 0) return c;
    return palette[0][0];
  };
  const dummy = new T.Object3D(), tint = new T.Color();
  for (let i = 0; i < ROSE_N; i++) {
    let x: number, y: number, z: number;
    const top = ARBOUR_TOP + 0.12;
    if (i < ROSE_N * 0.62) {
      // The main cascade: thick at the top-left corner, thinning along the beam and down the pillar.
      const t = Math.pow(rand(), 1.7) * 4.4;
      if (rand() < 0.55) { x = -ARBOUR_HALF + t; y = top; } else { x = -ARBOUR_HALF; y = top - t * 0.85; }
      x += (rand() - 0.5) * 0.7;
      y += (rand() - 0.5) * 0.6;
      z = GATE.z + 0.1 + (rand() - 0.5) * 0.6;
    } else if (i < ROSE_N * 0.86) {
      // A smaller answering cluster climbing the right pillar.
      const t = Math.pow(rand(), 1.4) * 2.4;
      x = ARBOUR_HALF + (rand() - 0.5) * 0.6;
      y = 0.35 + t + (rand() - 0.5) * 0.4;
      z = GATE.z + 0.1 + (rand() - 0.5) * 0.6;
    } else {
      // blooms spilling onto the dais at the foot of both pillars
      const side = rand() < 0.3 ? -1 : 1;
      x = side * (ARBOUR_HALF - 0.6 + rand() * 1.3);
      y = 0.2 + rand() * 0.45;
      z = GATE.z + 0.3 + rand() * 0.6;
    }
    const s = 0.75 + rand() * 0.55;
    dummy.position.set(x, y, z);
    dummy.lookAt(x + (rand() - 0.5) * 1.6, y + (rand() - 0.3) * 1.4, z + 2);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    roseCups.setMatrixAt(i, dummy.matrix);
    roseBuds.setMatrixAt(i, dummy.matrix);
    const c = pickColor();
    roseCups.setColorAt(i, tint.set(c).convertSRGBToLinear());
    roseBuds.setColorAt(i, tint.set(c).convertSRGBToLinear().multiplyScalar(0.82));
    dummy.position.set(x + (rand() - 0.5) * 0.3, y + (rand() - 0.5) * 0.3, z - 0.08 - rand() * 0.15);
    dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    dummy.scale.setScalar(0.8 + rand() * 0.6);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
  }

  // --- guest chairs: cross-back chairs in rows down both sides of the aisle, facing the arbour ---
  // One merged chair, instanced: every chair together is two draw calls.
  const chairParts: THREE.BufferGeometry[] = [];
  const part = (geo: THREE.BufferGeometry, pos: Vec3, rotZ = 0) => {
    geo.rotateZ(rotZ);
    geo.translate(...pos);
    chairParts.push(geo);
  };
  part(new T.BoxGeometry(0.44, 0.05, 0.42), [0, 0.46, 0]);
  for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18]]) part(new T.CylinderGeometry(0.016, 0.014, 0.46, 6), [lx, 0.23, lz]);
  for (const lx of [-0.19, 0.19]) part(new T.BoxGeometry(0.032, 1.02, 0.032), [lx, 0.51, 0.19]);
  for (const tilt of [0.72, -0.72]) part(new T.BoxGeometry(0.026, 0.5, 0.014), [0, 0.74, 0.19], tilt);
  part(new T.BoxGeometry(0.42, 0.05, 0.034), [0, 1.0, 0.19]);
  part(new T.BoxGeometry(0.42, 0.03, 0.026), [0, 0.52, 0.19]);
  const chairGeo = mergeBufferGeometries(chairParts)!;
  chairParts.forEach((g) => g.dispose());
  const cushionGeo = new T.BoxGeometry(0.4, 0.035, 0.38);
  cushionGeo.translate(0, 0.5, -0.01);
  const SEATS_X = [0.95, 1.5, 2.05], ROWS = 13, ROW_START = -4.4;
  const CHAIRS = SEATS_X.length * 2 * ROWS;
  const chairs = new T.InstancedMesh(chairGeo, M.chairWood, CHAIRS);
  const cushions = new T.InstancedMesh(cushionGeo, M.cushion, CHAIRS);
  [chairs, cushions].forEach((m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  // Posies tied to the aisle end of every other row.
  const POSY_BLOOMS = 7, posyRows = Math.ceil(ROWS / 2);
  const aisleBlooms = new T.InstancedMesh(cupGeo, M.petal, posyRows * 2 * POSY_BLOOMS);
  const aisleLeaves = new T.InstancedMesh(leafGeo, M.leaf, posyRows * 2 * POSY_BLOOMS);
  [aisleBlooms, aisleLeaves].forEach((m) => { m.castShadow = true; scene.add(m); });
  let chairN = 0, bloomN = 0;
  for (let row = 0; row < ROWS; row++) {
    const z = ROW_START + row;
    for (const side of [-1, 1]) {
      for (const sx of SEATS_X) {
        dummy.position.set(side * sx, 0, z);
        dummy.rotation.set(0, (rand() - 0.5) * 0.06, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        chairs.setMatrixAt(chairN, dummy.matrix);
        cushions.setMatrixAt(chairN++, dummy.matrix);
      }
      if (row % 2) continue;
      for (let b = 0; b < POSY_BLOOMS; b++) {
        const x = side * (SEATS_X[0] - 0.25) + (rand() - 0.5) * 0.12, y = 0.86 + (rand() - 0.5) * 0.16, bz = z + 0.2 + (rand() - 0.5) * 0.12;
        dummy.position.set(x, y, bz);
        dummy.lookAt(x - side * 2, y + (rand() - 0.2), bz + (rand() - 0.5));
        dummy.scale.setScalar(0.55 + rand() * 0.25);
        dummy.updateMatrix();
        aisleBlooms.setMatrixAt(bloomN, dummy.matrix);
        aisleBlooms.setColorAt(bloomN, tint.set(pickColor()).convertSRGBToLinear());
        dummy.position.set(x + (rand() - 0.5) * 0.1, y - 0.06, bz + (rand() - 0.5) * 0.1);
        dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6);
        dummy.scale.setScalar(0.7);
        dummy.updateMatrix();
        aisleLeaves.setMatrixAt(bloomN++, dummy.matrix);
      }
    }
  }

  // --- string lights: festoon bulbs zigzagging over the aisle between poles ---
  const POLE_Z = [-5.4, -1.4, 2.8, 7.4], POLE_X = 2.75, POLE_H = 3.1;
  POLE_Z.forEach((z) => [-1, 1].forEach((side) => mesh(new T.CylinderGeometry(0.035, 0.045, POLE_H, 8), M.iron, [side * POLE_X, POLE_H / 2, z])));
  const strands: [THREE.Vector3, THREE.Vector3][] = [];
  POLE_Z.forEach((z, k) => {
    const left = new T.Vector3(-POLE_X, POLE_H - 0.08, z), right = new T.Vector3(POLE_X, POLE_H - 0.08, z);
    strands.push([left, right]);
    if (k < POLE_Z.length - 1) strands.push([right, new T.Vector3(-POLE_X, POLE_H - 0.08, POLE_Z[k + 1])]);
  });
  const bulbSpots: THREE.Vector3[] = [];
  strands.forEach(([a, b]) => {
    // Each strand sags in the middle; bulbs hang at even spacing along it.
    const at = (t: number) => new T.Vector3().lerpVectors(a, b, t).setY(a.y - 0.55 * 4 * t * (1 - t));
    const wire = new T.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => at(i / 12)));
    mesh(new T.TubeGeometry(wire, 24, 0.006, 4), M.iron, undefined, { cast: false, receive: false });
    const count = Math.round(a.distanceTo(b) / 0.42);
    for (let i = 1; i < count; i++) bulbSpots.push(at(i / count).setY(at(i / count).y - 0.07));
  });
  const bulbs = new T.InstancedMesh(new T.SphereGeometry(0.026, 10, 8), M.bulb, bulbSpots.length);
  bulbSpots.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1.25, 1);
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
  });
  scene.add(bulbs);
  // Every point light is paid for on every pixel of every lit surface, so phones keep two and the
  // light scene none (the bulbs still glow).
  const glowSpots: [number, number][] = phone ? [[0, 0.6], [0, 5.2]] : [[-1.4, 0.6], [1.4, 0.6], [-1.4, 5.2], [1.4, 5.2]];
  const glowLights = glowSpots.map(([x, z]) => {
    const l = new T.PointLight(col("#ffc27a"), 0.6, 7, 2);
    l.position.set(x, 2.5, z);
    if (!lite) scene.add(l);
    return l;
  });

  // Chapters live in the garden: stories and pictures on the left, everything else on the right.
  // Each station's meshes carry their chapter id, so a click on them flies there.
  const stations: THREE.Object3D[] = [];
  const station = (obj: THREE.Object3D, id: ChapterId) => {
    obj.traverse((o) => { o.userData.chapter = id; });
    stations.push(obj);
    return obj;
  };

  // --- The question: the table with the invitation card ---
  const TABLE = new T.Vector3(3.5, 0, 4.3);
  const tableTop = mesh(new T.LatheGeometry([[0, 0.76], [0.56, 0.76], [0.6, 0.72], [0.64, 0.4], [0.7, 0.02], [0, 0.02]].map(([x, y]) => new T.Vector2(x, y)), 40), M.linen, [TABLE.x, 0, TABLE.z]);
  const card = mesh(new T.BoxGeometry(0.34, 0.49, 0.006), [M.linen, M.linen, M.linen, M.linen, M.card, M.linen], [TABLE.x - 0.05, 1.0, TABLE.z + 0.05]);
  card.rotation.order = "YXZ";
  card.rotation.set(-0.18, -0.95, 0);
  station(tableTop, "ask");
  station(card, "ask");
  mesh(new T.CylinderGeometry(0.03, 0.03, 0.008, 24), M.sealRed, [TABLE.x + 0.12, 0.77, TABLE.z + 0.2]);
  const tableLight = new T.PointLight(col("#ffc27a"), 0.5, 3.5, 2);
  tableLight.position.set(TABLE.x - 0.3, 1.9, TABLE.z + 0.2);
  if (!lite) scene.add(tableLight);
  // a small posy on the table
  const posy = new T.Group();
  posy.position.set(TABLE.x + 0.25, 0.8, TABLE.z - 0.22);
  scene.add(posy);
  for (let i = 0; i < 9; i++) {
    const m = new T.Mesh(cupGeo, new T.MeshStandardMaterial({ roughness: 0.62, side: T.DoubleSide, color: col(pickColor()) }));
    m.position.set((rand() - 0.5) * 0.14, rand() * 0.08, (rand() - 0.5) * 0.14);
    m.lookAt(m.position.x * 4, 1, m.position.z * 4 + 0.5);
    m.scale.setScalar(0.8);
    m.castShadow = true;
    posy.add(m);
  }

  // --- Our story: a portrait on an easel ---
  const easel = new T.Group();
  easel.position.set(-4, 0, 3.6);
  easel.rotation.y = 0.75;
  scene.add(easel);
  add(easel, new T.BoxGeometry(0.04, 1.9, 0.04), M.wood, [-0.32, 0.92, 0], [0.12, 0, -0.06]);
  add(easel, new T.BoxGeometry(0.04, 1.9, 0.04), M.wood, [0.32, 0.92, 0], [0.12, 0, 0.06]);
  add(easel, new T.BoxGeometry(0.04, 1.8, 0.04), M.wood, [0, 0.85, -0.32], [-0.3, 0, 0]);
  add(easel, new T.BoxGeometry(0.86, 0.04, 0.08), M.wood, [0, 0.82, 0.12]);
  add(easel, new T.BoxGeometry(0.8, 1.0, 0.05), M.gold, [0, 1.35, 0.14], [-0.12, 0, 0]);
  add(easel, new T.PlaneGeometry(0.68, 0.86), printMaterial(photoTex(content.story.portrait), { roughness: 0.4 }), [0, 1.35, 0.168], [-0.12, 0, 0]);
  station(easel, "story");

  // --- The days: a painted board for the celebrations ---
  const boardTex = letteredTex(640, 820, (g, w, h) => {
    g.fillStyle = "#502c16"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#deba7e"; g.lineWidth = 6; g.strokeRect(26, 26, w - 52, h - 52); g.lineWidth = 2; g.strokeRect(42, 42, w - 84, h - 84);
    g.textAlign = "center";
    g.fillStyle = "#ead3a0"; g.font = display(66 * LETTER, "italic"); g.fillText("The days", w / 2, 150 + 10 * LETTER);
    content.gathering.items.slice(0, 3).forEach((item, i) => {
      const y = 300 + i * (phone ? 178 : 165);
      g.fillStyle = "#deba7e"; g.font = body(27 * LETTER, 700); g.fillText(item.boardWhen.toUpperCase(), w / 2, y, w - 100);
      g.fillStyle = "#fbf5ea"; g.font = display(50 * LETTER, "500"); g.fillText(item.boardName, w / 2, y + 60 * LETTER, w - 100);
    });
  });
  const board = new T.Group();
  board.position.set(3.95, 0, -0.7);
  board.rotation.y = -1.05;
  scene.add(board);
  add(board, new T.BoxGeometry(0.05, 1.75, 0.05), M.wood, [-0.44, 0.87, -0.04]);
  add(board, new T.BoxGeometry(0.05, 1.75, 0.05), M.wood, [0.44, 0.87, -0.04]);
  add(board, new T.BoxGeometry(0.98, 1.24, 0.05), M.wood, [0, 1.34, 0]);
  add(board, new T.PlaneGeometry(0.9, 1.16), printMaterial(boardTex, { roughness: 0.85 }), [0, 1.34, 0.027]);
  station(board, "days");

  // --- Memories: a photo wall on the left hedge ---
  content.wall.slice(0, 3).forEach((wallPhoto, i) => {
    const y = i === 1 ? 1.5 : 1.7, z = [-2.3, -0.6, 1.1][i];
    station(mesh(new T.BoxGeometry(0.05, 0.92, 0.74), M.gold, [-4.92, y, z]), "memories");
    station(mesh(new T.PlaneGeometry(0.62, 0.8), printMaterial(photoTex(wallPhoto), { roughness: 0.45 }), [-4.89, y, z], { rot: [0, Math.PI / 2, 0], cast: false }), "memories");
  });

  // --- petals: drifting in the air and scattered down the aisle runner ---
  const petalGeo = new T.CircleGeometry(0.03, 8);
  petalGeo.scale(1, 0.7, 1);
  const AIR = reduceMotion ? 0 : phone ? 40 : 140, STREWN = lite ? 50 : phone ? 80 : 140;
  const airPetals = new T.InstancedMesh(petalGeo, M.petal, Math.max(AIR, 1));
  const strewnPetals = new T.InstancedMesh(petalGeo, M.petal, STREWN);
  airPetals.visible = AIR > 0;
  strewnPetals.receiveShadow = true;
  scene.add(airPetals, strewnPetals);
  const air = Array.from({ length: AIR }, () => ({ x: (rand() - 0.5) * 9, y: rand() * 6, z: -8 + rand() * 17, s: 0.4 + rand() * 0.6, r: rand() * 6, w: 0.2 + rand() * 0.5 }));
  [airPetals, strewnPetals].forEach((m) => {
    for (let i = 0; i < m.count; i++) m.setColorAt(i, tint.set(["#f4ede2", "#e9c1b6", "#6d1f2f", "#deba7e"][i % 4]).convertSRGBToLinear());
  });
  // The strewn petals never move, so they are placed once.
  for (let i = 0; i < STREWN; i++) {
    dummy.position.set((rand() - 0.5) * 0.95, 0.014, -6.4 + rand() * 14.8);
    dummy.rotation.set(-Math.PI / 2, 0, rand() * 6);
    dummy.scale.setScalar(0.8 + rand() * 0.6);
    dummy.updateMatrix();
    strewnPetals.setMatrixAt(i, dummy.matrix);
  }

  // --- draw calls: merge the static scenery ---
  // Poles, wires, the arbour, hedges and trees are dozens of small meshes that never move. Merged
  // per material they become a handful of draw calls. Stations (clickable) stay separate.
  scene.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  for (const o of [...scene.children]) {
    if (!(o instanceof T.Mesh) || o instanceof T.InstancedMesh || Array.isArray(o.material)) continue;
    if (o.userData.chapter) continue;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const merged = mergeBufferGeometries(meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld)));
    if (!merged) continue;
    const one = new T.Mesh(merged, meshes[0].material);
    one.castShadow = meshes[0].castShadow;
    one.receiveShadow = meshes[0].receiveShadow;
    meshes.forEach((m) => { scene.remove(m); disposables.push(m.geometry); });
    scene.add(one);
  }

  // --- post-processing: bloom, then tone map + grade + vignette ---
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: !phone && renderer.capabilities.isWebGL2 ? 4 : 0 });
  const composer = new EffectComposer(renderer, target);
  // A composer built on a custom target defaults to 1x, which blurs everything on high-density screens.
  composer.setPixelRatio(DPR);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(256, 256), 0.55, 0.6, 0.92);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 }, time: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure; uniform float time; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
      void main(){
        vec3 c = aces(texture2D(tDiffuse, vUv).rgb * exposure);
        c = pow(c, vec3(1.0/2.2));
        c *= mix(1.0, smoothstep(0.95, 0.25, length(vUv - 0.5)), 0.38);
        c += (hash(vUv * 900.0) - 0.5) * 0.01;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);

  // --- time of day ---
  type Look = { sun: number; sunColor: string; hemi: number; exposure: number; fog: string; lamp: number; bulb: number };
  const LOOKS: Record<TimeOfDay, Look> = {
    golden: { sun: 3.2, sunColor: "#ffc58f", hemi: 0.55, exposure: 1.0, fog: "#d9a98a", lamp: 0.6, bulb: 0.5 },
    evening: { sun: 0.35, sunColor: "#c98aa0", hemi: 0.22, exposure: 1.25, fog: "#262a40", lamp: 2.2, bulb: 1.6 },
  };
  let look: Look = { ...LOOKS.golden }, lookFrom: Look | null = null, lookTo: Look | null = null, lookT = 1;
  function applyLook() {
    const goal = lookTo && lookT > 0.5 ? lookTo : lookFrom || LOOKS.golden;
    sun.intensity = look.sun;
    sun.color.set(goal.sunColor).convertSRGBToLinear();
    hemi.intensity = look.hemi;
    grade.uniforms.exposure.value = look.exposure;
    renderer.toneMappingExposure = look.exposure;
    fog.color.set(goal.fog).convertSRGBToLinear();
    // String lights shine steadily, unlike candles.
    glowLights.forEach((l) => { l.intensity = look.lamp; });
    tableLight.intensity = look.lamp * 0.8;
    M.bulb.color.setRGB(3.2 * look.bulb, 2.2 * look.bulb, 1.1 * look.bulb);
  }

  // --- camera flight ---
  const camPos = new T.Vector3(...INTRO[0]), camLook = new T.Vector3(...INTRO[1]);
  let from: { p: THREE.Vector3; l: THREE.Vector3 } | null = null;
  let to: { p: THREE.Vector3; l: THREE.Vector3 } | null = null;
  let flightT = 1;
  // Flights run on real time, and phones take a shorter path.
  const FLIGHT = phone ? 1.7 : 2.6;
  const shotFor = (chapter: ChapterId) => (phone ? PLACES[chapter].phone : PLACES[chapter].desk);
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pointer = new T.Vector2();
  const onPointer = (e: PointerEvent) => pointer.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
  window.addEventListener("pointermove", onPointer);

  const ray = new T.Raycaster(), ndc = new T.Vector2(), proj = new T.Vector3();
  let shift = 0, shiftTarget = 0;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / (phone ? 4 : 2), h / (phone ? 4 : 2));
    camera.aspect = w / h;
    if (shift) camera.setViewOffset(w, h, 0, shift * h, w, h);
    camera.updateProjectionMatrix();
    dirty = true;
  }
  window.addEventListener("resize", resize);
  resize();

  // Rendering on demand: a frame is drawn when something changed. Full scenes always animate
  // (drifting petals, a gentle camera sway); the light scene holds still between camera moves, so
  // a phone that is only being read stays cool. Behind the envelope nothing renders at all.
  const ambient = () => !lite && !reduceMotion;

  function goLite() {
    lite = true;
    minDpr = 1.25;
    renderer.shadowMap.enabled = false;
    [...glowLights, tableLight].forEach((l) => scene.remove(l));
    airPetals.visible = false;
    scene.traverse((o) => {
      if (o instanceof T.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
    });
    dirty = true;
  }

  const clock = new T.Clock();
  let frames = 0, raf = 0;
  // Frame-time sampling for the phone quality step-down.
  let sampleStart = 0, sampleFrames = 0;
  function adaptQuality(now: number) {
    // Only measured while frames are actually being drawn continuously.
    if (!phone || frames < 30 || (lite && DPR <= minDpr)) return;
    if (!sampleFrames) sampleStart = now;
    if (++sampleFrames < 45) return;
    const average = (now - sampleStart) / (sampleFrames - 1);
    sampleFrames = 0;
    if (average < 24) return;
    if (DPR <= minDpr) {
      goLite();
      return;
    }
    DPR = Math.max(minDpr, DPR - 0.25);
    renderer.setPixelRatio(DPR);
    composer.setPixelRatio(DPR);
    resize();
    sampleFrames = 0;
  }
  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    if (document.hidden) { sampleFrames = 0; return; }
    const moving = (flightT < 1 && !!to) || shift !== shiftTarget || (lookT < 1 && !!lookTo);
    if (frames >= 3 && !dirty && (!live || (!moving && !ambient()))) {
      sampleFrames = 0;
      clock.getDelta();
      return;
    }
    dirty = false;
    if (live) adaptQuality(now);
    // Real elapsed time (only a long stall, like a hidden tab, is capped), so a slow frame rate
    // can't stretch the camera flight.
    const dt = Math.min(clock.getDelta(), 0.25), t = clock.elapsedTime;

    if (flightT < 1 && from && to) {
      flightT = Math.min(1, flightT + dt / FLIGHT);
      const k = ease(flightT);
      camPos.lerpVectors(from.p, to.p, k);
      camPos.y += Math.sin(k * Math.PI) * 0.6; // a gentle lift mid-flight
      camLook.lerpVectors(from.l, to.l, k);
    }
    const sway = ambient() ? 1 : 0;
    camera.position.set(
      camPos.x + pointer.x * 0.25 * sway + Math.sin(t * 0.3) * 0.03 * sway,
      camPos.y - pointer.y * 0.12 * sway + Math.sin(t * 0.41) * 0.02 * sway,
      camPos.z,
    );
    camera.lookAt(camLook);
    if (shift !== shiftTarget) {
      shift = Math.abs(shiftTarget - shift) < 0.001 ? shiftTarget : shift + (shiftTarget - shift) * Math.min(1, dt * 3);
      const w = window.innerWidth, h = window.innerHeight;
      if (shift) camera.setViewOffset(w, h, 0, shift * h, w, h);
      else camera.clearViewOffset();
    }
    camera.updateMatrixWorld();
    onFrame();

    if (lookT < 1 && lookFrom && lookTo) {
      lookT = Math.min(1, lookT + dt / 1.6);
      const a = lookFrom, b = lookTo;
      look = { ...look, sun: a.sun + (b.sun - a.sun) * lookT, hemi: a.hemi + (b.hemi - a.hemi) * lookT, exposure: a.exposure + (b.exposure - a.exposure) * lookT, lamp: a.lamp + (b.lamp - a.lamp) * lookT, bulb: a.bulb + (b.bulb - a.bulb) * lookT };
    }
    applyLook();

    // petals
    for (let i = 0; i < (airPetals.visible ? AIR : 0); i++) {
      const a = air[i];
      a.y -= dt * a.w * 0.35;
      a.x += Math.sin(t * 0.7 + i) * dt * 0.12;
      a.r += dt * a.w * 2;
      if (a.y < 0.05) { a.y = 5 + rand() * 1.5; a.x = (rand() - 0.5) * 9; }
      dummy.position.set(a.x, a.y, a.z);
      dummy.rotation.set(a.r, a.r * 0.7, a.r * 0.3);
      dummy.scale.setScalar(a.s);
      dummy.updateMatrix();
      airPetals.setMatrixAt(i, dummy.matrix);
    }
    if (AIR && airPetals.visible) airPetals.instanceMatrix.needsUpdate = true;

    grade.uniforms.time.value = t % 10;
    try {
      if (phone) renderer.render(scene, camera);
      else composer.render();
    } catch {
      cancelAnimationFrame(raf);
      onError();
      return;
    }
    if (++frames === 3) onReady();
  }
  // Lettering and captions use the web fonts: redraw once they arrive.
  let alive = true;
  document.fonts?.ready.then(() => { if (alive) { redraws.forEach((r) => r()); dirty = true; } });
  raf = requestAnimationFrame(tick);

  return {
    flyTo(chapter) {
      const [p, l] = shotFor(chapter);
      from = { p: camPos.clone(), l: camLook.clone() };
      to = { p: new T.Vector3(...p), l: new T.Vector3(...l) };
      flightT = reduceMotion ? 1 : 0;
      if (reduceMotion) { camPos.copy(to.p); camLook.copy(to.l); }
      dirty = true;
    },
    jumpTo(chapter) {
      const [p, l] = shotFor(chapter);
      camPos.set(...p);
      camLook.set(...l);
      flightT = 1;
      dirty = true;
    },
    setTime(time) {
      scene.background = skies[time];
      scene.environment = envs[time];
      lookFrom = { ...look };
      lookTo = LOOKS[time];
      lookT = reduceMotion ? 1 : 0;
      if (reduceMotion) look = { ...LOOKS[time] };
      dirty = true;
    },
    setFrameShift(fraction) {
      shiftTarget = fraction;
      if (reduceMotion) shift = fraction - 1e-9;
      dirty = true;
    },
    project(point) {
      proj.set(...point).project(camera);
      return { x: ((proj.x + 1) / 2) * window.innerWidth, y: ((1 - proj.y) / 2) * window.innerHeight, behind: proj.z > 1 };
    },
    projectArch() {
      proj.copy(GATE).project(camera);
      return { x: ((proj.x + 1) / 2) * window.innerWidth, y: ((1 - proj.y) / 2) * window.innerHeight };
    },
    pick(x, y) {
      ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(stations, true)[0];
      return hit ? (hit.object.userData.chapter as ChapterId) : null;
    },
    flight: () => flightT,
    setLive(next) {
      live = next;
      dirty = true;
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", resize);
      scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      disposables.forEach((d) => d.dispose());
      target.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}

/**
 * Budget phones: little memory, or a GPU family known to struggle with this scene. Chrome on Android
 * reports memory; the GPU name comes from a throwaway context so the real one is created once.
 */
function isLowEndDevice() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined && memory <= 3) return true;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /Mali-(4|T|G(31|51|52|57|68|71|72))|Adreno \(TM\) [2-5]\d\d|PowerVR|SGX|Vivante/i.test(gpu);
  } catch {
    return false;
  }
}
