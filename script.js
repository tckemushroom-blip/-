// script.js (module)
import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

const container = document.getElementById('scene');

// create renderer
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// camera
const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(0, 1.5, 2.6); // slightly closer than before

// lights (increased intensity to ensure visibility)
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.8);
dir.position.set(5, 10, 7);
scene.add(dir);
const amb = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(amb);

// debug helper: grid + axes (only visible in dev if needed)
// const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222); scene.add(grid);

// globals
let model = null;
let modelSize = new THREE.Vector3();
let modelCenter = new THREE.Vector3();
let headTarget = new THREE.Vector3(0, 1.2, 0); // fallback

// debug cube to confirm renderer is working
const debugGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const debugMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
const debugCube = new THREE.Mesh(debugGeo, debugMat);
debugCube.position.set(0, 1.0, 0);
scene.add(debugCube);
let showDebugCube = false; // set true temporarily to see cube

const loader = new GLTFLoader();

// NOTE: load from repo root './me.glb' (change to './assets/me.glb' if you move the file)
loader.load('./me.glb',
  (gltf) => {
    console.log('GLTF loaded', gltf);
    model = gltf.scene;

    // compute bounding box and log sizes for debugging
    const boxBefore = new THREE.Box3().setFromObject(model);
    const sizeBefore = new THREE.Vector3();
    boxBefore.getSize(sizeBefore);
    console.log('Model bbox before scale:', sizeBefore);

    // scale & center model
    const maxDim = Math.max(sizeBefore.x, sizeBefore.y, sizeBefore.z);
    const scale = (1.15) / (maxDim || 1);
    model.scale.setScalar(scale);

    const box = new THREE.Box3().setFromObject(model);
    box.getSize(modelSize);
    box.getCenter(modelCenter);

    model.position.sub(modelCenter);
    model.position.y -= 0.05;

    console.log('Model bbox after scale:', modelSize, 'modelCenter:', modelCenter, 'model.position:', model.position);

    // set head target based on model size
    headTarget.set(0, modelSize.y * 0.22 - 0.05, 0);

    scene.add(model);

    // hide debug cube once model is visible
    showDebugCube = false;
  },
  (xhr) => {
    // progress - optional
    if (xhr && xhr.loaded && xhr.total) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      // console.log('Model loading: ' + pct + '%');
    }
  },
  (err) => {
    console.error('GLTF load error:', err);
    // keep debug cube visible to indicate renderer working
    showDebugCube = true;
  }
);

// resize handling
function resize() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);
resize();

// sections and presets
const hero = document.querySelector('.hero');
const panels = Array.from(document.querySelectorAll('main .panel'));
const sections = hero ? [hero, ...panels] : panels;

const sectionPresets = sections.map((_, i) => {
  const baseY = 1.6;
  const deltaY = 0.25; // smaller vertical deltas
  const baseZ = 2.6; // closer base distance
  const deltaZ = 0.35; // smaller Z change between sections
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
        console.log('Switching to preset', idx, cameraTargetPos.toArray());
      }
    }
  });
}, { threshold: 0.55 });
sections.forEach(s => io.observe(s));

// render loop
function renderLoop() {
  // animate debug cube if visible
  if (showDebugCube) debugCube.rotation.y += 0.03;
  else debugCube.rotation.y = 0;

  // smooth camera pos
  camera.position.lerp(cameraTargetPos, 0.08);

  // smooth lookAt via quaternion
  cameraTmpObj.position.copy(camera.position);
  cameraTmpObj.lookAt(cameraTargetLook);
  camera.quaternion.slerp(cameraTmpObj.quaternion, 0.08);

  if (model) model.rotation.y += 0.0005;

  renderer.render(scene, camera);
}

// stable start
let loopPaused = false;
renderer.setAnimationLoop(renderLoop);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!loopPaused) { renderer.setAnimationLoop(null); loopPaused = true; console.log('Render loop paused'); }
  } else {
    if (loopPaused) { renderer.setAnimationLoop(renderLoop); loopPaused = false; console.log('Render loop resumed'); }
  }
});
