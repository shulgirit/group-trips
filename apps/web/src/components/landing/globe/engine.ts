import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

/**
 * Together's landing globe — vanilla three.js, no framework.
 *
 * The scene tells the brand story: routes leave from where people live and
 * meet at one brass point, the destination. One "scene" = one destination
 * and its origins; scenes cycle unless motion is reduced.
 *
 * Everything created here is disposed in `destroy()`.
 */

export interface GlobePlace {
  lat: number;
  lng: number;
  /** Label id (origins); the destination uses the scene id */
  id?: string;
}

export interface GlobeScene {
  id: string;
  destination: GlobePlace;
  origins: GlobePlace[];
}

export interface GlobeLabel {
  id: string;
  kind: "destination" | "origin";
  x: number;
  y: number;
  /** 0 hidden → 1 fully shown (facing the camera, route drawn, scene not fading) */
  opacity: number;
}

export interface GlobeOptions {
  canvas: HTMLCanvasElement;
  scenes: GlobeScene[];
  /** Where the planet sits: "end" = beside the text, "below" = rising horizon */
  layout: "end-ltr" | "end-rtl" | "below";
  reducedMotion: boolean;
  hiRes: boolean;
  onLabels?: (labels: GlobeLabel[]) => void;
  /** First time the visitor grabs the globe */
  onInteract?: () => void;
  onReady?: () => void;
}

export interface GlobeHandle {
  setLayout(layout: GlobeOptions["layout"]): void;
  resize(): void;
  setActive(active: boolean): void;
  destroy(): void;
}

const RADIUS = 1;
const SCENE_MS = 9000; // draw + hold per destination
const DRAW_MS = 2200;

// Brand colors (docs/design/direction.md)
const BRASS = new Color("#d8b277");
const ATMOSPHERE = new Color("#6f9fb3");

