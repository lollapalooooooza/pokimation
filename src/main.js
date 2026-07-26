import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 12 * 1024 * 1024;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const resolveAsset = (path) => new URL(path.replace(/^\/+/, ''), new URL(import.meta.env.BASE_URL, window.location.href)).href;

const dom = {
  app: document.querySelector('#app'),
  uploadView: document.querySelector('#upload-view'),
  experienceView: document.querySelector('#experience-view'),
  uploadForm: document.querySelector('#upload-form'),
  input: document.querySelector('#image-input'),
  dropZone: document.querySelector('#drop-zone'),
  error: document.querySelector('#upload-error'),
  exampleButtons: [...document.querySelectorAll('[data-example]')],
  uploadAgain: document.querySelector('#upload-again-top'),
  memoryImage: document.querySelector('#memory-image'),
  memoryDate: document.querySelector('#memory-date'),
  transition: document.querySelector('#transition-overlay'),
  transitionPercent: document.querySelector('#transition-percent'),
  particleCanvas: document.querySelector('#particle-canvas'),
  threeRoot: document.querySelector('#three-root'),
  focusButtons: [...document.querySelectorAll('[data-focus]')],
  toggleMotion: document.querySelector('#toggle-motion'),
  resetCamera: document.querySelector('#reset-camera'),
  toggleAudio: document.querySelector('#toggle-audio'),
  backgroundImage: document.querySelector('#background-image'),
  backgroundVideo: document.querySelector('#background-video'),
  duoPanel: document.querySelector('.duo-panel'),
  moveButtons: [...document.querySelectorAll('[data-move]')],
  saveMoment: document.querySelector('#save-moment'),
  toast: document.querySelector('#toast'),
};

let selectedImageUrl = '';
let activeSceneKey = 'bigFish';
let activeSceneConfig = null;
let assetManifest = null;
let transitionRunning = false;
let sceneReady = false;
let sceneApi = null;
let toastTimer = 0;

function showError(message = '') {
  dom.error.textContent = message;
  dom.dropZone.classList.toggle('has-error', Boolean(message));
}

function validateImage(file) {
  if (!file) return 'Choose an image to begin your adventure.';
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Please choose a JPG, PNG, or WEBP image.';
  if (file.size > MAX_FILE_SIZE) return 'That image is over 12 MB. Try a smaller version.';
  return '';
}

function setMemoryImage(url, label, sceneKey) {
  if (selectedImageUrl && selectedImageUrl.startsWith('blob:')) URL.revokeObjectURL(selectedImageUrl);
  selectedImageUrl = url;
  activeSceneKey = sceneKey;
  dom.memoryImage.src = url;
  dom.memoryImage.alt = `${label || 'Uploaded'} original memory`;
  dom.memoryDate.textContent = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

function readImageSize(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('The selected image could not be read.'));
    image.src = url;
  });
}

async function matchSceneForImage(url, file) {
  const fileName = file.name.toLowerCase();
  if (fileName.includes('big-fish') || fileName.includes('afa4a807')) return 'bigFish';
  if (fileName.includes('pokemon') || fileName.includes('pikachu')) return 'pikachu';

  const { width, height } = await readImageSize(url);
  return width / height < 1 ? 'bigFish' : 'pikachu';
}

async function acceptFile(file) {
  const error = validateImage(file);
  if (error) {
    showError(error);
    return;
  }

  showError();
  const imageUrl = URL.createObjectURL(file);
  try {
    const sceneKey = await matchSceneForImage(imageUrl, file);
    setMemoryImage(imageUrl, file.name.replace(/\.[^.]+$/, ''), sceneKey);
  } catch (imageError) {
    URL.revokeObjectURL(imageUrl);
    showError(imageError.message);
    return;
  }
  await enterWorld();
}

function handleDrag(event) {
  event.preventDefault();
  if (event.type === 'dragenter' || event.type === 'dragover') dom.dropZone.classList.add('is-dragging');
  if (event.type === 'dragleave' || event.type === 'drop') dom.dropZone.classList.remove('is-dragging');
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
  dom.dropZone.addEventListener(eventName, handleDrag);
});

dom.dropZone.addEventListener('drop', (event) => acceptFile(event.dataTransfer.files[0]));
dom.dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    dom.input.click();
  }
});
dom.input.addEventListener('change', () => acceptFile(dom.input.files[0]));
dom.uploadForm.addEventListener('submit', (event) => event.preventDefault());
dom.exampleButtons.forEach((button) => button.addEventListener('click', async () => {
  const manifest = await getAssetConfig();
  const sceneKey = button.dataset.example;
  const config = manifest.scenes?.[sceneKey];
  if (!config) {
    showError('That featured memory is unavailable right now.');
    return;
  }
  setMemoryImage(resolveAsset(config.originalImage), config.name, sceneKey);
  await enterWorld();
}));

