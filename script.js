import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

window.THREE = THREE;
const container = document.getElementById('scene');
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(0, 1.5, 2.6);

// expose debug handle so Console can inspect and adjust scene at runtime
window.__portfolio3d = {
  scene,
  camera,
  renderer,
  get model() { return model; },
  setModelYOffset(delta) {
    if (!model) { console.warn('model not loaded yet'); return null; }
    // sanitize current position
    const p = model.position;
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
      console.warn('model.position contained non-finite values, resetting to (0,0,0)');
      model.position.set(0,0,0);
    }
    const before = model.position.toArray();
    model.position.y += delta;
    const after = model.position.toArray();
    console.log('setModelYOffset before:', before, 'after:', after);
    return after;
  }
};

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0); scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.2); dir.position.set(5,10,7); scene.add(dir);

let model = null;
let modelSize = new THREE.Vector3();
let targetModelRotationY = 0;

let statusOverlay = document.getElementById('model-status');
if (!statusOverlay) {
  statusOverlay = document.createElement('div'); statusOverlay.id='model-status'; statusOverlay.className='model-status'; document.body.appendChild(statusOverlay);
}
statusOverlay.textContent = '3D model: initializing...';

// debug cube if no model
const debugGeo = new THREE.BoxGeometry(0.6,0.6,0.6);
const debugMat = new THREE.MeshStandardMaterial({ color:0xff4444 });
const debugCube = new THREE.Mesh(debugGeo, debugMat); debugCube.position.set(0,1.0,0); scene.add(debugCube);
let showDebugCube = true;

function resize(){
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  renderer.setSize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container); resize();

// attempt to load assets/me.glb relative to this module
const loader = new GLTFLoader();
const modelUrl = new URL('./assets/me.glb', import.meta.url).href;
loader.load(modelUrl,
  (gltf) => {
    // wrap the loaded scene in a stable root so translations/offsets apply reliably
    const modelRoot = new THREE.Object3D();
    modelRoot.name = 'modelRoot';
    // enable shadows / nice defaults on meshes
    gltf.scene.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.material && (n.material.side = THREE.DoubleSide); } });
    modelRoot.add(gltf.scene);
    model = modelRoot; // keep the existing 'model' handle but it's now the root container
    scene.add(model);

    // compute bbox and scale from the root
    const box = new THREE.Box3().setFromObject(model);
    box.getSize(modelSize);
    const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z) || 1;
    const scale = Math.max(0.03, Math.min(3, 1.1 / maxDim));
    model.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(model);
    box2.getSize(modelSize);

    // center root
    const center = new THREE.Vector3(); box2.getCenter(center);
    model.position.sub(center);

    // move model DOWN by the user-confirmed fraction of its bbox height (~15.58%)
    try {
      const downward = modelSize.y * 0.15581351405983007 || 0;
      model.position.y -= downward;
    } catch (e) { /* ignore */ }

    // SANITIZE model.position: ensure finite values (fix NaN/Infinity issues)
    try {
      const p = model.position;
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
        console.warn('Model position contained non-finite values, resetting to 0,0,0');
        p.set(0, 0, 0);
        model.position.copy(p);
      }
    } catch(e) { }

    // recompute bbox and sphere after shift
    const boxAfter = new THREE.Box3().setFromObject(model);
    boxAfter.getSize(modelSize);

    const sphere = new THREE.Sphere();
    boxAfter.getBoundingSphere(sphere);
    if (!isFinite(sphere.radius) || sphere.radius <= 0) {
      sphere.radius = Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.5 || 1.0;
    }

    // update center based on new bbox
    const newCenter = new THREE.Vector3(); boxAfter.getCenter(newCenter);

    // adjust camera for fuller appearance
    camera.fov = 50;
    const desiredFraction = 0.78;
    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    const distance = Math.abs(sphere.radius) / (Math.tan(fovRad * 0.5) * desiredFraction);
    camera.position.set(newCenter.x || 0, (newCenter.y || 0) + sphere.radius * 0.15, (newCenter.z || 0) + Math.abs(distance));
    // additionally lift the camera up by 25% of the bounding sphere radius (user requested)
    try { camera.position.y += Math.abs(sphere.radius) * 0.25; } catch(e) { /* ignore */ }
    camera.lookAt(newCenter);
    camera.updateProjectionMatrix();

    // move model DOWN by 30% of the page viewport height (in world units)
    try {
      const pageFraction = 0.30; // 30% of viewport
      const viewportWorldHeight = 2 * Math.abs(distance) * Math.tan(fovRad * 0.5);
      const extraDown = viewportWorldHeight * pageFraction;
      model.position.y -= extraDown;

      // additionally move model DOWN by another 10% of the viewport height (user requested)
      const extra10 = viewportWorldHeight * 0.10; // 10% more
      model.position.y -= extra10;
    } catch (e) { /* ignore */ }

    // enlarge model so the final scale is approximately 250% of the baseline (user requested)
    try { model.scale.multiplyScalar(2.5); } catch (e) { }

    // try to find a node that looks like the head (name contains 'head')
    let headNode = null;
    model.traverse((n) => {
      if (!headNode && n.name && /head/i.test(n.name)) headNode = n;
    });
    if (headNode) {
      const headWorld = new THREE.Vector3();
      headNode.getWorldPosition(headWorld);
      // compute delta between head and model center and shift camera to keep head centered
      const delta = headWorld.clone().sub(newCenter);
      camera.position.add(delta);
      camera.lookAt(headWorld);
      camera.updateProjectionMatrix();
      statusOverlay.textContent = `3D model: loaded (head centered, shifted down ~15.58% + 30% viewport)`;
    } else {
      statusOverlay.textContent = `3D model: loaded (bbox ${modelSize.toArray().map(n=>n.toFixed(3)).join('×')}, shifted down ~15.58% + 30% viewport)`;
    }

    // hide debug cube
    showDebugCube = false; debugCube.visible = false;
  },
  (xhr) => {
    if (xhr && xhr.loaded && xhr.total){ let pct = Math.round((xhr.loaded/xhr.total)*100); pct = Math.max(0,Math.min(100,pct)); statusOverlay.textContent = `3D model: loading ${pct}%`; }
  },
  (err) => {
    console.error('GLTF load error', err); statusOverlay.textContent = '3D model: not found or load error (place assets/me.glb)'; showDebugCube = true; debugCube.visible = true;
  }
);

