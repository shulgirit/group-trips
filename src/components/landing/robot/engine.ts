import {
  ACESFilmicToneMapping,
  AmbientLight,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
  AdditiveBlending,
  type BufferGeometry,
  type Material,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * "Tog" — Together's AI guide as a character, built from primitives in
 * vanilla three.js (no model file, no third-party asset license). Glossy
 * white shell, dark visor with glowing eyes, headphones, and the brand's
 * brass dot as antenna tip and chest light. Floats over a light ring.
 *
 * Behaviour: idle float and sway, blinks, eyes and head follow the pointer,
 * waves on load and when tapped (happy eyes). Reduced motion: one still,
 * friendly pose. Everything is disposed in destroy().
 */

export interface RobotHandle {
  wave(): void;
  setActive(active: boolean): void;
  resize(): void;
  destroy(): void;
}

const BRASS = new Color("#d8b277");
const EYE = new Color("#9fe3ec");

export function createRobot(options: {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  /** Horizontal offset in scene units (+ = right), leaves room for the speech bubble */
  shift?: number;
  onReady?: () => void;
}): RobotHandle {
  const { canvas, reducedMotion } = options;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;

  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.1, 9.2);

  // Lights: soft fill, warm key, cool rim — the brand's brass and sea
  scene.add(new AmbientLight(0xffffff, 0.35));
  const key = new DirectionalLight(0xfff1dc, 2.1);
  key.position.set(-2.5, 3.5, 4);
  scene.add(key);
  const rim = new DirectionalLight(0x7fb6c4, 2.4);
  rim.position.set(3, 1.5, -3);
  scene.add(rim);

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const track = <G extends BufferGeometry, M extends Material>(g: G, m: M) => {
    geometries.push(g);
    materials.push(m);
    return new Mesh(g, m);
  };

  const shell = new MeshPhysicalMaterial({
    color: 0xf4f5f2,
    roughness: 0.28,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  materials.push(shell);
  const visorMaterial = new MeshPhysicalMaterial({
    color: 0x070c16,
    roughness: 0.12,
    metalness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  materials.push(visorMaterial);
  const brassMaterial = new MeshStandardMaterial({ color: BRASS, metalness: 0.85, roughness: 0.3 });
  materials.push(brassMaterial);
  const glowBrass = new MeshBasicMaterial({ color: BRASS });
  materials.push(glowBrass);
  const eyeMaterial = new MeshBasicMaterial({ color: EYE });
  materials.push(eyeMaterial);
  const darkMaterial = new MeshStandardMaterial({ color: 0x1c2a43, roughness: 0.5, metalness: 0.3 });
  materials.push(darkMaterial);

  const robot = new Group();
  robot.position.x = options.shift ?? 0;
  scene.add(robot);

  // ── head ──
  const head = new Group();
  head.position.y = 0.72;
  robot.add(head);
  const skullGeometry = new SphereGeometry(1, 64, 48);
  geometries.push(skullGeometry);
  const skull = new Mesh(skullGeometry, shell);
  skull.scale.set(1.18, 0.98, 1.02);
  head.add(skull);

  const visor = new Mesh(skullGeometry, visorMaterial);
  visor.scale.set(0.98, 0.66, 0.62);
  visor.position.set(0, -0.04, 0.48);
  head.add(visor);

  const eyeGeometry = new CapsuleGeometry(0.085, 0.16, 8, 16);
  geometries.push(eyeGeometry);
  const eyes = new Group();
  eyes.position.set(0, -0.02, 1.06);
  head.add(eyes);
  const leftEye = new Mesh(eyeGeometry, eyeMaterial);
  const rightEye = new Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.x = -0.3;
  rightEye.position.x = 0.3;
  eyes.add(leftEye, rightEye);
  // happy eyes: arcs that replace the capsules while waving
  const smileGeometry = new TorusGeometry(0.12, 0.034, 8, 24, Math.PI);
  geometries.push(smileGeometry);
  const leftSmile = new Mesh(smileGeometry, eyeMaterial);
  const rightSmile = new Mesh(smileGeometry, eyeMaterial);
  leftSmile.position.set(-0.3, -0.06, 0);
  rightSmile.position.set(0.3, -0.06, 0);
  leftSmile.visible = rightSmile.visible = false;
  eyes.add(leftSmile, rightSmile);

  // headphones
  const cupGeometry = new CylinderGeometry(0.26, 0.26, 0.16, 40);
  geometries.push(cupGeometry);
  for (const side of [-1, 1]) {
    const cup = new Mesh(cupGeometry, shell);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 1.16, -0.02, 0);
    head.add(cup);
    const ring = track(new TorusGeometry(0.2, 0.035, 12, 40), brassMaterial);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 1.25, -0.02, 0);
    head.add(ring);
  }
  const band = track(new TorusGeometry(1.16, 0.06, 16, 64, Math.PI), shell);
  band.position.y = -0.02;
  band.rotation.z = 0;
  head.add(band);

  // antenna with the brand's brass node
  const stem = track(new CylinderGeometry(0.03, 0.03, 0.36, 12), darkMaterial);
  stem.position.set(0, 1.12, 0);
  head.add(stem);
  const node = track(new SphereGeometry(0.1, 24, 16), glowBrass);
  node.position.set(0, 1.34, 0);
  head.add(node);
  const nodeHalo = track(new SphereGeometry(0.2, 24, 16), new MeshBasicMaterial({
    color: BRASS,
    transparent: true,
    opacity: 0.18,
    blending: AdditiveBlending,
    depthWrite: false,
  }));
  nodeHalo.position.copy(node.position);
  head.add(nodeHalo);

  // ── body ──
  const body = new Group();
  body.position.y = -0.62;
  robot.add(body);
  const torso = track(new SphereGeometry(0.62, 48, 36), shell);
  torso.scale.set(1, 0.92, 0.86);
  body.add(torso);
  const chest = track(new CircleGeometry(0.11, 32), glowBrass);
  chest.position.set(0, 0.06, 0.535);
  body.add(chest);
  const neck = track(new CylinderGeometry(0.22, 0.28, 0.18, 32), darkMaterial);
  neck.position.y = 0.6;
  body.add(neck);

  // arms (pivot at the shoulder)
  const armGeometry = new CapsuleGeometry(0.13, 0.42, 8, 20);
  geometries.push(armGeometry);
  const arms: Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.6, 0.22, 0);
    const arm = new Mesh(armGeometry, shell);
    arm.position.y = -0.3;
    shoulder.add(arm);
    shoulder.rotation.z = side * 0.32;
    body.add(shoulder);
    arms.push(shoulder);
  }
  const [leftArm, rightArm] = arms;

  // hover ring under the robot
  const glowRing = track(new RingGeometry(0.42, 0.62, 64), new MeshBasicMaterial({
    color: 0x7fb6c4,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
  }));
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.set(options.shift ?? 0, -1.62, 0);
  scene.add(glowRing);
  const glowDisc = track(new CircleGeometry(0.42, 48), new MeshBasicMaterial({
    color: 0x7fb6c4,
    transparent: true,
    opacity: 0.12,
    blending: AdditiveBlending,
    depthWrite: false,
  }));
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.set(options.shift ?? 0, -1.62, 0);
  scene.add(glowDisc);

  // ── interaction ──
  const pointer = new Vector2(0, 0);
  const look = new Vector2(0, 0);
  const onPointerMove = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  let waveStart = reducedMotion ? -Infinity : performance.now() + 600; // hello on arrival
  const wave = () => {
    waveStart = performance.now();
    if (reducedMotion) renderOnce();
  };
  const onTap = () => wave();
  canvas.addEventListener("pointerdown", onTap);

  function frame() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // keep the whole character in frame on narrow and wide boxes
    camera.position.z = camera.aspect < 0.8 ? (9.2 / camera.aspect) * 0.8 : 9.2;
    camera.lookAt(0, 0.22, 0);
    camera.updateProjectionMatrix();
  }
  frame();

  let nextBlink = performance.now() + 1800;
  let lastBlink = -Infinity;
  let raf = 0;
  let active = true;
  let ready = false;
  const start = performance.now();

  function pose(now: number) {
    const t = (now - start) / 1000;
    const still = reducedMotion;
    // float + sway
    robot.position.y = still ? 0 : Math.sin(t * 1.4) * 0.08;
    robot.rotation.z = still ? 0 : Math.sin(t * 0.9) * 0.025;
    const lift = 1 - (robot.position.y + 0.08) * 1.5;
    glowRing.scale.setScalar(1 + (lift - 1) * 0.6);
    (glowRing.material as MeshBasicMaterial).opacity = 0.28 + 0.1 * lift;

    // gaze: eyes lead, head follows softly
    look.x += (pointer.x - look.x) * 0.08;
    look.y += (pointer.y - look.y) * 0.08;
    head.rotation.y = look.x * 0.45;
    head.rotation.x = look.y * 0.22;
    eyes.position.x = look.x * 0.06;
    eyes.position.y = -0.02 - look.y * 0.04;

    // blink
    let blink = 1;
    if (!still) {
      if (now > nextBlink) {
        lastBlink = now;
        nextBlink = now + 2600 + Math.random() * 2600;
      }
      const since = now - lastBlink;
      blink = since < 140 ? Math.max(0.08, Math.abs(since - 70) / 70) : 1;
    }

    // wave
    const w = (now - waveStart) / 1000;
    const waving = w >= 0 && w < 1.8;
    if (waving) {
      const envelope = Math.sin(Math.min(1, w / 1.8) * Math.PI);
      rightArm.rotation.z = -0.32 - envelope * 2.35;
      rightArm.rotation.x = Math.sin(w * 14) * 0.35 * envelope;
    } else {
      rightArm.rotation.z += (-0.32 - rightArm.rotation.z) * 0.1;
      rightArm.rotation.x *= 0.9;
    }
    leftArm.rotation.z = 0.32 + (still ? 0 : Math.sin(t * 1.4 + 1) * 0.05);
    leftEye.visible = rightEye.visible = !waving;
    leftSmile.visible = rightSmile.visible = waving;
    eyes.scale.y = waving ? 1 : blink;

    // brass node breathes
    const pulse = still ? 1 : 1 + Math.sin(t * 2.4) * 0.12;
    nodeHalo.scale.setScalar(pulse);
  }

  function renderOnce() {
    pose(performance.now());
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      options.onReady?.();
    }
  }

  function loop(now: number) {
    pose(now);
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      options.onReady?.();
    }
    if (active) raf = requestAnimationFrame(loop);
  }

  if (reducedMotion) {
    pointer.set(-0.15, 0.05);
    look.copy(pointer);
    renderOnce();
  } else {
    raf = requestAnimationFrame(loop);
  }

  return {
    wave,
    setActive(next) {
      if (reducedMotion || next === active) return;
      active = next;
      cancelAnimationFrame(raf);
      if (active) raf = requestAnimationFrame(loop);
    },
    resize() {
      frame();
      if (reducedMotion) renderOnce();
    },
    destroy() {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onTap);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