async function enterWorld() {
  if (transitionRunning) return;
  transitionRunning = true;
  dom.transition.classList.add('is-active');
  dom.transition.setAttribute('aria-hidden', 'false');

  const duration = reducedMotion ? 260 : 2150;
  animatePortalParticles(duration);
  await new Promise((resolve) => window.setTimeout(resolve, duration * 0.68));

  dom.uploadView.classList.remove('is-active');
  dom.uploadView.setAttribute('aria-hidden', 'true');
  dom.experienceView.classList.add('is-active');
  dom.experienceView.setAttribute('aria-hidden', 'false');
  dom.app.dataset.view = 'experience';
  dom.uploadAgain.hidden = false;
  window.scrollTo(0, 0);

  if (!sceneReady) {
    sceneApi = await createThreeScene();
    sceneReady = true;
  } else {
    await sceneApi.load(activeSceneKey);
  }
  sceneApi.resize();
  sceneApi.play();

  await new Promise((resolve) => window.setTimeout(resolve, duration * 0.32));
  dom.transition.classList.remove('is-active');
  dom.transition.setAttribute('aria-hidden', 'true');
  transitionRunning = false;
  document.querySelector('#scene-title').focus({ preventScroll: true });
}

function animatePortalParticles(duration) {
  const canvas = dom.particleCanvas;
  const context = canvas.getContext('2d');
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const colors = ['#ff5b52', '#ffd34f', '#72d5c3', '#fdf8e8', '#4876d7'];
  const particles = Array.from({ length: reducedMotion ? 24 : 170 }, (_, index) => {
    const angle = (index / 150) * Math.PI * 10 + Math.random();
    const distance = 90 + Math.random() * Math.max(width, height) * 0.7;
    return {
      angle,
      distance,
      radius: index % 13 === 0 ? 7 + Math.random() * 8 : 1.5 + Math.random() * 5,
      color: colors[index % colors.length],
      kind: index % 13 === 0 ? 'pokeball' : 'spark',
      offset: Math.random() * 0.15,
      spin: (Math.random() - 0.5) * 2.4,
    };
  });
  const started = performance.now();

  function drawMiniPokeball(x, y, size, rotation, alpha) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.globalAlpha = alpha;
    context.globalCompositeOperation = 'source-over';
    context.beginPath();
    context.arc(0, 0, size, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#fffaf0';
    context.fillRect(-size, -size, size * 2, size * 2);
    context.fillStyle = '#ef514c';
    context.fillRect(-size, -size, size * 2, size);
    context.fillStyle = '#172746';
    context.fillRect(-size, -size * 0.16, size * 2, size * 0.32);
    context.lineWidth = Math.max(1.5, size * 0.16);
    context.strokeStyle = '#172746';
    context.beginPath();
    context.arc(0, 0, size * 0.95, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#fffaf0';
    context.beginPath();
    context.arc(0, 0, size * 0.29, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = Math.max(1.2, size * 0.12);
    context.stroke();
    context.restore();
  }

  function draw(now) {
    const progress = Math.min((now - started) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);
    context.globalCompositeOperation = 'lighter';

    particles.forEach((particle) => {
      const local = Math.max(0, Math.min(1, (eased - particle.offset) / (1 - particle.offset)));
      const inward = particle.distance * (1 - local);
      const angle = particle.angle + particle.spin * local;
      const x = Math.cos(angle) * inward;
      const y = Math.sin(angle) * inward * 0.65;
      const alpha = Math.sin(local * Math.PI) * 0.92;
      if (particle.kind === 'pokeball') {
        drawMiniPokeball(x, y, particle.radius * (0.78 + local * 0.36), angle + local * Math.PI * 4, alpha);
        return;
      }
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(x, y, particle.radius * (0.7 + local), 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
    dom.transitionPercent.textContent = `${Math.round(progress * 100)}%`;
    if (progress < 1) requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

function resetToUpload() {
  if (transitionRunning) return;
  dom.experienceView.classList.remove('is-active');
  dom.experienceView.setAttribute('aria-hidden', 'true');
  dom.uploadView.classList.add('is-active');
  dom.uploadView.removeAttribute('aria-hidden');
  dom.app.dataset.view = 'upload';
  dom.uploadAgain.hidden = true;
  dom.input.value = '';
  window.scrollTo(0, 0);
  sceneApi?.pause();
  dom.backgroundVideo.pause();
  document.querySelector('#upload-title').focus({ preventScroll: true });
}

dom.uploadAgain.addEventListener('click', resetToUpload);

function makeMaterial(color, roughness = 0.65, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createTrainer() {
  const group = new THREE.Group();
  group.name = 'Preview trainer';
  group.userData.preview = true;

  const skin = makeMaterial(0xf3bc92, 0.8);
  const navy = makeMaterial(0x253355, 0.62);
  const coral = makeMaterial(0xf05f58, 0.55);
  const cream = makeMaterial(0xfff4d7, 0.78);
  const dark = makeMaterial(0x172036, 0.55);

  const legs = new THREE.Group();
  [-0.22, 0.22].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.8, 5, 10), navy);
    leg.position.set(x, 0.72, 0);
    leg.castShadow = true;
    legs.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 12), dark);
    shoe.scale.set(1, 0.46, 1.42);
    shoe.position.set(x, 0.18, 0.09);
    shoe.castShadow = true;
    legs.add(shoe);
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.47, 0.76, 7, 18), cream);
  body.position.y = 1.72;
  body.castShadow = true;
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.88, 0.58, 2, 2, 2), coral);
  jacket.position.set(0, 1.8, 0.02);
  jacket.rotation.z = 0.02;
  jacket.castShadow = true;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.25, 16), skin);
  neck.position.y = 2.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.39, 28, 20), skin);
  head.scale.set(0.9, 1.06, 0.88);
  head.position.y = 2.78;
  head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.405, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
  hair.position.y = 2.94;
  hair.scale.set(0.91, 0.72, 0.9);
  hair.castShadow = true;

  [-0.58, 0.58].forEach((x, index) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 5, 10), coral);
    arm.position.set(x, 1.75, 0);
    arm.rotation.z = index ? -0.38 : 0.38;
    arm.castShadow = true;
    group.add(arm);
  });

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.43, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), coral);
  cap.position.set(0, 3.01, 0);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.26), coral);
  brim.position.set(0, 3.02, 0.34);
  brim.rotation.x = -0.12;
  group.add(legs, body, jacket, neck, head, hair, cap, brim);
  group.position.set(-1.25, 0.15, 0);
  return group;
}

