// 3D teacher: a rigged, licence-cleared human VRM model (see README for the credit) rendered with three.js.
// Same small API as teacher.js: gesture(name), speaking(bool), mouthLevel(v).
// Arm/hand poses are driven by the model's humanoid bones. No lip-sync claims: the mouth just follows speech activity.
const D = Math.PI / 180;
// pose per gesture: [upperArmZ, upperArmX, lowerArmY, lowerArmX] in degrees for the RIGHT arm (left mirrors unless overridden)
const POSE = {
  rest:    { r: [72, 4, 8],    l: [72, 4, 8] },
  explain: { r: [46, 36, 82],  l: [46, 36, 82] },
  point:   { r: [40, 62, 18],  l: [72, 4, 8] },
  wave:    { r: [-30, 8, 85],  l: [72, 4, 8] },
  think:   { r: [42, 40, 142], l: [72, 4, 8] },
  nod:     { r: [66, 8, 24],   l: [66, 8, 24] },
};
export async function createTeacher3D(host, modelUrl) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
  const W = host.clientWidth || 220, H = host.clientHeight || 260;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 20);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4e0, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1.2, 2, 2.5); scene.add(key);
  const loader = new GLTFLoader(); loader.register(p => new VRMLoaderPlugin(p));
  const gltf = await loader.loadAsync(modelUrl);
  const vrm = gltf.userData.vrm; VRMUtils.removeUnnecessaryVertices?.(gltf.scene); VRMUtils.rotateVRM0?.(vrm);
  scene.add(vrm.scene);
  const B = n => vrm.humanoid.getNormalizedBoneNode(n);
  const bones = { ruA: B('rightUpperArm'), luA: B('leftUpperArm'), rlA: B('rightLowerArm'), llA: B('leftLowerArm'), head: B('head'), neck: B('neck'), spine: B('spine'), chest: B('chest'), rH: B('rightHand'), lH: B('leftHand') };
  // frame the upper body
  const hb = B('head').getWorldPosition(new THREE.Vector3());
  camera.position.set(0, hb.y - 0.02, 2.7); camera.lookAt(0, hb.y - 0.3, 0);
  let gest = 'rest', speaking = false, ext = null, mouth = 0, mouthT = 0, lastPulse = 0, nextBlink = 1500, blink = -1;
  const cur = { r: [...POSE.rest.r], l: [...POSE.rest.l] };
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime, now = performance.now();
    const P = POSE[gest] || POSE.rest;
    let osc = 0;
    if (speaking) osc = gest === 'wave' ? Math.sin(t * 8) * 14 : Math.sin(t * 3.2) * 4;
    for (let i = 0; i < 3; i++) {
      cur.r[i] += ((P.r[i] + (i === 2 ? osc : 0)) - cur.r[i]) * Math.min(1, dt * 5);
      cur.l[i] += (P.l[i] - cur.l[i]) * Math.min(1, dt * 5);
    }
    // VRM normalized rig: arms rest in a T pose; rotate down about Z (right arm -z, left arm +z)
    bones.ruA.rotation.set(0, cur.r[1] * D, -cur.r[0] * D);
    bones.rlA.rotation.set(0, cur.r[2] * D, 0);
    bones.luA.rotation.set(0, -cur.l[1] * D, cur.l[0] * D);
    bones.llA.rotation.set(0, -cur.l[2] * D, 0);
    // idle: breathing, small head motion, nod while speaking
    const br = Math.sin(t * 1.4) * 0.006;
    bones.chest.rotation.x = br; bones.spine.rotation.x = br * 0.5;
    bones.head.rotation.set((speaking ? Math.sin(t * 2.6) * 2.2 : Math.sin(t * 0.8) * 0.8) * D + (gest === 'nod' ? Math.sin(t * 6) * 5 * D : 0), (speaking ? Math.sin(t * 1.1) * 3 : Math.sin(t * 0.5) * 1.5) * D, 0);
    // mouth follows speech activity (no phoneme lip-sync)
    if (speaking) { if (ext !== null) mouthT = ext; else if (now - lastPulse > 120) { mouthT = 0.2 + Math.random() * 0.6; lastPulse = now; } } else mouthT = 0;
    mouth += (mouthT - mouth) * 0.4;
    // blink
    nextBlink -= dt * 1000; let bl = 0;
    if (nextBlink < 0 && blink < 0) { blink = 0; nextBlink = 2200 + Math.random() * 2600; }
    if (blink >= 0) { blink += dt * 1000; bl = Math.max(0, 1 - Math.abs(blink - 90) / 90); if (blink > 180) blink = -1; }
    const em = vrm.expressionManager;
    if (em) { em.setValue('aa', mouth * 0.7); em.setValue('blink', bl); if (speaking || gest === 'wave') em.setValue('happy', 0.25); else em.setValue('happy', 0.12); }
    vrm.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (w && h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
  new ResizeObserver(resize).observe(host);
  return { gesture: g => { gest = POSE[g] ? g : 'explain'; }, speaking: v => { speaking = v; }, mouthLevel: v => { ext = v; }, _vrm: vrm, _renderer: renderer };
}
