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

// globals
let model = null;
let modelSize = new THREE.Vector3();
let modelCenter = new THREE.Vector3();
let headTarget = new THREE.Vector3(0, 1.2, 0); // fallback

const loader = new GLTFLoader();
loader.load('./me.glb', // 改成 './assets/me.glb' 如果你把模型放到 assets/
  (gltf) => {
    model = gltf.scene;

    // compute bbox, scale, center
    const box = new THREE.Box3().setFromObject(model);
    box.getSize(modelSize);
    box.getCenter(modelCenter);

    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const scale = (1.2) / (maxDim || 1);
    model.scale.setScalar(scale);

    box.setFromObject(model);
    box.getSize(modelSize);
    box.getCenter(modelCenter);

    model.position.sub(modelCenter);
    model.position.y -= 0.05;

    // estimate head target (adjust multiplier if needed)
    headTarget.set(0, modelSize.y * 0.22 - 0.05, 0);

    scene.add(model);

    // ensure camera initially looks at head
    camera.lookAt(headTarget);
  },
  undefined,
  (err) => { console.error('GLTF load error:', err); }
);

// resize
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);
resize();

// sections -> presets
const hero = document.querySelector('.hero');
const panels = Array.from(document.querySelectorAll('main .panel'));
const sections = hero ? [hero, ...panels] : panels;

const sectionPresets = sections.map((_, i) => {
  const baseY = 1.6;
  const deltaY = 0.35;
  const baseZ = 3.0;
  const deltaZ = 0.6;
  return { pos: new THREE.Vector3(0, baseY - i * deltaY, baseZ + i * deltaZ) };
});

let currentPreset = 0;
const cameraTargetPos = new THREE.Vector3().copy(camera.position);
let cameraTargetLook = headTarget.clone();
const cameraTmpObj = new THREE.Object3D();

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = sections.indexOf(entry.target);
      if (idx >= 0 && idx !== currentPreset) {
        currentPreset = idx;
        cameraTargetPos.copy(sectionPresets[idx].pos);
        cameraTargetLook = headTarget.clone();
      }
    }
  });
}, { threshold: 0.55 });

sections.forEach(s => io.observe(s));

// stable render loop with guard
let loopRunning = false;
function renderLoop() {
  // smooth position
  camera.position.lerp(cameraTargetPos, 0.08);

  // smooth lookAt via quaternion slerp
  cameraTmpObj.position.copy(camera.position);
  cameraTmpObj.lookAt(cameraTargetLook);
  camera.quaternion.slerp(cameraTmpObj.quaternion, 0.08);

  // tiny idle rotation so it's not dead-still
  if (model) model.rotation.y += 0.0004;

  renderer.render(scene, camera);
}

function startLoop() {
  if (!loopRunning) {
    renderer.setAnimationLoop(renderLoop);
    loopRunning = true;
  }
}
function stopLoop() {
  if (loopRunning) {
    renderer.setAnimationLoop(null);
    loopRunning = false;
  }
}

// start once
startLoop();

// pause/resume on visibility change (uses guard so we don't repeatedly toggle)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLoop();
  else startLoop();
});