function createPartner() {
  const group = new THREE.Group();
  group.name = 'Preview partner';
  group.userData.preview = true;
  const yellow = makeMaterial(0xf8c945, 0.55);
  const pale = makeMaterial(0xffedaa, 0.72);
  const dark = makeMaterial(0x22243d, 0.52);
  const coral = makeMaterial(0xf05f58, 0.62);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 24), yellow);
  body.scale.set(0.88, 1.02, 0.82);
  body.position.y = 0.9;
  body.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.53, 28, 20), pale);
  belly.scale.set(0.74, 0.8, 0.44);
  belly.position.set(0, 0.78, 0.48);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.66, 32, 24), yellow);
  head.scale.set(1, 0.88, 0.93);
  head.position.y = 1.73;
  head.castShadow = true;

  [-0.31, 0.31].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 18), yellow);
    ear.position.set(x, 2.43, 0);
    ear.rotation.z = x < 0 ? 0.18 : -0.18;
    ear.castShadow = true;
    group.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), dark);
    eye.position.set(x * 0.75, 1.82, 0.59);
    group.add(eye);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), coral);
    cheek.position.set(x * 1.45, 1.58, 0.56);
    cheek.scale.set(1, 0.75, 0.5);
    group.add(cheek);
  });

  [-0.38, 0.38].forEach((x) => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 12), yellow);
    foot.scale.set(1, 0.52, 1.3);
    foot.position.set(x, 0.24, 0.1);
    foot.castShadow = true;
    group.add(foot);
  });

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), dark);
  nose.position.set(0, 1.66, 0.63);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.1, 12, 24, Math.PI * 1.2), yellow);
  tail.position.set(0.58, 1.02, -0.42);
  tail.rotation.set(0.3, 0.7, -0.4);
  group.add(body, belly, head, nose, tail);
  group.position.set(1.25, 0.1, 0.16);
  return group;
}

