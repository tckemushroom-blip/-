// script.js (module)
import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

// Expose THREE globally to make Console debugging easier
window.THREE = THREE;

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
// target rotation (radians) driven by page scroll
let targetModelRotationY = 0;

// Expose a minimal debug object early so Console can access scene/camera/renderer even before model loads
window.__portfolio3d = {
  scene,
  camera,
  renderer,
  get model() { return model; },
  headTarget,
  // debugCube will be attached below; provide a safe stub for debugShowCube for early access
  debugShowCube: (v = true) => { showDebugCube = v; console.log('debug cube visible (flag):', showDebugCube); }
};

// debug cube to confirm renderer is working
const debugGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const debugMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
const debugCube = new THREE.Mesh(debugGeo, debugMat);
debugCube.position.set(0, 1.0, 0);
scene.add(debugCube);
// show debug cube by default so an indicator appears if model fails to load
let showDebugCube = true; // default visible for debugging

// status overlay (index.html also contains a #model-status element; fall back to creating one)
let statusOverlay = document.getElementById('model-status');
if (!statusOverlay) {
  statusOverlay = document.createElement('div');
  statusOverlay.id = 'model-status';
  statusOverlay.setAttribute('aria-hidden', 'true');
  statusOverlay.style.cssText = 'position:fixed;bottom:12px;left:12px;padding:8px 12px;background:rgba(0,0,0,0.6);color:#fff;border-radius:6px;font-family:system-ui;font-size:13px;z-index:9999;pointer-events:none;';
  statusOverlay.textContent = '3D model: initializing...';
  document.body.appendChild(statusOverlay);
} else {
  statusOverlay.textContent = '3D model: initializing...';
}

// attach debugCube reference and replace debugShowCube with a direct controller
window.__portfolio3d.debugCube = debugCube;
window.__portfolio3d.debugShowCube = (v = true) => {
  debugCube.visible = !!v;
  showDebugCube = !!v;
  console.log('debug cube visible:', debugCube.visible);
};

const loader = new GLTFLoader();

// NOTE: resolve me.glb relative to this module file so it works under Pages sub-paths
const modelUrl = new URL('./me.glb', import.meta.url).href;
loader.load(modelUrl,
  (gltf) => {
    console.log('GLTF loaded', gltf);
    model = gltf.scene;

    try { statusOverlay.textContent = '3D model: loaded'; } catch (e) {}
    // hide debug cube when model is visible
    showDebugCube = false;
    debugCube.visible = false;

    // compute bounding box and log sizes for debugging
    const boxBefore = new THREE.Box3().setFromObject(model);
    const sizeBefore = new THREE.Vector3();
    boxBefore.getSize(sizeBefore);
    console.log('Model bbox before scale:', sizeBefore);

    // scale & center model
    const maxDim = Math.max(sizeBefore.x, sizeBefore.y, sizeBefore.z);
    let scale = (1.15) / (maxDim || 1);
    // clamp scale to avoid extremely small/large models
    scale = Math.max(0.03, Math.min(3, scale));
    model.scale.setScalar(scale);

    const box = new THREE.Box3().setFromObject(model);
    box.getSize(modelSize);
    box.getCenter(modelCenter);

    model.position.sub(modelCenter);
    model.position.y -= 0.05;

    console.log('Model bbox after scale:', modelSize, 'modelCenter:', modelCenter, 'model.position:', model.position);

    // set head target based on model size
    headTarget.set(0, modelSize.y * 0.22 - 0.05, 0);

    // fit camera to model bounding sphere so model is guaranteed in view
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const fitFactor = 1.6;
    const fitDist = sphere.radius * fitFactor;
    // position camera slightly above center and back along Z
    camera.position.set(modelCenter.x, modelCenter.y + sphere.radius * 0.9, modelCenter.z + fitDist);
    camera.lookAt(modelCenter);
    camera.updateProjectionMatrix();
    // update camera targets used by the animation loop
    cameraTargetPos.copy(camera.position);
    cameraTargetLook = modelCenter.clone();

    scene.add(model);

    // ensure model and its meshes are visible and have usable material settings
    model.traverse((n) => {
      if (n.isMesh) {
        n.visible = true;
        if (n.material) {
          try { n.material.side = THREE.DoubleSide; } catch(e) { /* ignore */ }
          try { n.material.needsUpdate = true; } catch(e) { }
        }
        try { n.castShadow = true; n.receiveShadow = true; } catch(e) { }
      }
    });

    try { statusOverlay.textContent = `3D model: loaded (bbox ${modelSize.toArray().map(v=>v.toFixed(3)).join('×')})`; } catch(e) { }

    // hide debug cube once model is visible
    showDebugCube = false;
    debugCube.visible = false;

    // START observing sections only after model is added — avoids camera race conditions
    sections.forEach(s => io.observe(s));
  },
  (xhr) => {
    // progress - optional
    if (xhr && xhr.loaded && xhr.total) {
      let pct = Math.round((xhr.loaded / xhr.total) * 100);
      pct = Math.max(0, Math.min(100, pct)); // clamp 0..100 to avoid >100
      // update overlay with percent
      try { statusOverlay.textContent = `3D model: loading ${pct}%`; } catch (e) { /* ignore */ }
    }
  },
  (err) => {
    console.error('GLTF load error:', err);
   try { statusOverlay.textContent = `3D model: load error`; } catch (e) { }
   // keep debug cube visible to indicate renderer working
   showDebugCube = true;
 }
);

// update overlay on successful load
// (already inside onLoad we set showDebugCube=false)
(function attachLoadOverlayHook(){
 const originalOnLoad = null; // placeholder - handled directly in loader callbacks above
})();


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

// sections and presets (define but don't observe yet)
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

// update targetModelRotationY from page scroll (0..1 -> 0..4π = 2 full rotations)
window.addEventListener('scroll', () => {
  const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const viewHeight = window.innerHeight;
  const maxScroll = Math.max(1, docHeight - viewHeight);
  const t = window.scrollY / maxScroll;
  targetModelRotationY = t * Math.PI * 4; // 2 full rotations across the entire page
}, { passive: true });

// create IO but DO NOT observe until model is loaded (sections.forEach moved into loader success)
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

  if (model) {
    // smooth toward scroll-driven target rotation
    model.rotation.y += (targetModelRotationY - model.rotation.y) * 0.08;
  }

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
