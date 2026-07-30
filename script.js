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
camera.position.set(0, 1.2, 3);

// lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(5, 10, 7);
scene.add(dir);

// ground-ish subtle light
const amb = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(amb);

// load model
let model = null;
const loader = new GLTFLoader();

// NOTE: your me.glb is at the repository root. Load from './me.glb' to match its current location.
loader.load('./me.glb',
  (gltf) => {
    model = gltf.scene;
    // center & scale model so it fits nicely
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (1.2) / (maxDim || 1);
    model.scale.setScalar(scale);

    // recalc bbox after scale and center
    box.setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center); // center at origin

    // small down offset so model sits a little lower
    model.position.y -= 0.1;

    scene.add(model);
  },
  undefined,
  (err) => {
    console.error('GLTF load error:', err);
  }
);

// handle resizing
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);
resize();

// scroll-driven rotation
let targetY = 0;
let targetX = 0;
let currentY = 0;
let currentX = 0;
const turns = 2.0; // 總共轉幾圈，根據需求調整

function updateTargets() {
  const scrollTop = window.scrollY || window.pageYOffset;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? scrollTop / docHeight : 0;
  // Y 軸依 progress 完成多圈旋轉
  targetY = progress * Math.PI * 2 * turns;
  // X 軸做輕微仰/俯 tilt（讓模型在頂部/底部有不同角度）
  targetX = (progress - 0.5) * 0.6; // 範圍約 -0.3 .. +0.3
}
window.addEventListener('scroll', updateTargets, { passive: true });
updateTargets();

// animation loop
const lerp = (a, b, t) => a + (b - a) * t;
function animate() {
  requestAnimationFrame(animate);
  currentY = lerp(currentY, targetY, 0.08);
  currentX = lerp(currentX, targetX, 0.08);

  if (model) {
    model.rotation.y = currentY;
    model.rotation.x = currentX;
  }

  renderer.render(scene, camera);
}
animate();

// Optional: reduce rendering when tab not visible (節能)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) renderer.setAnimationLoop(null);
  else renderer.setAnimationLoop(animate);
});