function createStage(renderer) {
  const group = new THREE.Group();
  group.name = 'Poké Ball arena';
  const stageTexture = new THREE.TextureLoader().load(resolveAsset('assets/stage/pokeball-stage-cover.png'));
  stageTexture.colorSpace = THREE.SRGBColorSpace;
  stageTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  stageTexture.minFilter = THREE.LinearMipmapLinearFilter;

  const stageBase = new THREE.Mesh(
    new THREE.CylinderGeometry(3.27, 3.38, 0.18, 96, 1, false),
    new THREE.MeshStandardMaterial({
      color: 0x123e86,
      roughness: 0.28,
      metalness: 0.58,
    }),
  );
  stageBase.position.y = 0.01;
  stageBase.receiveShadow = true;
  stageBase.castShadow = true;

  const cover = new THREE.Mesh(
    new THREE.CircleGeometry(3.29, 128),
    new THREE.MeshStandardMaterial({
      map: stageTexture,
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.12,
      transparent: true,
      alphaTest: 0.025,
    }),
  );
  cover.rotation.x = -Math.PI / 2;
  cover.position.y = 0.11;
  cover.receiveShadow = true;

  const underglow = new THREE.Mesh(
    new THREE.TorusGeometry(3.36, 0.045, 10, 160),
    new THREE.MeshBasicMaterial({
      color: 0x49baff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  underglow.rotation.x = Math.PI / 2;
  underglow.position.y = -0.035;

  group.add(stageBase, cover, underglow);
  return group;
}

function createWorldParticles() {
  const count = 90;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [new THREE.Color(0xffd34f), new THREE.Color(0x72d5c3), new THREE.Color(0xff6d61)];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2.8 + Math.random() * 2.8;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = 0.4 + Math.random() * 4.4;
    positions[index * 3 + 2] = Math.sin(angle) * radius - 0.4;
    const color = palette[index % palette.length];
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.72 }),
  );
}

function createElectricField() {
  const group = new THREE.Group();
  group.name = 'Partner electric field';
  group.position.set(1.25, 1.25, 0);
  group.userData.intensity = 0;

  const materials = [];
  for (let boltIndex = 0; boltIndex < 7; boltIndex += 1) {
    const points = [];
    const angle = (boltIndex / 7) * Math.PI * 2;
    for (let pointIndex = 0; pointIndex < 7; pointIndex += 1) {
      const progress = pointIndex / 6;
      const radius = 0.72 + progress * 0.74;
      const jitter = pointIndex === 0 || pointIndex === 6 ? 0 : (Math.random() - 0.5) * 0.22;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius + jitter,
        (progress - 0.5) * 1.75 + (Math.random() - 0.5) * 0.16,
        Math.sin(angle) * radius * 0.55 + jitter,
      ));
    }
    const material = new THREE.LineBasicMaterial({
      color: boltIndex % 2 ? 0xfff16a : 0x63c7ff,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(material);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffdf3c,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shockwave = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.025, 8, 72), ringMaterial);
  shockwave.rotation.x = Math.PI / 2;
  shockwave.position.y = -1.02;
  group.add(shockwave);
  group.userData.materials = materials;
  group.userData.shockwave = shockwave;
  return group;
}