function toVector(place: GlobePlace, radius = RADIUS): Vector3 {
  const phi = ((90 - place.lat) * Math.PI) / 180;
  const theta = ((place.lng + 180) * Math.PI) / 180;
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** Great-circle arc lifted off the surface in proportion to its length. */
function arcCurve(from: GlobePlace, to: GlobePlace): CatmullRomCurve3 {
  const a = toVector(from);
  const b = toVector(to);
  const angle = a.angleTo(b);
  const lift = 0.05 + Math.min(angle, 1.6) * 0.11;
  const points: Vector3[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // slerp on the unit sphere, then raise
    const sinAngle = Math.sin(angle) || 1;
    const p = a
      .clone()
      .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
      .add(b.clone().multiplyScalar(Math.sin(t * angle) / sinAngle));
    p.normalize().multiplyScalar(RADIUS + Math.sin(Math.PI * t) * lift);
    points.push(p);
  }
  return new CatmullRomCurve3(points);
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDir;
  uniform vec3 cityColor;
  uniform vec3 rimColor;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  vec3 grade(vec3 c) {
    // Art direction: cooler, slightly desaturated, deeper oceans
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 0.78);
    c *= vec3(0.86, 0.95, 1.06);
    c = pow(c, vec3(1.08));
    return min(c, vec3(0.7));
  }

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 day = grade(texture2D(dayMap, vUv).rgb);
    float lights = texture2D(nightMap, vUv).r;

    float sun = dot(n, normalize(sunDir));
    float dayMix = smoothstep(-0.42, 0.12, sun);
    // half-lambert: the face you look at stays bright, the limb keeps depth
    float lit = clamp(0.35 + 0.65 * sun, 0.0, 1.0);

    float water = smoothstep(0.0, 0.1, day.b - max(day.r, day.g) + 0.05) * (1.0 - smoothstep(0.35, 0.6, dot(day, vec3(0.333))));
    vec3 h = normalize(normalize(sunDir) + vViewDir);
    float spec = pow(max(dot(n, h), 0.0), 60.0) * water * 0.45;

    // Deep navy seas instead of black holes
    // Daylit seas: deep blue with depth, never a black hole
    vec3 sea = mix(vec3(0.04, 0.11, 0.22), vec3(0.09, 0.24, 0.38), lit);
    vec3 land = day * (0.25 + 1.05 * lit);
    vec3 dayColor = mix(land, sea + day * 0.35, water * 0.85) + spec * vec3(1.0, 0.93, 0.82) * 1.4;
    vec3 nightColor = day * 0.035 + cityColor * pow(lights, 1.6) * 1.35;
    vec3 color = mix(nightColor, dayColor, dayMix);

    float rim = pow(1.0 - max(dot(vViewDir, n), 0.0), 2.6);
    color += rimColor * rim * (0.12 + 0.4 * dayMix);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vNormalW;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 glowColor;
  uniform vec3 sunDir;
  varying vec3 vNormalV;
  varying vec3 vNormalW;
  void main() {
    float intensity = pow(clamp(0.66 - dot(normalize(vNormalV), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.4);
    float sunSide = 0.45 + 0.55 * smoothstep(-0.5, 0.7, dot(normalize(vNormalW), normalize(sunDir)));
    gl_FragColor = vec4(glowColor * intensity * sunSide * 0.85, 1.0);
  }
`;

const ARC_VERTEX = /* glsl */ `
  varying float vT;
  void main() {
    vT = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_FRAGMENT = /* glsl */ `
  uniform float progress;
  uniform float fade;
  uniform float base;
  uniform float time;
  uniform float offset;
  uniform vec3 color;
  varying float vT;
  void main() {
    if (vT > progress) discard;
    float head = smoothstep(progress - 0.18, progress, vT) * step(progress, 0.999);
    float tail = smoothstep(0.0, 0.25, vT);
    // light that keeps travelling toward the meeting point, forever
    float phase = fract(time * 0.28 + offset);
    float d = vT - phase;
    float pulse = exp(-d * d * 260.0) + 0.6 * exp(-(d + 0.5) * (d + 0.5) * 260.0);
    float alpha = (base * (0.45 + 0.55 * head) * mix(0.5, 1.0, tail) + pulse * 0.85) * fade;
    gl_FragColor = vec4(color * (0.95 + 0.8 * head + 0.9 * pulse), alpha);
  }
`;

const POINT_VERTEX = /* glsl */ `
  attribute float size;
  attribute float glow;
  varying float vGlow;
  varying float vFacing;
  uniform float pixelRatio;
  void main() {
    vGlow = glow;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 normalV = normalize(mat3(modelViewMatrix) * normalize(position));
    vFacing = smoothstep(-0.05, 0.25, dot(normalV, normalize(-mv.xyz)));
    gl_PointSize = size * pixelRatio * (6.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  varying float vGlow;
  varying float vFacing;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.16, 0.1, d);
    float halo = smoothstep(0.5, 0.0, d) * 0.45 * vGlow;
    float a = (core + halo) * vFacing;
    if (a < 0.01) discard;
    gl_FragColor = vec4(color, a);
  }
`;

const STAR_VERTEX = /* glsl */ `
  attribute float twinkle;
  uniform float time;
  uniform float pixelRatio;
  varying float vAlpha;
  void main() {
    vAlpha = 0.25 + 0.35 * (0.5 + 0.5 * sin(time * 0.6 + twinkle * 40.0));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (1.0 + twinkle) * pixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), vAlpha * (1.0 - d * 2.0));
  }
`;

function loadTexture(loader: TextureLoader, url: string): Promise<Texture> {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

/** Longitude/latitude that puts a place facing the camera. */
function facingRotation(place: GlobePlace) {
  return {
    y: -((place.lng + 90) * Math.PI) / 180,
    x: (place.lat * Math.PI) / 180 * 0.55,
  };
}

export async function createGlobe(options: GlobeOptions): Promise<GlobeHandle> {
  const { canvas, scenes } = options;
  let layout = options.layout;
  const reduced = options.reducedMotion;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "default",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  // Sun sits just above-left of the camera: whatever face you turn toward you is in daylight
  const sunDir = new Vector3(-0.35, 0.35, 1).normalize();

  const loader = new TextureLoader();
  const suffix = options.hiRes ? "4k" : "2k";
  const [dayMap, nightMap] = await Promise.all([
    loadTexture(loader, `/globe/earth-day-${suffix}.webp`),
    loadTexture(loader, `/globe/earth-night-${options.hiRes ? "4k" : "2k"}.webp`),
  ]);
  dayMap.colorSpace = SRGBColorSpace;
  dayMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  nightMap.anisotropy = dayMap.anisotropy;

  // Planet
  const globe = new Group();
  scene.add(globe);
  const earthGeometry = new SphereGeometry(RADIUS, 128, 96);
  const earthMaterial = new ShaderMaterial({
    vertexShader: EARTH_VERTEX,
    fragmentShader: EARTH_FRAGMENT,
    uniforms: {
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      sunDir: { value: sunDir },
      cityColor: { value: new Color("#f2c27a") },
      rimColor: { value: ATMOSPHERE },
    },
  });
  globe.add(new Mesh(earthGeometry, earthMaterial));

  // Atmosphere (outside the planet, not rotating with it)
  const atmosphereGeometry = new SphereGeometry(RADIUS * 1.1, 96, 64);
  const atmosphereMaterial = new ShaderMaterial({
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    uniforms: { glowColor: { value: ATMOSPHERE }, sunDir: { value: sunDir } },
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const atmosphere = new Mesh(atmosphereGeometry, atmosphereMaterial);
  scene.add(atmosphere);

  // Stars — sparse, far, barely moving
  const starCount = 900;
  const starPositions = new Float32Array(starCount * 3);
  const starTwinkle = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const v = new Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20);
    starPositions.set([v.x, v.y, v.z], i * 3);
    starTwinkle[i] = Math.random();
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute("position", new BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("twinkle", new BufferAttribute(starTwinkle, 1));
  const starMaterial = new ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    uniforms: { time: { value: 0 }, pixelRatio: { value: pixelRatio } },
    transparent: true,
    depthWrite: false,
  });
  const stars = new Points(starGeometry, starMaterial);
  scene.add(stars);

  // Per-scene objects (arcs + points), rebuilt when the destination changes
  const routeGroup = new Group();
  globe.add(routeGroup);
  let arcs: { mesh: Mesh; material: ShaderMaterial; delay: number }[] = [];
  let points: Points | null = null;
  let pointMaterial: ShaderMaterial | null = null;

  // A faint, always-flowing network of every scene's routes, so wherever the
  // visitor spins the planet there are routes alive on it
  const ambientGroup = new Group();
  globe.add(ambientGroup);
  const ambient: { sceneIndex: number; mesh: Mesh; material: ShaderMaterial }[] = [];
  scenes.forEach((sceneItem, sceneIdx) => {
    sceneItem.origins.forEach((origin, i) => {
      const geometry = new TubeGeometry(arcCurve(origin, sceneItem.destination), 96, 0.0042, 6, false);
      const material = new ShaderMaterial({
        vertexShader: ARC_VERTEX,
        fragmentShader: ARC_FRAGMENT,
        uniforms: {
          progress: { value: 1 },
          fade: { value: 0.55 },
          base: { value: 0.28 },
          time: { value: 0 },
          offset: { value: (sceneIdx * 0.37 + i * 0.19) % 1 },
          color: { value: BRASS },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(geometry, material);
      ambientGroup.add(mesh);
      ambient.push({ sceneIndex: sceneIdx, mesh, material });
    });
  });
  const showAmbientFor = (active: number) => {
    for (const item of ambient) item.mesh.visible = item.sceneIndex !== active;
  };

  function clearRoutes() {
    for (const arc of arcs) {
      arc.mesh.geometry.dispose();
      arc.material.dispose();
    }
    arcs = [];
    if (points) {
      points.geometry.dispose();
      pointMaterial?.dispose();
      routeGroup.remove(points);
      points = null;
    }
    routeGroup.clear();
  }

  function buildRoutes(index: number) {
    clearRoutes();
    showAmbientFor(index);
    const current = scenes[index];
    current.origins.forEach((origin, i) => {
      const curve = arcCurve(origin, current.destination);
      const geometry = new TubeGeometry(curve, 120, 0.0062, 8, false);
      const material = new ShaderMaterial({
        vertexShader: ARC_VERTEX,
        fragmentShader: ARC_FRAGMENT,
        uniforms: {
          progress: { value: reduced ? 1 : 0 },
          fade: { value: 1 },
          base: { value: 1 },
          time: { value: 0 },
          offset: { value: i * 0.23 },
          color: { value: BRASS },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(geometry, material);
      routeGroup.add(mesh);
      arcs.push({ mesh, material, delay: i * 160 });
    });

    const all = [...current.origins, current.destination];
    const positions = new Float32Array(all.length * 3);
    const sizes = new Float32Array(all.length);
    const glows = new Float32Array(all.length);
    all.forEach((place, i) => {
      const v = toVector(place, RADIUS * 1.003);
      positions.set([v.x, v.y, v.z], i * 3);
      const isDestination = i === all.length - 1;
      sizes[i] = isDestination ? 22 : 9;
      glows[i] = isDestination ? 1 : 0.4;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("size", new BufferAttribute(sizes, 1));
    geometry.setAttribute("glow", new BufferAttribute(glows, 1));
    pointMaterial = new ShaderMaterial({
      vertexShader: POINT_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      uniforms: { color: { value: BRASS }, pixelRatio: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    points = new Points(geometry, pointMaterial);
    routeGroup.add(points);
  }

  // Composition per layout: where the planet sits in the frame
  function frame() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    if (layout === "below") {
      // The whole planet, fitted to its own frame under the text
      camera.clearViewOffset();
      const tan = Math.tan(((camera.fov * Math.PI) / 180) / 2);
      const span = Math.min(1, camera.aspect);
      camera.position.set(0, 0, (RADIUS * 1.16) / (0.92 * tan * span));
      globe.scale.setScalar(1);
      atmosphere.scale.setScalar(1);
    } else {
      camera.position.set(0, 0, 5.2);
      const shift = layout === "end-ltr" ? -0.24 : 0.24;
      camera.setViewOffset(width, height, width * shift, height * -0.06, width, height);
      globe.scale.setScalar(1);
      atmosphere.scale.setScalar(1);
    }
    camera.updateProjectionMatrix();
  }
  frame();

  let sceneIndex = 0;
  buildRoutes(sceneIndex);
  const start = facingRotation(scenes[0].destination);
  const rotation = { x: start.x, y: start.y };
  let from = { ...rotation };
  let to = { ...rotation };
  let sceneStart = performance.now();

  // Spin by hand: horizontal drag everywhere (touch keeps vertical page
  // scroll), vertical tilt with a mouse. Release keeps a little momentum;
  // the tour pauses while you play and resumes a few seconds later.
  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  let dragOffset = 0;
  let dragTilt = 0;
  let velocity = 0;
  let lastInteraction = -Infinity;
  let interacted = false;
  let dragging: { x: number; y: number; t: number } | null = null;
  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    if (!dragging) return;
    const now = performance.now();
    const dx = (event.clientX - dragging.x) * 0.0065;
    dragOffset += dx;
    velocity = dx / Math.max(8, now - dragging.t) * 16;
    // Vertical turns too — on touch the browser keeps gestures that start
    // vertical for page scrolling, so this applies once a spin has begun
    dragTilt = Math.max(-1.15, Math.min(1.15, dragTilt + (event.clientY - dragging.y) * 0.0055));
    dragging = { ...dragging, x: event.clientX, y: event.clientY, t: now };
    lastInteraction = now;
    if (reduced) resume();
  };
  const onPointerDown = (event: PointerEvent) => {
    // Keep receiving moves even when the pointer leaves the canvas (over text, past the edge)
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // not capturable (synthetic event) — window-level pointerup still releases
    }
    dragging = { x: event.clientX, y: event.clientY, t: performance.now() };
    velocity = 0;
    lastInteraction = performance.now();
    if (!interacted) {
      interacted = true;
      options.onInteract?.();
    }
  };
  const onPointerUp = () => {
    dragging = null;
    lastInteraction = performance.now();
  };
  // A drag that starts on the globe must not select the headline text underneath
  const noSelect = (event: Event) => event.preventDefault();
  canvas.addEventListener("mousedown", noSelect);
  canvas.addEventListener("selectstart", noSelect);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  // the browser takes over vertical swipes for scrolling → treat as release
  canvas.addEventListener("pointercancel", onPointerUp);

  const projected = new Vector3();
  const toCamera = new Vector3();
  function place(point: GlobePlace) {
    projected.copy(toVector(point, RADIUS * 1.01));
    globe.localToWorld(projected);
    toCamera.copy(camera.position).sub(projected).normalize();
    // how squarely the point faces the viewer (fades out toward the limb)
    const facing = clamp01((projected.clone().normalize().dot(toCamera) - 0.1) / 0.3);
    projected.project(camera);
    return {
      x: ((projected.x + 1) / 2) * canvas.clientWidth,
      y: ((1 - projected.y) / 2) * canvas.clientHeight,
      facing,
    };
  }
  /** shown: destination opacity; originShown(i): per-origin opacity */
  function emitLabels(shown: number, originShown: (index: number) => number) {
    if (!options.onLabels) return;
    const current = scenes[sceneIndex];
    const labels: GlobeLabel[] = current.origins.map((origin, index) => {
      const p = place(origin);
      return { id: origin.id ?? `o${index}`, kind: "origin", x: p.x, y: p.y, opacity: p.facing * originShown(index) };
    });
    // The faint background network is named too (low opacity, only what faces the viewer), so
    // no line ever leads to an anonymous dot. Current-scene labels keep priority in the layer.
    const seen = new Set(labels.map((label) => label.id));
    scenes.forEach((other, otherIndex) => {
      if (otherIndex === sceneIndex) return;
      const extras: { id: string; place: GlobePlace }[] = [
        ...other.origins.map((origin, i) => ({ id: origin.id ?? `${other.id}-o${i}`, place: origin })),
        { id: other.id, place: other.destination },
      ];
      for (const extra of extras) {
        if (seen.has(extra.id)) continue;
        seen.add(extra.id);
        const p = place(extra.place);
        labels.push({ id: extra.id, kind: "origin", x: p.x, y: p.y, opacity: p.facing * 0.5 });
      }
    });
    const d = place(current.destination);
    labels.push({ id: current.id, kind: "destination", x: d.x, y: d.y, opacity: d.facing * shown });
    options.onLabels(labels);
  }

  let raf = 0;
  let active = true;
  let readySent = false;
  const clockStart = performance.now();
  let lastFrame = performance.now();

  function render(now: number) {
    const delta = Math.min(64, now - lastFrame);
    lastFrame = now;
    // Hands on the globe: hold the tour (routes stay drawn) until released + 3.5s
    if (dragging || now - lastInteraction < 3500) sceneStart += delta;
    if (!dragging && Math.abs(velocity) > 0.0001) {
      dragOffset += velocity;
      velocity *= 0.94;
    }
    if (!dragging && now - lastInteraction > 1500) dragTilt *= 0.96;
    const elapsed = now - sceneStart;

    if (!reduced) {
      if (elapsed > SCENE_MS && scenes.length > 1) {
        sceneIndex = (sceneIndex + 1) % scenes.length;
        buildRoutes(sceneIndex);
        // fold the visitor's spin into the tour so the next place still faces them
        rotation.y += dragOffset;
        dragOffset = 0;
        from = { ...rotation };
        const next = facingRotation(scenes[sceneIndex].destination);
        // shortest way round
        let dy = next.y - from.y;
        dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        to = { x: next.x, y: from.y + dy };
        sceneStart = now;
      }
      const turn = easeInOut(clamp01((now - sceneStart) / 1400));
      rotation.x = from.x + (to.x - from.x) * turn;
      rotation.y = from.y + (to.y - from.y) * turn;
      const drift = Math.sin((now - clockStart) / 9000) * 0.05;
      tilt.x += (pointer.y * 0.08 - tilt.x) * 0.04;
      tilt.y += (pointer.x * 0.12 - tilt.y) * 0.04;
      globe.rotation.set(rotation.x + tilt.x + dragTilt, rotation.y + tilt.y + drift + dragOffset, 0);

      const drawStart = 500;
      for (const arc of arcs) {
        arc.material.uniforms.progress.value = easeInOut(
          clamp01((elapsed - drawStart - arc.delay) / DRAW_MS)
        );
        arc.material.uniforms.fade.value = 1 - clamp01((elapsed - (SCENE_MS - 700)) / 600);
      }
      const arrival = clamp01((elapsed - drawStart - DRAW_MS) / 500);
      if (pointMaterial) {
        const pulse = 1 + Math.sin(now / 420) * 0.08 * arrival;
        points?.scale.setScalar(pulse);
      }
      starMaterial.uniforms.time.value = (now - clockStart) / 1000;
      const seconds = (now - clockStart) / 1000;
      for (const arc of arcs) arc.material.uniforms.time.value = seconds;
      for (const item of ambient) item.material.uniforms.time.value = seconds;
      const fading = 1 - clamp01((elapsed - (SCENE_MS - 700)) / 600);
      // Names come with the lines: the destination from the first moments, each origin just
      // before its route leaves it
      emitLabels(clamp01((elapsed - 250) / 600) * fading, (index) => {
        const delay = arcs[index]?.delay ?? 0;
        return clamp01((elapsed - drawStart - delay + 250) / 450) * fading;
      });
    } else {
      globe.rotation.set(rotation.x + dragTilt, rotation.y + dragOffset, 0);
      emitLabels(1, () => 1);
    }

    renderer.render(scene, camera);
    if (!readySent) {
      readySent = true;
      options.onReady?.();
    }
    if (active && !reduced) raf = requestAnimationFrame(render);
  }

  function resume() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  }
  resume();

  // Reduced motion: re-render only on interaction/resize
  const onReducedInteract = () => reduced && resume();
  if (reduced) canvas.addEventListener("pointermove", onReducedInteract);

  return {
    setLayout(next) {
      layout = next;
      frame();
      resume();
    },
    resize() {
      frame();
      resume();
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) {
        // don't jump a whole scene ahead after being hidden
        sceneStart = performance.now() - DRAW_MS;
        resume();
      } else {
        cancelAnimationFrame(raf);
      }
    },
    destroy() {
      active = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousedown", noSelect);
      canvas.removeEventListener("selectstart", noSelect);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onReducedInteract);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      clearRoutes();
      for (const item of ambient) {
        item.mesh.geometry.dispose();
        item.material.dispose();
      }
      earthGeometry.dispose();
      earthMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      dayMap.dispose();
      nightMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