// wheel-based scroll with resistance + snap-to-section
(function(){
  // use only main panels + footer as snap targets (exclude header which is fixed)
  function getSections(){ return Array.from(document.querySelectorAll('main .panel, footer')); }
  let sections = getSections();
  let pagePositions = sections.map(s => s.offsetTop);
  // refresh positions on resize or DOM changes
  window.addEventListener('resize', ()=>{ sections = getSections(); pagePositions = sections.map(s => s.offsetTop); });
  document.addEventListener('DOMContentLoaded', ()=>{ sections = getSections(); pagePositions = sections.map(s => s.offsetTop); });

  let currentPage = 0;
  let scrollAccum = 0;
  let scrollTimeout = null;
  const snapThreshold = 120; // pixels of accumulated wheel delta before snapping
  const snapResetMs = 220;

  function clampPage(i){ return Math.max(0, Math.min(pagePositions.length - 1, i)); }
  function doSnapVisual(direction){
    try{
      const mainEl = document.querySelector('main'); if(!mainEl) return;
      const cls = direction > 0 ? 'snap-bump-up' : 'snap-bump-down';
      // toggle class to trigger CSS transform animation
      mainEl.classList.remove('snap-bump-up','snap-bump-down');
      // force reflow
      void mainEl.offsetWidth;
      mainEl.classList.add(cls);
      setTimeout(()=>{ mainEl.classList.remove(cls); }, 300);
    }catch(e){/* ignore */}
  }
  function snapToPage(idx){
    idx = clampPage(idx);
    const dir = Math.sign(idx - currentPage) || 0;
    if(dir !== 0) doSnapVisual(dir);
    currentPage = idx;
    const top = pagePositions[idx] || 0; window.scrollTo({ top, behavior: 'smooth' }); // rotate model toward page index
    targetModelRotationY = idx * Math.PI * 1.2; }

  // gentle mapping while wheel is moving (resistance)
  window.addEventListener('wheel', (e)=>{
    // intercept default scroll so snapping feels consistent
    try{ e.preventDefault(); }catch(e){ /* ignore */ }
    // accumulate delta and apply resistant rotation influence
    const dy = e.deltaY;
    scrollAccum += dy;
    // small immediate rotation feedback (resisted)
    targetModelRotationY += dy * 0.0006; // tuned sensitivity

    // restart debounce
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(()=>{
      // if user scrolled enough, snap
      if (Math.abs(scrollAccum) > snapThreshold) {
        if (scrollAccum > 0) snapToPage(currentPage + 1); else snapToPage(currentPage - 1);
      } else {
        // not enough: smoothly return to currentPage's rotation target
        targetModelRotationY = currentPage * Math.PI * 1.2;
      }
      scrollAccum = 0;
    }, snapResetMs);
  }, { passive: false });

  // update currentPage on normal scroll (in case user uses page links / keyboard)
  window.addEventListener('scroll', ()=>{
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    // find nearest page
    let best = 0; let bestDist = Infinity;
    for (let i=0;i<pagePositions.length;i++){ const d = Math.abs((pagePositions[i]||0) - y); if (d < bestDist){ bestDist = d; best = i; } }
    currentPage = best;
  }, { passive: true });
})();

function renderLoop(){
  if (showDebugCube) debugCube.rotation.y += 0.02; else debugCube.rotation.y = 0;
  if (model) model.rotation.y += (targetModelRotationY - model.rotation.y) * 0.08;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(renderLoop);

document.addEventListener('visibilitychange', ()=>{ if (document.hidden) renderer.setAnimationLoop(null); else renderer.setAnimationLoop(renderLoop); });

// local test hint printed to console
console.log('Starter template loaded. To test locally: python -m http.server 8000 (from repo root) then open http://localhost:8000');