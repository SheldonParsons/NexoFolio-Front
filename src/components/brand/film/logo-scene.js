import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { TexturePass } from "three/addons/postprocessing/TexturePass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Obsidian from start to finish: two blades cut across each other along the
// N's diagonal, whip back around in a spiral of light, folding from blade to
// silk to shape too fast to read, join into the N, burst apart into bands,
// snap back together with a flash, take one light sweep, then lock up.
export const DURATION = 4.25;
// When the caption under the lockup should start to appear.
export const CAPTION_AT = 3.95;
// Match the canvas overscan in NexoLogoHero.vue. The extra area is for light,
// not a larger logo: the camera expands by the same factor.
const LIGHT_OVERSCAN = 1.8;
const assetRoot = `${import.meta.env.BASE_URL}nexofolio/film/`;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const progress = (a, b, t) => clamp((t - a) / (b - a));
const smooth = (a, b, t) => {
  const v = progress(a, b, t);
  return v * v * (3 - 2 * v);
};
const lerp = THREE.MathUtils.lerp;
const expoOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const cubicOut = (x) => 1 - Math.pow(1 - x, 3);
const cubicIn = (x) => x * x * x;

const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Beats, in seconds.
const SLASH = 0.42; // two blades cut across each other
const JOIN = 1.15; // they whip back around and join as the N
const SPLIT = [1.27, 1.53]; // the N bursts into bands
const CONTACT = 2.1; // bands snap back together: impact
const SWEEP = [2.25, 2.85]; // a specular band crosses the mark
const LOCK = [3.0, 3.6]; // mark shrinks left into the lockup
const WORD = [3.5, 4.1]; // wordmark wipes in

// Everything happens along the N's diagonal, where the halves come to rest.
const REST_ANGLE = Math.atan2(2.1, 3.4);
const DIAGONAL = { x: Math.cos(REST_ANGLE), y: Math.sin(REST_ANGLE) };
// Each blade enters this far out, cuts through center, and stops this far past it.
const REACH = [7, 2.2];
// The moment the two blades pass each other.
const PASS = SLASH * (1 - Math.cbrt(1 - REACH[0] / (REACH[0] + REACH[1])));
// Blade edge along the direction of travel.
const BLADE_RZ = REST_ANGLE - Math.PI / 2;
// Source-space y cuts that slice each half into three bands.
const CUTS = [-100, -0.75, 0.75, 100];
// Light trails: samples along each blade's recent path.
const TRAIL = 40;
const TRAIL_STEP = 0.006;

// A short-lived pulse that peaks at a beat.
function pulse(t, at, rise, decay) {
  const after = t - at;
  if (after < -rise) return 0;
  return after < 0 ? 1 + after / rise : Math.exp(-after * decay);
}

function motion(t, index, center, origin) {
  const sign = index === 0 ? -1 : 1;
  if (t < SLASH) {
    // Parallel lines, opposite directions, one in front of the other.
    const along = sign * lerp(-REACH[0], REACH[1], cubicOut(t / SLASH));
    const offset = 0.5 * sign * (1 - smooth(0.2, SLASH, t));
    return {
      x: origin.x + DIAGONAL.x * along - DIAGONAL.y * offset,
      y: origin.y + DIAGONAL.y * along + DIAGONAL.x * offset,
      z: 1.2 * offset,
      rx: sign * 0.5,
      // Roll the edge through the light as it cuts.
      ry: sign * 0.8 * Math.sin((Math.PI * t) / SLASH),
      rz: BLADE_RZ,
      blade: 1,
      ribbon: 0,
      scale: 0.8,
      compression: 0,
    };
  }
  // From the end of the cut, whip one full turn inward to the rest pose.
  const whip = progress(SLASH, JOIN, t);
  const swirl = -Math.PI * 2 * Math.pow(1 - whip, 3);
  const form = inOut(progress(0.55, JOIN - 0.05, t));
  const angle = REST_ANGLE + (index === 0 ? Math.PI : 0) + swirl;
  const radius = REACH[1] * (1 - inOut(whip));
  const after = t - CONTACT;
  const spring = after > 0 ? Math.sin(after * 26) * Math.exp(-after * 11) : 0;
  const loose = 1 - form;
  return {
    x: lerp(origin.x, center.x, form) + Math.cos(angle) * radius,
    y: lerp(origin.y, center.y, form) + Math.sin(angle) * radius,
    // The two strands pass in front of and behind each other.
    z: sign * Math.sin(swirl) * 0.8 * loose,
    rx: sign * 0.5 * loose,
    // Whole turns, so the whip starts exactly where the cut ended.
    ry: sign * swirl,
    rz: BLADE_RZ * loose + swirl * 2,
    blade: 1 - smooth(SLASH, 0.62, t),
    ribbon: smooth(SLASH, 0.6, t) * (1 - smooth(0.75, 1.05, t)),
    scale: lerp(0.8, 1, form) * (1 + 0.03 * spring),
    compression: 0.1 * spring,
  };
}

