// script.js (module)
import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

const container = document.getElementById('scene');

// renderer + scene + camera
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(0, 1.5, 3);

// lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(5, 10, 7);
scene.add(dir);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// globals for model
let model = null;
let modelSize = new THREE.Vector3();
let modelCenter = new THREE.Vector3();
let headTarget = new THREE.Vector3(0, 1.2, 0); // fallback target (in case model not loaded yet)

const loader = new GLTFLoader();

loader.load('./me.glb',
  (gltf) => {
    model = gltf.scene;

    // compute bounding box
    const box = new THREE.Box3().setFromObject(model);
    box.getSize(modelSize);
    box.getCenter(modelCenter);

    // scale to a reasonable size
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const scale = (1.2) / (maxDim || 1);
    model.scale.setScalar(scale);

    // recalc bbox after scale
    box.setFromObject(model);
    box.getSize(modelSize);
    box.getCenter(modelCenter);

    // center model at origin
    model.position.sub(modelCenter);
    model.position.y -= 0.05;

    // estimate head/face target above center
    headTarget.set(0, modelSize.y * 0.2 - 0.05, 0);

    scene.add(model);

    // ensure initial camera looks at headTarget
    camera.lookAt(headTarget);
  },
  undefined,
  (err) => {
    console.error('GLTF load error:', err);
  }
);

// resize handling
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);
resize();

// SECTION-DRIVEN CAMERA PRESETS
// include header.hero as the first section (if exists) + all main .panel sections
const hero = document.querySelector('.hero');
const panels = Array.from(document.querySelectorAll('main .panel'));
const sections = hero ? [hero, ...panels] : panels;

// camera presets computed per section
const sectionPresets = sections.map((sec, i) => {
  const baseY = 1.6; // camera height for first section
  const deltaY = 0.35; // decrease per section
  const baseZ = 3.0; // camera distance for first section
  const deltaZ = 0.6; // increase per section

  const y = baseY - i * deltaY;
  const z = baseZ + i * deltaZ;

  return {
    pos: new THREE.Vector3(0, y, z),
    // optional yaw adjustments could be added here
  };
});

// targets for smooth animation
let currentPreset = 0;
const cameraTargetPos = new THREE.Vector3().copy(camera.position);
let cameraTargetLook = headTarget.clone();

const cameraTmpObj = new THREE.Object3D();

// IntersectionObserver to detect main visible section
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = sections.indexOf(entry.target);
      if (idx >= 0 && idx !== currentPreset) {
        currentPreset = idx;
        const preset = sectionPresets[idx];
        cameraTargetPos.copy(preset.pos);
        // ensure look target uses current headTarget (may not be set until model loads)
        cameraTargetLook = headTarget.clone();
      }
    }
  });
}, { threshold: 0.55 });

sections.forEach(s => io.observe(s));

// animation loop: smooth camera moves & lookAt interpolation
function animate() {
  requestAnimationFrame(animate);

  // if model not yet loaded, headTarget remains fallback; otherwise it's updated on load
  // Smoothly move camera position
  camera.position.lerp(cameraTargetPos, 0.08);

  // Smoothly interpolate orientation to look at cameraTargetLook
  cameraTmpObj.position.copy(camera.position);
  cameraTmpObj.lookAt(cameraTargetLook);
  camera.quaternion.slerp(cameraTmpObj.quaternion, 0.08);

  // subtle idle movement (very small) to avoid perfectly static background
  if (model) {
    model.rotation.y += 0.0005; // almost imperceptible slow motion
  }

  renderer.render(scene, camera);
}
animate();

// reduce rendering when not visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) renderer.setAnimationLoop(null);
  else renderer.setAnimationLoop(animate);
});
