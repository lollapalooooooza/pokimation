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
  demo: document.querySelector('#demo-button'),
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
  backgroundVideo: document.querySelector('#background-video'),
  assetStatus: document.querySelector('#asset-status'),
  saveMoment: document.querySelector('#save-moment'),
  toast: document.querySelector('#toast'),
};

let selectedImageUrl = '';
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

function setMemoryImage(url, label) {
  if (selectedImageUrl && selectedImageUrl.startsWith('blob:')) URL.revokeObjectURL(selectedImageUrl);
  selectedImageUrl = url;
  dom.memoryImage.src = url;
  dom.memoryImage.alt = `${label || 'Uploaded'} original card memory`;
  dom.memoryDate.textContent = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

async function acceptFile(file) {
  const error = validateImage(file);
  if (error) {
    showError(error);
    return;
  }

  showError();
  setMemoryImage(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''));
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
dom.demo.addEventListener('click', async () => {
  setMemoryImage(resolveAsset('assets/original/pokemon.jpg'), 'Golden Gate Pikachu');
  await enterWorld();
});

async function enterWorld() {
  if (transitionRunning) return;
  transitionRunning = true;
  dom.transition.classList.add('is-active');
  dom.transition.setAttribute('aria-hidden', 'false');

  const duration = reducedMotion ? 260 : 1850;
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
  const particles = Array.from({ length: reducedMotion ? 24 : 150 }, (_, index) => {
    const angle = (index / 150) * Math.PI * 10 + Math.random();
    const distance = 90 + Math.random() * Math.max(width, height) * 0.7;
    return {
      angle,
      distance,
      radius: 1.5 + Math.random() * 5,
      color: colors[index % colors.length],
      offset: Math.random() * 0.15,
      spin: (Math.random() - 0.5) * 2.4,
    };
  });
  const started = performance.now();

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
      context.globalAlpha = Math.sin(local * Math.PI) * 0.92;
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

function createStage() {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3.25, 96),
    new THREE.MeshStandardMaterial({ color: 0xf1d88a, roughness: 0.8, metalness: 0.05, transparent: true, opacity: 0.84 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.28, 0.025, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xf05f58, transparent: true, opacity: 0.72 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.015;

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(2.35, 2.38, 96),
    new THREE.MeshBasicMaterial({ color: 0x4aa99b, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.025;
  group.add(ground, ring, innerRing);
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

async function getAssetConfig() {
  try {
    const response = await fetch(resolveAsset('assets/scene-config.json'));
    if (!response.ok) throw new Error('Missing scene config');
    return await response.json();
  } catch (error) {
    console.warn('Pokimation is using preview scene assets.', error);
    return {};
  }
}

async function createThreeScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const defaultCamera = new THREE.Vector3(0, 2.5, 8.6);
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
  controls.target.set(0, 1.45, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 5.5;
  controls.maxDistance = 12;
  controls.minPolarAngle = Math.PI * 0.24;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.35;

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

  const stage = createStage();
  const humanSlot = new THREE.Group();
  const pokemonSlot = new THREE.Group();
  const trainer = createTrainer();
  const partner = createPartner();
  humanSlot.add(trainer);
  pokemonSlot.add(partner);
  scene.add(stage, humanSlot, pokemonSlot);

  const worldParticles = createWorldParticles();
  scene.add(worldParticles);
  const mixers = [];
  const timer = new THREE.Timer();
  timer.connect(document);
  const desiredTarget = new THREE.Vector3(0, 1.45, 0);
  let playing = true;
  let visible = true;

  const config = await getAssetConfig();
  const configuredAssets = [config.humanModel, config.pokemonModel].filter(Boolean).length;

  if (config.backgroundVideo) {
    dom.backgroundVideo.src = resolveAsset(config.backgroundVideo);
    dom.backgroundVideo.load();
    dom.backgroundVideo.play().catch(() => {});
    dom.toggleAudio.disabled = false;
  }

  const draco = new DRACOLoader();
  draco.setDecoderPath(resolveAsset('draco/'));
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  async function replacePreview(slot, path, targetHeight, xPosition, label, rotationY = 0) {
    if (!path) return false;
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
      model.position.set(xPosition - center.x, -scaledBox.min.y + 0.04, -center.z);
      model.rotation.y = rotationY;
      slot.clear();
      slot.add(model);
      if (gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
        mixers.push(mixer);
      }
      return true;
    } catch (error) {
      console.warn(`Could not load ${label} model; keeping the preview companion.`, error);
      return false;
    }
  }

  const results = await Promise.all([
    replacePreview(humanSlot, config.humanModel, 3.45, -1.2, 'human', config.humanRotationY),
    replacePreview(pokemonSlot, config.pokemonModel, 2.35, 1.25, 'Pokémon', config.pokemonRotationY),
  ]);
  const loadedCount = results.filter(Boolean).length;
  dom.assetStatus.textContent = loadedCount
    ? `${loadedCount}/2 production companion${loadedCount === 1 ? '' : 's'} loaded`
    : configuredAssets
      ? 'Using preview companions · check asset paths'
      : 'Preview companions · ready for your assets';

  function resize() {
    const rect = dom.threeRoot.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.fov = camera.aspect < 0.9 ? 44 : 34;
    camera.updateProjectionMatrix();
  }

  new ResizeObserver(resize).observe(dom.threeRoot);

  function focus(mode) {
    const x = mode === 'human' ? -1.15 : mode === 'pokemon' ? 1.15 : 0;
    desiredTarget.set(x, mode === 'pokemon' ? 1.2 : 1.45, 0);
    dom.focusButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.focus === mode));
    controls.autoRotate = mode === 'duo' && !reducedMotion;
  }

  dom.focusButtons.forEach((button) => button.addEventListener('click', () => focus(button.dataset.focus)));
  dom.resetCamera.addEventListener('click', () => {
    camera.position.copy(defaultCamera);
    desiredTarget.set(0, 1.45, 0);
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
      if (trainer.userData.preview) {
        trainer.position.y = 0.15 + Math.sin(time * 1.25) * 0.035;
        trainer.rotation.y = Math.sin(time * 0.48) * 0.08;
      }
      if (partner.userData.preview) {
        partner.position.y = 0.1 + Math.sin(time * 2.1) * 0.09;
        partner.rotation.y = -0.08 + Math.sin(time * 0.8) * 0.13;
      }
      stage.children[1].rotation.z += delta * 0.08;
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
    play() {
      visible = true;
      dom.backgroundVideo.play().catch(() => {});
    },
    pause() {
      visible = false;
    },
  };
}

dom.toggleAudio.addEventListener('click', () => {
  dom.backgroundVideo.muted = !dom.backgroundVideo.muted;
  dom.toggleAudio.classList.toggle('is-active', !dom.backgroundVideo.muted);
  dom.toggleAudio.setAttribute('aria-label', dom.backgroundVideo.muted ? 'Enable background video sound' : 'Mute background video');
});

dom.saveMoment.addEventListener('click', () => {
  localStorage.setItem('pokimation:last-memory', new Date().toISOString());
  dom.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), 2800);
});

window.addEventListener('beforeunload', () => {
  if (selectedImageUrl.startsWith('blob:')) URL.revokeObjectURL(selectedImageUrl);
});