// Additive light: adds to color and coverage so the page shows around it.
function lightMaterial(vertexShader, fragmentShader) {
  return new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}

function makeStreak() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 1.6),
    lightMaterial(
      `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      `uniform float uAlpha;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float core = exp(-p.y * p.y * 900.0) * exp(-p.x * p.x * 4.0);
          float haze = exp(-p.y * p.y * 40.0) * exp(-p.x * p.x * 9.0) * 0.28;
          float light = (core + haze) * uAlpha;
          gl_FragColor = vec4(vec3(0.86, 0.9, 0.96) * light, light);
        }`,
    ),
  );
  mesh.renderOrder = 10;
  mesh.visible = false;
  return mesh;
}

// A ribbon of light following one blade; positions are rewritten each frame.
function makeTrail() {
  const along = new Float32Array(TRAIL * 2),
    side = new Float32Array(TRAIL * 2),
    index = [];
  for (let i = 0; i < TRAIL; i++) {
    along[i * 2] = along[i * 2 + 1] = i / (TRAIL - 1);
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    if (i < TRAIL - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 6), 3));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(
    geometry,
    lightMaterial(
      `attribute float aAlong;
        attribute float aSide;
        varying float vAlong;
        varying float vSide;
        void main() { vAlong = aAlong; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      `uniform float uAlpha;
        varying float vAlong;
        varying float vSide;
        void main() {
          float fade = pow(1.0 - vAlong, 1.6);
          float light = (exp(-vSide * vSide * 12.0) + exp(-vSide * vSide * 2.5) * 0.25) * fade * uAlpha;
          gl_FragColor = vec4(vec3(0.84, 0.89, 0.97) * light, light);
        }`,
    ),
  );
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