function createPikachuDeformer(model) {
  const uniforms = {
    uPokeTime: { value: 0 },
    uPokeReaction: { value: 0 },
    uPokeEnergy: { value: reducedMotion ? 0.2 : 1 },
  };
  let animatedMeshes = 0;

  function installDeformation(material, bounds) {
    const min = bounds.min;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const originalCompile = material.onBeforeCompile;
    const originalCacheKey = material.customProgramCacheKey?.bind(material);
    const number = (value) => Number(value).toFixed(8);

    material.onBeforeCompile = (shader, renderer) => {
      originalCompile?.(shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uPokeTime;
          uniform float uPokeReaction;
          uniform float uPokeEnergy;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float pokeY = clamp((position.y - ${number(min.y)}) / ${number(Math.max(size.y, 0.0001))}, 0.0, 1.0);
          float pokeX = (position.x - ${number(center.x)}) / ${number(Math.max(size.x * 0.5, 0.0001))};
          float pokeZ = (position.z - ${number(center.z)}) / ${number(Math.max(size.z * 0.5, 0.0001))};
          float pokeBreath = sin(uPokeTime * 2.45) * 0.5 + 0.5;
          float pokeBody = smoothstep(0.08, 0.28, pokeY) * (1.0 - smoothstep(0.66, 0.84, pokeY));
          float pokeUpper = smoothstep(0.34, 0.78, pokeY);
          float pokeHead = smoothstep(0.58, 0.84, pokeY);
          float pokeEar = smoothstep(0.78, 0.98, pokeY);
          float pokeFeet = 1.0 - smoothstep(0.05, 0.24, pokeY);
          float pokeOuter = smoothstep(0.48, 0.94, abs(pokeX));

          float breatheScale = 1.0 + pokeBody * pokeBreath * 0.018 * uPokeEnergy;
          transformed.x = ${number(center.x)} + (transformed.x - ${number(center.x)}) * breatheScale;
          transformed.z = ${number(center.z)} + (transformed.z - ${number(center.z)}) * breatheScale;

          float bodyLean = (sin(uPokeTime * 0.88) * 0.026 + sin(uPokeTime * 0.31) * 0.014) * uPokeEnergy;
          bodyLean += sin(uPokeTime * 8.0) * uPokeReaction * 0.055;
          float leanPivot = ${number(min.y + size.y * 0.24)};
          float leanY = transformed.y - leanPivot;
          transformed.x += -leanY * bodyLean * pokeUpper;
          transformed.y += abs(pokeX) * pokeFeet * sin(uPokeTime * 1.76) * ${number(size.y * 0.012)} * uPokeEnergy;

          float headTurn = (sin(uPokeTime * 0.72) * 0.024 + sin(uPokeTime * 0.19) * 0.016) * uPokeEnergy;
          transformed.x += pokeHead * headTurn * ${number(size.x)};
          transformed.z += pokeHead * sin(uPokeTime * 1.08) * ${number(size.z * 0.008)} * uPokeEnergy;
          transformed.y += pokeHead * sin(uPokeTime * 1.42) * ${number(size.y * 0.008)} * uPokeEnergy;

          float earSide = sign(pokeX == 0.0 ? 1.0 : pokeX);
          float earTwitch = sin(uPokeTime * 3.35 + earSide * 1.7) * 0.55 + sin(uPokeTime * 7.9 + earSide) * 0.18;
          transformed.x += pokeEar * earSide * earTwitch * ${number(size.x * 0.038)} * uPokeEnergy;
          transformed.z += pokeEar * earTwitch * ${number(size.z * 0.018)} * uPokeEnergy;

          float pawStep = sin(uPokeTime * 1.76 + earSide * 1.5708) * pokeOuter * pokeBody;
          transformed.y += pawStep * ${number(size.y * 0.014)} * uPokeEnergy;
          transformed.z += pawStep * ${number(size.z * 0.012)} * uPokeEnergy;

          float tailSwish = sin(uPokeTime * 2.15) * pokeOuter * (1.0 - pokeHead) * (1.0 - pokeFeet);
          transformed.z += tailSwish * earSide * ${number(size.z * 0.018)} * uPokeEnergy;

          float actionWave = sin(pokeY * 3.14159265);
          transformed.x += sin(uPokeTime * 10.0 + pokeY * 5.0) * uPokeReaction * actionWave * ${number(size.x * 0.032)};
          transformed.y += uPokeReaction * actionWave * ${number(size.y * 0.045)};
          transformed.z += cos(uPokeTime * 9.0 + pokeX * 2.0) * uPokeReaction * actionWave * ${number(size.z * 0.018)};`,
        );
    };
    material.customProgramCacheKey = () => `pokimation-deform-v2-${originalCacheKey?.() || ''}`;
    material.needsUpdate = true;
  }

  model.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    if (!bounds) return;

    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const animatedMaterials = sourceMaterials.map((source) => {
      const material = source.clone();
      installDeformation(material, bounds);
      return material;
    });
    object.material = Array.isArray(object.material) ? animatedMaterials : animatedMaterials[0];

    const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    installDeformation(depthMaterial, bounds);
    object.customDepthMaterial = depthMaterial;
    animatedMeshes += 1;
  });

  return animatedMeshes
    ? {
        update(time, reaction) {
          uniforms.uPokeTime.value = time;
          uniforms.uPokeReaction.value = reaction;
        },
      }
    : null;
}

async function getAssetConfig() {
  if (assetManifest) return assetManifest;
  try {
    const response = await fetch(resolveAsset('assets/scene-config.json'));
    if (!response.ok) throw new Error('Missing scene config');
    assetManifest = await response.json();
    return assetManifest;
  } catch (error) {
    console.warn('Pokimation is using preview scene assets.', error);
    assetManifest = { scenes: {} };
    return assetManifest;
  }
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value !== undefined) element.textContent = value;
}

function applySceneContent(sceneKey, config) {
  activeSceneKey = sceneKey;
  activeSceneConfig = config;
  dom.experienceView.dataset.scene = sceneKey;

  setText('#scene-title', config.sceneTitle);
  setText('#scene-subtitle', config.sceneSubtitle);
  setText('#memory-caption', config.memoryCaption);
  setText('#trainer-id', config.trainerId);
  setText('#capture-label', config.captureLabel);
  setText('#bond-value', config.bondValue);
  setText('#memory-verified', config.verifiedLabel);
  setText('#partner-number', config.number);
  setText('#partner-name', config.name);
  setText('#partner-gender', config.gender);
  setText('#partner-rarity', config.rarity);
  setText('#type-icon', config.typeIcon);
  setText('#partner-type', config.type);
  setText('#partner-level', config.level);
  setText('#partner-hp', config.hp);
  setText('#partner-height', config.height);
  setText('#partner-weight', config.weight);
  setText('#scene-tip', config.tip);
  setText('#confirm-label', config.confirmLabel);

  const filledStars = Math.max(0, Math.min(5, Number(config.stars) || 0));
  const stars = document.querySelector('#partner-stars');
  stars.setAttribute('aria-label', `${filledStars} out of five stars`);
  stars.innerHTML = `${'★ '.repeat(filledStars)}${filledStars < 5 ? `<i>${'★ '.repeat(5 - filledStars)}</i>` : ''}`.trim();

  document.querySelectorAll('[data-stat]').forEach((row, index) => {
    const stat = config.stats?.[index];
    if (!stat) return;
    row.querySelector(':scope > span > i').textContent = stat.icon;
    row.querySelector(':scope > span > em').textContent = stat.label;
    row.querySelector(':scope > b > em').style.setProperty('--value', `${stat.value}%`);
    row.querySelector(':scope > strong').textContent = stat.value;
  });

  dom.moveButtons.forEach((button, index) => {
    const move = config.moves?.[index];
    if (!move) return;
    button.dataset.move = move.id;
    button.querySelector('i').textContent = move.icon;
    button.querySelector('span').textContent = move.name;
    button.querySelector('b').textContent = move.pp;
    button.classList.remove('is-active');
  });
}

async function createThreeScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const defaultCamera = new THREE.Vector3(0, 2.6, 10.5);
  camera.position.copy(defaultCamera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D preview of trainer and partner');
  renderer.domElement.setAttribute('tabindex', '0');
  dom.threeRoot.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.78, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 14;
  controls.minPolarAngle = Math.PI * 0.24;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.12;

  scene.add(new THREE.HemisphereLight(0xfff6dc, 0x4b6e78, 2.5));
  const key = new THREE.DirectionalLight(0xfff0c5, 4.6);
  key.position.set(-4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -2;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7ccddd, 3.2);
  rim.position.set(4, 4, -5);
  scene.add(rim);
  const warm = new THREE.PointLight(0xff8a5f, 18, 9, 1.8);
  warm.position.set(0, 1.2, 3.4);
  scene.add(warm);

  const stage = createStage(renderer);
  const humanSlot = new THREE.Group();
  const pokemonSlot = new THREE.Group();
  const trainer = createTrainer();
  const partner = createPartner();
  humanSlot.add(trainer);
  pokemonSlot.add(partner);
  scene.add(stage, humanSlot, pokemonSlot);

  const worldParticles = createWorldParticles();
  const electricField = createElectricField();
  scene.add(worldParticles, electricField);
  const mixers = [];
  const timer = new THREE.Timer();
  timer.connect(document);
  const desiredTarget = new THREE.Vector3(0, 1.78, 0);
  let playing = true;
  let visible = true;
  let partnerReactionAt = -10;
  let partnerReactionStrength = 0;

  const draco = new DRACOLoader();
  draco.setDecoderPath(resolveAsset('draco/'));
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  async function replacePreview(slot, path, targetHeight, xPosition, label, rotationY = 0) {
    if (!path) return { loaded: false, animated: false };
    try {
      const gltf = await loader.loadAsync(resolveAsset(path));
      const model = gltf.scene;
      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      const initialBox = new THREE.Box3().setFromObject(model);
      const initialSize = initialBox.getSize(new THREE.Vector3());
      const scale = targetHeight / Math.max(initialSize.y, 0.001);
      model.scale.setScalar(scale);
      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.set(xPosition - center.x, -scaledBox.min.y + 0.13, -center.z);
      model.rotation.y = rotationY;
      slot.clear();
      slot.add(model);
      let proceduralMotion = null;
      if (gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
        mixers.push(mixer);
      } else if (label === 'partner') {
        proceduralMotion = createPikachuDeformer(model);
      }
      return { loaded: true, animated: gltf.animations.length > 0, proceduralMotion };
    } catch (error) {
      console.warn(`Could not load ${label} model; keeping the preview companion.`, error);
      return { loaded: false, animated: false };
    }
  }

  let partnerMotion = null;

  async function loadScene(sceneKey) {
    const manifest = await getAssetConfig();
    const resolvedKey = manifest.scenes?.[sceneKey] ? sceneKey : manifest.defaultScene;
    const config = manifest.scenes?.[resolvedKey];
    if (!config) return;

    applySceneContent(resolvedKey, config);
    mixers.splice(0).forEach((mixer) => mixer.stopAllAction());

    dom.backgroundVideo.pause();
    dom.backgroundVideo.hidden = true;
    dom.backgroundImage.hidden = true;
    dom.backgroundVideo.removeAttribute('poster');
    dom.toggleAudio.disabled = true;
    dom.toggleAudio.classList.remove('is-active');
    dom.backgroundVideo.muted = true;

    if (config.backgroundImage) {
      dom.backgroundImage.src = resolveAsset(config.backgroundImage);
      dom.backgroundImage.hidden = false;
    } else if (config.backgroundVideo) {
      dom.backgroundVideo.src = resolveAsset(config.backgroundVideo);
      if (config.backgroundPoster) dom.backgroundVideo.poster = resolveAsset(config.backgroundPoster);
      dom.backgroundVideo.hidden = false;
      dom.backgroundVideo.load();
      dom.backgroundVideo.play().catch(() => {});
      dom.toggleAudio.disabled = false;
    }

    const results = await Promise.all([
      replacePreview(
        humanSlot,
        config.humanModel,
        config.humanHeight || 4.14,
        config.humanX ?? -1.2,
        'human',
        config.humanRotationY || 0,
      ),
      replacePreview(
        pokemonSlot,
        config.partnerModel,
        config.partnerHeight || 2.82,
        config.partnerX ?? 1.25,
        'partner',
        config.partnerRotationY || 0,
      ),
    ]);
    partnerMotion = results[1].proceduralMotion;
    renderer.domElement.dataset.humanMotion = results[0].animated ? 'skeletal' : 'static';
    renderer.domElement.dataset.partnerMotion = results[1].animated
      ? 'skeletal'
      : partnerMotion
        ? 'procedural-deform'
        : 'procedural';
    renderer.domElement.setAttribute('aria-label', `Interactive 3D preview of the trainer and ${config.name}`);
  }

  await loadScene(activeSceneKey);

  function resize() {
    const rect = dom.threeRoot.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.fov = camera.aspect < 0.9 ? 54 : 34;
    camera.updateProjectionMatrix();
  }

  new ResizeObserver(resize).observe(dom.threeRoot);

  function focus(mode) {
    const x = mode === 'human' ? -1.15 : mode === 'pokemon' ? 1.15 : 0;
    desiredTarget.set(x, mode === 'human' ? 1.9 : mode === 'pokemon' ? 1.48 : 1.78, 0);
    dom.focusButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.focus === mode));
    controls.autoRotate = mode === 'duo' && !reducedMotion;
    if (mode === 'pokemon') triggerPartnerReaction(0.72);
  }

  function triggerPartnerReaction(strength = 1) {
    if (!playing) {
      playing = true;
      dom.toggleMotion.textContent = 'Ⅱ';
      dom.toggleMotion.setAttribute('aria-label', 'Pause scene animation');
    }
    partnerReactionAt = timer.getElapsed();
    partnerReactionStrength = strength;
    electricField.userData.intensity = Math.max(electricField.userData.intensity, strength);
    dom.duoPanel.classList.remove('is-reacting');
    requestAnimationFrame(() => dom.duoPanel.classList.add('is-reacting'));
    window.setTimeout(() => dom.duoPanel.classList.remove('is-reacting'), 900);
  }

  dom.focusButtons.forEach((button) => button.addEventListener('click', () => focus(button.dataset.focus)));
  dom.moveButtons.forEach((button) => button.addEventListener('click', () => {
    dom.moveButtons.forEach((moveButton) => moveButton.classList.toggle('is-active', moveButton === button));
    triggerPartnerReaction(button === dom.moveButtons[0] ? 1.35 : 1);
  }));
  let pointerOrigin = null;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerOrigin = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerOrigin) return;
    const distance = Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y);
    pointerOrigin = null;
    if (distance < 7) triggerPartnerReaction(0.9);
  });
  dom.resetCamera.addEventListener('click', () => {
    camera.position.copy(defaultCamera);
    desiredTarget.set(0, 1.78, 0);
    controls.target.copy(desiredTarget);
    focus('duo');
    controls.update();
  });
  dom.toggleMotion.addEventListener('click', () => {
    playing = !playing;
    dom.toggleMotion.textContent = playing ? 'Ⅱ' : '▶';
    dom.toggleMotion.setAttribute('aria-label', playing ? 'Pause scene animation' : 'Play scene animation');
  });

  function animate(timestamp) {
    requestAnimationFrame(animate);
    timer.update(timestamp);
    const delta = Math.min(timer.getDelta(), 0.05);
    const time = timer.getElapsed();
    if (visible && playing) {
      mixers.forEach((mixer) => mixer.update(delta));
      const reactionAge = time - partnerReactionAt;
      const reactionProgress = reactionAge >= 0 && reactionAge < 1.15 ? reactionAge / 1.15 : -1;
      const reactionEnvelope = reactionProgress >= 0 ? Math.sin(reactionProgress * Math.PI) : 0;
      const reactionPower = reactionEnvelope * partnerReactionStrength;
      const reactionJump = reactionEnvelope * 0.38;
      const reactionRecoil = reactionProgress >= 0 ? Math.sin(reactionProgress * Math.PI * 2) * 0.09 : 0;
      const motionCycle = time % 7.2;
      const motionPulse = (start, duration, height) => {
        if (motionCycle < start || motionCycle > start + duration) return 0;
        return Math.sin(((motionCycle - start) / duration) * Math.PI) * height;
      };
      const naturalHop = motionPulse(4.5, 0.95, 0.13);
      const anticipation = motionCycle > 4.12 && motionCycle < 4.5
        ? Math.sin(((motionCycle - 4.12) / 0.38) * Math.PI) * 0.065
        : 0;
      const landing = motionCycle > 5.45 && motionCycle < 5.88
        ? Math.sin(((motionCycle - 5.45) / 0.43) * Math.PI) * 0.075
        : 0;
      const partnerLift = naturalHop + reactionJump;
      const bodySquash = anticipation + landing - reactionRecoil;
      const weightShift = Math.sin(time * 0.92) * 0.032 + Math.sin(time * 0.27) * 0.016;

      humanSlot.position.y = Math.sin(time * 1.15) * 0.018;
      humanSlot.rotation.y = Math.sin(time * 0.38) * 0.025;
      pokemonSlot.position.y = partnerLift;
      pokemonSlot.position.x = weightShift + reactionRecoil * 0.2;
      pokemonSlot.position.z = Math.sin(time * 0.63) * 0.02 - reactionPower * 0.025;
      pokemonSlot.rotation.y = Math.sin(time * 0.58) * 0.055 + Math.sin(time * 0.19) * 0.025 + reactionRecoil * 0.8;
      pokemonSlot.rotation.z = Math.sin(time * 0.92) * 0.025 - reactionRecoil * 0.65;
      pokemonSlot.rotation.x = naturalHop * -0.07 + Math.sin(time * 0.7) * 0.012 - reactionPower * 0.035;
      pokemonSlot.scale.set(
        1 + bodySquash * 0.18,
        1 - bodySquash * 0.14,
        1 + bodySquash * 0.18,
      );
      partnerMotion?.update(time, reactionPower);

      electricField.userData.intensity = Math.max(0.12, electricField.userData.intensity - delta * 0.78);
      electricField.position.y = 1.5 + partnerLift;
      electricField.rotation.y += delta * (0.2 + electricField.userData.intensity * 1.4);
      electricField.userData.materials.forEach((material, index) => {
        material.opacity = (0.035 + electricField.userData.intensity * 0.5) * (0.58 + Math.sin(time * 9 + index) * 0.42);
      });
      const shockwave = electricField.userData.shockwave;
      if (reactionProgress >= 0) {
        shockwave.visible = true;
        shockwave.scale.setScalar(0.7 + reactionProgress * 2.2);
        shockwave.material.opacity = Math.sin(reactionProgress * Math.PI) * 0.78;
      } else {
        shockwave.visible = false;
      }

      stage.children[2].rotation.z += delta * 0.09;
      stage.children[2].material.opacity = 0.63 + Math.sin(time * 2.1) * 0.14;
      worldParticles.rotation.y -= delta * 0.035;
      worldParticles.position.y = Math.sin(time * 0.6) * 0.08;
    }
    controls.target.lerp(desiredTarget, reducedMotion ? 1 : 0.06);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    resize,
    load: loadScene,
    play() {
      visible = true;
      if (!dom.backgroundVideo.hidden) dom.backgroundVideo.play().catch(() => {});
    },
    pause() {
      visible = false;
    },
    celebrate(strength = 1.2) {
      focus('pokemon');
      triggerPartnerReaction(strength);
    },
  };
}

dom.toggleAudio.addEventListener('click', () => {
  if (dom.backgroundVideo.hidden) return;
  dom.backgroundVideo.muted = !dom.backgroundVideo.muted;
  dom.toggleAudio.classList.toggle('is-active', !dom.backgroundVideo.muted);
  dom.toggleAudio.setAttribute('aria-label', dom.backgroundVideo.muted ? 'Enable background video sound' : 'Mute background video');
});

dom.duoPanel.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  const rect = dom.duoPanel.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  dom.duoPanel.style.setProperty('--tilt-x', `${(-y * 2.2).toFixed(2)}deg`);
  dom.duoPanel.style.setProperty('--tilt-y', `${(x * 3).toFixed(2)}deg`);
  dom.duoPanel.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
  dom.duoPanel.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
});

dom.duoPanel.addEventListener('pointerleave', () => {
  dom.duoPanel.style.setProperty('--tilt-x', '0deg');
  dom.duoPanel.style.setProperty('--tilt-y', '0deg');
});

dom.saveMoment.addEventListener('click', () => {
  localStorage.setItem('pokimation:last-memory', new Date().toISOString());
  sceneApi?.celebrate(1.5);
  dom.toast.querySelector('p').textContent = activeSceneConfig?.confirmedToast || 'Partner confirmed!';
  dom.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), 2800);
});

window.addEventListener('beforeunload', () => {
  if (selectedImageUrl.startsWith('blob:')) URL.revokeObjectURL(selectedImageUrl);
});