export function createLogoScene(host, cb) {
  let renderer,
    composer,
    sceneTarget,
    texturePass,
    edgePass,
    outputPass,
    compositePass,
    bloom,
    scene,
    camera,
    rig,
    wordmark,
    wordMaterial,
    wordTexture,
    model,
    matcap;
  let disposed = false,
    loaded = false,
    visible = true,
    raf = 0,
    last = 0,
    lastUI = 0,
    time = 0,
    hold = 0,
    idleTime = 0,
    drawnAt = -1,
    settledQuality = false,
    playing = false,
    loop = false,
    speed = 1,
    observer;
  let parts = [],
    echoes = [],
    shards = [],
    trails = [],
    streak,
    cut;
  const materials = [],
    media = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches;
  const textReveal = { value: 0 };
  const contact = new THREE.Vector3();
  function makeMaterial(center, extent, alpha = 1, cutMin = -100, cutMax = 100) {
    const uniforms = {
      uCenter: { value: center.clone() },
      uExtent: { value: extent.clone() },
      uRibbon: { value: 0 },
      uBlade: { value: 0 },
      uPhase: { value: 0 },
      uWhite: { value: 0 },
      uAlpha: { value: alpha },
      uSweep: { value: -6 },
      uSweepStrength: { value: 0 },
      uCutMin: { value: cutMin },
      uCutMax: { value: cutMax },
    };
    const material = new THREE.MeshMatcapMaterial({
      matcap,
      color: 0xffffff,
      transparent: true,
      depthWrite: alpha === 1,
      side: THREE.DoubleSide,
    });
    material.userData.motion = uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader =
        "uniform vec3 uCenter;\nuniform vec3 uExtent;\nuniform float uRibbon;\nuniform float uBlade;\nuniform float uPhase;\nvarying vec3 vLogoPosition;\nvarying float vSourceY;\n" +
        shader.vertexShader;
      // uBlade thins the half into a long curved blade; uRibbon stretches it
      // into a strip of silk whose wave travels with uPhase.
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `
    vSourceY=transformed.y;
    vec3 centered=transformed-uCenter;
    vec3 n=centered/uExtent;
    float wave=n.y*1.8+uPhase;
    float twist=n.y*2.2+uPhase*0.7;
    vec3 ribbon=vec3(sin(wave)*0.55+n.x*0.42*cos(twist),n.y*2.5,cos(wave)*0.36+n.x*0.42*sin(twist)+n.z*0.1);
    vec3 blade=vec3(n.x*0.3*(1.0-n.y*n.y*0.75)+n.y*n.y*0.35,n.y*2.6,n.z*0.12);
    transformed=mix(centered,ribbon,uRibbon);
    transformed=mix(transformed,blade,uBlade);
    #include <project_vertex>
    vLogoPosition=(modelMatrix*vec4(transformed,1.0)).xyz;
   `,
      );
      shader.fragmentShader =
        "uniform float uWhite;\nuniform float uBlade;\nuniform float uAlpha;\nuniform float uSweep;\nuniform float uSweepStrength;\nuniform float uCutMin;\nuniform float uCutMax;\nvarying vec3 vLogoPosition;\nvarying float vSourceY;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
    if(vSourceY<uCutMin || vSourceY>=uCutMax) discard;
   `,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
    float edge=pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),2.0);
    float band=exp(-pow((vLogoPosition.x+vLogoPosition.y*0.3-uSweep)/0.48,2.0));
    vec3 silver=vec3(0.62,0.66,0.72)+gl_FragColor.rgb*1.4+edge*vec3(0.34);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,silver,uWhite);
    // A cold edge light while it is a blade.
    gl_FragColor.rgb+=vec3(0.5,0.56,0.64)*edge*uBlade*0.2;
    gl_FragColor.rgb+=vec3(0.36,0.40,0.46)*band*uSweepStrength*(0.45+edge*0.55);
    gl_FragColor.a*=uAlpha;
   `,
      );
    };
    materials.push(material);
    return material;
  }
  function apply(mesh, part, t, alpha) {
    const p = motion(t, part.index, part.center, contact);
    mesh.position.set(p.x, p.y, p.z);
    mesh.rotation.set(p.rx, p.ry, p.rz);
    mesh.scale.setScalar(p.scale);
    mesh.morphTargetInfluences[part.jellyIndex] = p.compression;
    const u = mesh.material.userData.motion;
    u.uRibbon.value = p.ribbon;
    u.uBlade.value = p.blade;
    u.uPhase.value = t * 9 * (part.index === 0 ? -1 : 1);
    // Obsidian throughout; only the impact flashes.
    u.uWhite.value = 0.45 * pulse(t, CONTACT, 0.02, 18);
    u.uAlpha.value = alpha;
    u.uSweep.value = -5 + 10 * smooth(SWEEP[0], SWEEP[1], t);
    u.uSweepStrength.value =
      smooth(SWEEP[0], SWEEP[0] + 0.15, t) * (1 - smooth(SWEEP[1] - 0.15, SWEEP[1], t));
  }
  function pose() {
    const intro = smooth(0, 0.08, time),
      exit = loop && hold > 0.85 ? 1 - smooth(0.85, 1.2, hold) : 1;
    const lock = smooth(LOCK[0], LOCK[1], time);
    const after = time - CONTACT;
    const impact = after > 0 ? Math.sin(after * 22) * Math.exp(-after * 9) : 0;
    rig.scale.setScalar(lerp(1 + 0.04 * impact, 0.48, lock));
    rig.position.set(-3.1 * lock, 0.12 * lock, 0);
    // Burst out fast, drift apart a little, then accelerate back into contact.
    const split =
      expoOut(progress(SPLIT[0], SPLIT[1], time)) * (1 - cubicIn(progress(CONTACT - 0.32, CONTACT, time)));
    const drift = 1 + 0.25 * progress(SPLIT[0], CONTACT - 0.32, time);
    for (const p of parts) {
      apply(p.mesh, p, time, intro * exit);
      p.mesh.visible = split < 0.001;
    }
    for (const s of shards) {
      const sign = s.part.index === 0 ? -1 : 1,
        direction = s.band === 1 ? -1 : 1,
        amount = split * drift;
      apply(s.mesh, s.part, time, intro * exit);
      s.mesh.position.x += sign * (0.55 + s.band * 0.3) * amount;
      s.mesh.position.y += (s.band - 1) * 0.6 * amount;
      s.mesh.position.z += direction * 0.7 * amount;
      s.mesh.rotation.y += sign * direction * 0.4 * amount;
      s.mesh.rotation.z += sign * (s.band - 1) * 0.12 * amount;
      s.mesh.visible = split >= 0.001;
    }
    // Motion blur while the blades cut and whip in.
    const blur = smooth(0.02, 0.05, time) * (1 - smooth(0.85, JOIN, time));
    for (const e of echoes) {
      apply(e.mesh, e.part, Math.max(0, time - e.order * 0.016), (0.12 / e.order) * blur * intro * exit);
      e.mesh.visible = blur > 0.001;
    }
    // Light trails behind each blade, fading once the whip tightens.
    const glow = smooth(0.01, 0.06, time) * (1 - smooth(0.7, 0.95, time)) * exit;
    for (const trail of trails) {
      trail.mesh.visible = glow > 0.002;
      if (!trail.mesh.visible) continue;
      trail.mesh.material.uniforms.uAlpha.value = glow;
      // Long straight cuts; short comet arcs once the whip spins, so the two
      // never close into a ring.
      const step = TRAIL_STEP * (1 - 0.7 * smooth(SLASH - 0.05, SLASH + 0.1, time));
      const points = [];
      for (let i = 0; i < TRAIL; i++)
        points.push(motion(Math.max(0, time - i * step), trail.part.index, trail.part.center, contact));
      const position = trail.mesh.geometry.attributes.position;
      for (let i = 0; i < TRAIL; i++) {
        const a = points[Math.max(0, i - 1)],
          b = points[Math.min(TRAIL - 1, i + 1)];
        const dx = a.x - b.x,
          dy = a.y - b.y,
          length = Math.hypot(dx, dy) || 1;
        const width = 0.16 * (1 - i / (TRAIL - 1)),
          nx = (-dy / length) * width,
          ny = (dx / length) * width,
          p = points[i];
        // Behind the blade, so the light spills out around its edges.
        position.setXYZ(i * 2, p.x - nx, p.y - ny, p.z - 1.2);
        position.setXYZ(i * 2 + 1, p.x + nx, p.y + ny, p.z - 1.2);
      }
      position.needsUpdate = true;
    }
    // A hairline flash along the diagonal as the blades pass each other.
    const pass = pulse(time, PASS, 0.015, 11) * exit;
    cut.visible = pass > 0.002;
    cut.material.uniforms.uAlpha.value = 0.75 * pass;
    cut.position.copy(rig.localToWorld(contact.clone()));
    cut.position.z -= 3;
    cut.quaternion.copy(camera.quaternion);
    // The camera is rolled -8°, so the diagonal reads 8° steeper on screen.
    cut.rotateZ(REST_ANGLE + THREE.MathUtils.degToRad(8));
    cut.scale.set(0.3 + 0.9 * expoOut(clamp((time - PASS) / 0.3)), 0.7, 1);
    // Anamorphic streak at the moment of contact.
    const flash = pulse(time, CONTACT, 0.02, 7) * exit;
    streak.visible = flash > 0.002;
    streak.material.uniforms.uAlpha.value = flash;
    streak.position.copy(rig.localToWorld(contact.clone()));
    // Behind the mark: the light escapes around it rather than across it.
    streak.position.z -= 3;
    streak.quaternion.copy(camera.quaternion);
    streak.scale.set(0.3 + 0.8 * expoOut(clamp(after / 0.5)), 1, 1);
    if (wordmark) {
      const reveal = cubicOut(progress(WORD[0], WORD[1], time));
      textReveal.value = reveal;
      wordMaterial.opacity = smooth(WORD[0], WORD[0] + 0.2, time) * exit;
      wordmark.position.set(1.28 + 0.3 * (1 - reveal), 0.12, 0);
      wordmark.quaternion.copy(camera.quaternion);
      wordmark.visible = time > WORD[0];
    }
    bloom.strength = Math.max(0.07, 0.28 * pulse(time, CONTACT, 0.03, 9), 0.2 * pulse(time, PASS, 0.02, 12));
  }
  function draw() {
    if (!loaded || disposed) return;
    pose();
    renderer.setRenderTarget(sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    composer.render();
    drawnAt = time;
    float();
  }
  // Once settled, the lockup gently drifts by a few pixels. The finished frame
  // is moved on the compositor rather than re-rendered through the whole light
  // chain, so idling costs next to nothing and moves at full frame rate.
  function float() {
    const canvas = renderer.domElement;
    const amount = reduced ? 0 : smooth(0, 1.5, idleTime);
    if (!amount) {
      canvas.style.transform = "";
      return;
    }
    // World units along the camera's screen axes, to CSS pixels.
    const e = camera.matrixWorld.elements,
      k = canvas.clientHeight / (camera.top - camera.bottom);
    const screen = (x, y) => [(x * e[0] + y * e[1]) * k, -(x * e[4] + y * e[5]) * k];
    const [dx, dy] = screen(
      Math.sin(idleTime * 0.55) * 0.018 * amount,
      Math.sin(idleTime * 0.85) * 0.045 * amount,
    );
    // Turn around the mark's own origin, as the rig did.
    const [ox, oy] = screen(rig.position.x, rig.position.y);
    canvas.style.transformOrigin = `calc(50% + ${ox}px) calc(50% + ${oy}px)`;
    canvas.style.transform = `translate(${dx}px, ${dy}px) rotate(${-Math.sin(idleTime * 0.65) * 0.006 * amount}rad)`;
  }
  function notify() {
    cb.onFrame(time);
    cb.onPlay(playing);
  }
  function frame(now) {
    raf = 0;
    if (disposed || !loaded || document.hidden || !visible) {
      last = 0;
      return;
    }
    const dt = last ? Math.min((now - last) / 1000, 0.08) : 0;
    last = now;
    if (playing) {
      if (time < DURATION) time = Math.min(DURATION, time + dt * speed);
      else if (loop) {
        hold += dt;
        if (hold >= 1.2) {
          time = 0;
          hold = 0;
        }
      } else {
        playing = false;
        cb.onPlay(false);
      }
    }
    const floating = !reduced && !loop && time >= DURATION;
    if (time >= DURATION && !settledQuality) {
      settledQuality = true;
      resize();
    }
    if (floating) idleTime += dt;
    if (!floating || drawnAt !== time) draw();
    else float();
    if (now - lastUI > 30) {
      cb.onFrame(time);
      lastUI = now;
    }
    if (playing || floating) wake();
  }
  function wake() {
    if (!raf && !disposed && loaded && visible && !document.hidden)
      raf = requestAnimationFrame(frame);
  }
  function replay() {
    if (!loaded) return;
    time = 0;
    hold = 0;
    idleTime = 0;
    playing = true;
    last = 0;
    notify();
    wake();
  }
  function seek(v) {
    if (!loaded) return;
    time = clamp(v, 0, DURATION);
    hold = 0;
    idleTime = 0;
    playing = false;
    last = 0;
    notify();
    draw();
  }
  function toggle() {
    if (!loaded) return;
    if (playing) {
      playing = false;
      hold = 0;
      draw();
      notify();
    } else {
      if (time >= DURATION) {
        time = 0;
        hold = 0;
      }
      playing = true;
      last = 0;
      notify();
      wake();
    }
  }
  function resize() {
    if (!renderer || disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height,
      h = Math.max(7.6, 11 / aspect);
    Object.assign(camera, {
      left: (-h * aspect * LIGHT_OVERSCAN) / 2,
      right: (h * aspect * LIGHT_OVERSCAN) / 2,
      top: (h * LIGHT_OVERSCAN) / 2,
      bottom: (-h * LIGHT_OVERSCAN) / 2,
    });
    camera.updateProjectionMatrix();
    const renderWidth = Math.round(width * LIGHT_OVERSCAN);
    const renderHeight = Math.round(height * LIGHT_OVERSCAN);
    // Fine matcap highlights alias inside polygons too: MSAA alone cannot fix
    // them. Use a denser final frame plus color-edge AA before bloom.
    const finalFrame = time >= DURATION;
    const preferredDpr = finalFrame
      ? Math.max(devicePixelRatio || 1, 3)
      : Math.max(devicePixelRatio || 1, 2);
    const pixelBudget = finalFrame ? 10_000_000 : 6_000_000;
    const gl = renderer.getContext();
    const maxDimension = Math.min(renderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    const dpr = Math.min(preferredDpr, 3, Math.sqrt(pixelBudget / (renderWidth * renderHeight)), maxDimension / renderWidth, maxDimension / renderHeight);
    renderer.setPixelRatio(dpr);
    renderer.setSize(renderWidth, renderHeight, false);
    sceneTarget?.setSize(Math.round(renderWidth * dpr), Math.round(renderHeight * dpr));
    composer?.setPixelRatio(dpr);
    composer?.setSize(renderWidth, renderHeight);
    draw();
  }
  function visibility() {
    last = 0;
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else wake();
  }
  function preference() {
    reduced = media.matches;
    if (reduced) {
      loop = false;
      seek(DURATION);
      cb.onReady(true);
    } else wake();
  }
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    last = 0;
    if (visible) wake();
    else { cancelAnimationFrame(raf); raf = 0; }
  });
  intersection.observe(host);
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "NexoFolio 品牌短片：两道刀锋沿对角线交错划过，拖着光轨回旋合成 N，分裂成数段后重新相接，随后落版",
    );
    host.append(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-6, 6, 4.5, -4.5, 0.1, 80);
    camera.position.set(1.4, 1.05, 16);
    camera.lookAt(0, 0, 0);
    camera.rotateZ(THREE.MathUtils.degToRad(-8));
    rig = new THREE.Group();
    scene.add(rig);
    // Renderer antialias does not affect composer render targets. Resolve scene
    // coverage with MSAA before bloom, and keep that alpha independently.
    sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, renderer.capabilities.maxSamples),
    });
    composer = new EffectComposer(renderer);
    texturePass = new TexturePass(sceneTarget.texture);
    composer.addPass(texturePass);
    // SMAA detects the thin bright bevel as well as the silhouette; running it
    // in linear color before bloom keeps the soft light separate from the edge.
    edgePass = new SMAAPass();
    // The N is nearly black; SMAA's default 0.1 luma threshold skips its
    // thin grey bevel against black. Detect that lower-contrast contour too.
    edgePass._materialEdges.defines.SMAA_THRESHOLD = '0.025';
    edgePass._materialEdges.needsUpdate = true;
    composer.addPass(edgePass);
    bloom = new UnrealBloomPass(new THREE.Vector2(600, 400), 0.3, 0.35, 0.55);
    composer.addPass(bloom);
    outputPass = new OutputPass();
    composer.addPass(outputPass);
    // Bloom's full-screen alpha must not obscure the page background. Rebuild
    // straight alpha from MSAA coverage and the final display-space light.
    // Over black, RGB * alpha equals the original film output (no screen blend).
    compositePass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, tCoverage: { value: sceneTarget.texture } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse;
        uniform sampler2D tCoverage;
        varying vec2 vUv;
        void main() {
          vec3 color = texture2D(tDiffuse, vUv).rgb;
          float coverage = clamp(texture2D(tCoverage, vUv).a, 0.0, 1.0);
          // No distance-to-rectangle mask: it imprints four straight edges on
          // a wide bloom. Fade only the far light in the overscan area radially.
          float radius = length((vUv - 0.5) * 2.0);
          float feather = 1.0 - smoothstep(0.60, 0.98, radius);
          color *= mix(feather, 1.0, coverage);
          float light = clamp(max(color.r, max(color.g, color.b)), 0.0, 1.0);
          float alpha = max(coverage, light);
          gl_FragColor = alpha > 0.00001 ? vec4(color / alpha, alpha) : vec4(0.0);
        }`,
    });
    compositePass.material.toneMapped = false;
    compositePass.material.depthTest = false;
    compositePass.material.depthWrite = false;
    compositePass.material.blending = THREE.NoBlending;
    composer.addPass(compositePass);
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      playing = false;
      cb.onPlay(false);
      cb.onError();
    });
    Promise.allSettled([
      new GLTFLoader().loadAsync(`${assetRoot}nexofolio-elastic.glb`),
      new THREE.TextureLoader().loadAsync(`${assetRoot}black-matcap.png`),
      new THREE.TextureLoader().loadAsync(`${assetRoot}nexofolio-text.svg`),
    ])
      .then((results) => {
        const failed = results.find((result) => result.status === "rejected");
        if (disposed || failed) {
          for (const result of results) {
            if (result.status !== "fulfilled") continue;
            if (result.value.scene) {
              result.value.scene.traverse((o) => {
                o.geometry?.dispose();
                if (o.material) for (const m of [].concat(o.material)) m.dispose();
              });
            } else result.value.dispose();
          }
          if (!disposed && failed) throw failed.reason;
          return;
        }
        const [gltf, texture, word] = results.map((result) => result.value);
        model = gltf.scene;
        matcap = texture;
        wordTexture = word;
        matcap.colorSpace = THREE.SRGBColorSpace;
        wordTexture.colorSpace = THREE.SRGBColorSpace;
        const originals = new Set();
        parts = ["Left_Obsidian", "Right_Prismatic"].map((name, index) => {
          const mesh = model.getObjectByName(name);
          if (!mesh) throw new Error("Missing logo mesh");
          originals.add(mesh.material);
          mesh.geometry.computeBoundingBox();
          const box = mesh.geometry.boundingBox,
            center = box.getCenter(new THREE.Vector3()),
            extent = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
          const part = {
            mesh,
            index,
            center,
            extent,
            jellyIndex: mesh.morphTargetDictionary.Jelly_Compression,
          };
          mesh.removeFromParent();
          mesh.material = makeMaterial(center, extent);
          rig.add(mesh);
          const trail = makeTrail();
          rig.add(trail);
          trails.push({ mesh: trail, part });
          for (let order = 1; order <= 2; order++) {
            const echo = mesh.clone();
            echo.material = makeMaterial(center, extent, 0.12 / order);
            echo.renderOrder = -order;
            rig.add(echo);
            echoes.push({ mesh: echo, part, order });
          }
          for (let band = 0; band < 3; band++) {
            const shard = mesh.clone();
            shard.material = makeMaterial(center, extent, 1, CUTS[band], CUTS[band + 1]);
            rig.add(shard);
            shards.push({ mesh: shard, part, band });
          }
          return part;
        });
        originals.forEach((m) => m.dispose());
        contact.copy(parts[0].center).add(parts[1].center).multiplyScalar(0.5);
        streak = makeStreak();
        cut = makeStreak();
        scene.add(cut);
        scene.add(streak);
        wordMaterial = new THREE.MeshBasicMaterial({
          map: wordTexture,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        wordMaterial.onBeforeCompile = (shader) => {
          shader.uniforms.uTextReveal = textReveal;
          shader.fragmentShader =
            "uniform float uTextReveal;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `#include <map_fragment>
    if(vMapUv.x>uTextReveal) discard;
    diffuseColor.rgb=vec3(0.94);
   `,
          );
        };
        wordmark = new THREE.Mesh(
          new THREE.PlaneGeometry(5.55, (5.55 * 154) / 750),
          wordMaterial,
        );
        scene.add(wordmark);
        // Compile every shader and upload every texture before playing, so
        // nothing stalls mid-film when a blade, the cut, the shards or the
        // wordmark first appear. Programs differ when drawing to the scene
        // target, so compile against it.
        renderer.initTexture(matcap);
        renderer.initTexture(wordTexture);
        renderer.setRenderTarget(sceneTarget);
        const compiled = renderer.compileAsync(scene, camera);
        renderer.setRenderTarget(null);
        return compiled;
      })
      .then(() => {
        if (disposed || !wordmark) return;
        loaded = true;
        time = reduced ? DURATION : 0;
        playing = !reduced;
        loop = false;
        // First draw also builds the post-processing passes; the clock starts
        // on the next frame, so that cost is never taken from the film.
        resize();
        cb.onReady(reduced);
        notify();
        wake();
      })
      .catch((e) => {
        if (!disposed) {
          console.error("Logo preview failed", e);
          cb.onError();
        }
      });
  } catch (e) {
    console.error("WebGL initialization failed", e);
    cb.onError();
  }
  return {
    replay,
    seek,
    toggle,
    setSpeed(v) {
      speed = v;
    },
    setLoop(v) {
      loop = v;
      hold = 0;
      draw();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", preference);
      parts.forEach((p) => p.mesh.geometry.dispose());
      materials.forEach((m) => m.dispose());
      for (const light of [streak, cut, ...trails.map((t) => t.mesh)]) {
        light?.geometry.dispose();
        light?.material.dispose();
      }
      wordmark?.geometry.dispose();
      wordMaterial?.dispose();
      wordTexture?.dispose();
      matcap?.dispose();
      texturePass?.dispose();
      edgePass?.dispose();
      bloom?.dispose();
      outputPass?.dispose();
      compositePass?.dispose();
      composer?.dispose();
      sceneTarget?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    },
  };
}
