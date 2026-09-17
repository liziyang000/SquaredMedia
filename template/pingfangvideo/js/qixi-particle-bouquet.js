// Keep this module separate from the classic script used by the Next frontend.
import * as THREE from "./third-party/three/three.module.min.js";
import { GLTFLoader } from "./third-party/three/GLTFLoader.js";
import { MeshSurfaceSampler } from "./third-party/three/MeshSurfaceSampler.js";
import { mergeGeometries } from "./third-party/three/BufferGeometryUtils.js";

const MODEL_URL = new URL("../images/qixi/qixi-bouquet.glb?v=a931cafa7bfe", import.meta.url).href;
const BOUQUET_HEIGHT = 4.8;
const root = document.querySelector("[data-qixi-rose]");

if (root) initQixiRose(root);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function surfaceArea(geometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  let area = 0;

  const faceCount = index ? index.count / 3 : position.count / 3;
  for (let face = 0; face < faceCount; face += 1) {
    const first = index ? index.getX(face * 3) : face * 3;
    const second = index ? index.getX(face * 3 + 1) : face * 3 + 1;
    const third = index ? index.getX(face * 3 + 2) : face * 3 + 2;
    a.fromBufferAttribute(position, first);
    b.fromBufferAttribute(position, second);
    c.fromBufferAttribute(position, third);
    edgeA.subVectors(b, a);
    edgeB.subVectors(c, a);
    area += edgeA.cross(edgeB).length() * 0.5;
  }

  return area;
}

function toFloatAttribute(attribute) {
  const values = new Float32Array(attribute.count * attribute.itemSize);
  for (let index = 0; index < attribute.count; index += 1) {
    for (let component = 0; component < attribute.itemSize; component += 1) {
      values[index * attribute.itemSize + component] = attribute.getComponent(index, component);
    }
  }
  return new THREE.Float32BufferAttribute(values, attribute.itemSize);
}

function standardizeGeometry(sourceGeometry, worldMatrix, normalizationMatrix) {
  let geometry = sourceGeometry.clone();

  for (const name of ["position", "normal", "uv"]) {
    const attribute = geometry.getAttribute(name);
    if (attribute && (attribute.normalized || attribute.isInterleavedBufferAttribute || !(attribute.array instanceof Float32Array))) {
      geometry.setAttribute(name, toFloatAttribute(attribute));
    }
  }

  geometry.applyMatrix4(worldMatrix);
  geometry.applyMatrix4(normalizationMatrix);

  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "uv") geometry.deleteAttribute(name);
  }

  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  if (!geometry.getAttribute("uv")) {
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  }

  geometry.clearGroups();
  geometry.morphAttributes = {};
  geometry.morphTargetsRelative = false;
  return geometry;
}

function isPetalMaterial(material) {
  return material.name.toLowerCase().includes("petal");
}

function isLeafMaterial(material) {
  const name = material.name.toLowerCase();
  return name.includes("leaf") || name.includes("smallplants1") || name.includes("smallplants2");
}

function samplingWeightForMaterial(material) {
  const name = material.name.toLowerCase();
  if (isPetalMaterial(material)) return 1.4;
  if (name.includes("stem")) return 2.6;
  if (name.includes("ribbon")) return 2.2;
  if (name.includes("smallplant")) return 1.35;
  if (name.includes("leaf")) return 1.15;
  return 1;
}

function texturePixelsForMaterial(material) {
  const texture = material.map;
  const image = texture?.image;
  if (!image?.width || !image?.height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.min(128, image.width);
  canvas.height = Math.min(128, image.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    texture.updateMatrix();
    return {
      texture,
      width: canvas.width,
      height: canvas.height,
      pixels: context.getImageData(0, 0, canvas.width, canvas.height).data
    };
  } catch {
    return null;
  }
}

function textureShadeAt(texturePixels, uv, emphasizePetals) {
  if (!texturePixels) return 1;
  const { texture, width, height, pixels } = texturePixels;
  texture.transformUv(uv);
  const x = Math.min(width - 1, Math.max(0, Math.floor(uv.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(uv.y * height)));
  const offset = (y * width + x) * 4;
  const brightness = (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255;
  if (emphasizePetals) {
    const contrast = brightness * brightness * (3 - brightness * 2);
    return 0.48 + contrast * 0.72;
  }
  return 0.55 + brightness * 0.6;
}

function particleColorForMaterial(material) {
  const name = material.name.toLowerCase();
  if (isPetalMaterial(material)) {
    const petalNumber = Number(name.match(/\d+/)?.[0] || 1);
    const petalPalette = ["#ff76b3", "#ffacce", "#7295ff", "#a4c2ff"];
    return new THREE.Color(petalPalette[(petalNumber - 1) % petalPalette.length]);
  }
  if (isLeafMaterial(material)) return new THREE.Color("#4b8a5a");
  if (name.includes("stem")) return new THREE.Color("#8a603f");
  if (name.includes("smallplant")) return new THREE.Color("#d5b2bf");
  if (name.includes("ribbon")) return new THREE.Color("#e2c284");
  return material.color.clone();
}

function createBouquetSurfaces(sourceScene) {
  const sourceBouquet = sourceScene;
  sourceScene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(sourceBouquet);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error("The bouquet model has invalid bounds.");

  const scale = BOUQUET_HEIGHT / size.y;
  const normalizationMatrix = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  const materialGroups = new Map();

  sourceBouquet.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
    if (!sourceMaterial) return;

    const geometry = standardizeGeometry(object.geometry, object.matrixWorld, normalizationMatrix);
    const group = materialGroups.get(sourceMaterial.uuid) || { sourceMaterial, geometries: [] };
    group.geometries.push(geometry);
    materialGroups.set(sourceMaterial.uuid, group);
  });

  if (!materialGroups.size) throw new Error("The bouquet model has no renderable meshes.");

  const surfaces = [];

  for (const entry of materialGroups.values()) {
    // The source Leaves6 atlas exposes broken UV islands as large black planes.
    if (entry.sourceMaterial.name === "Leaves6") {
      for (const sourceGeometry of entry.geometries) sourceGeometry.dispose();
      continue;
    }
    const geometry = mergeGeometries(entry.geometries, false);
    for (const sourceGeometry of entry.geometries) sourceGeometry.dispose();
    if (!geometry) throw new Error(`Unable to merge bouquet material: ${entry.sourceMaterial.name}`);

    const mesh = new THREE.Mesh(geometry);
    mesh.name = `qixi-${entry.sourceMaterial.name || "bouquet"}`;
    surfaces.push({
      mesh,
      area: surfaceArea(geometry),
      weight: samplingWeightForMaterial(entry.sourceMaterial),
      isPetal: isPetalMaterial(entry.sourceMaterial),
      texturePixels: texturePixelsForMaterial(entry.sourceMaterial),
      color: particleColorForMaterial(entry.sourceMaterial)
    });
  }

  return surfaces;
}

function createParticles(surfaces, particleCount, pixelRatio) {
  const totalArea = surfaces.reduce((sum, surface) => sum + surface.area * surface.weight, 0);
  const allocations = surfaces.map((surface) => {
    const exact = ((surface.area * surface.weight) / totalArea) * particleCount;
    return { surface, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let assigned = allocations.reduce((sum, allocation) => sum + allocation.count, 0);
  allocations.sort((a, b) => b.remainder - a.remainder);

  for (let index = 0; assigned < particleCount; index += 1, assigned += 1) {
    allocations[index % allocations.length].count += 1;
  }

  const positions = new Float32Array(particleCount * 3);
  const starts = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const normals = new Float32Array(particleCount * 3);
  const petals = new Float32Array(particleCount);
  const spins = new Float32Array(particleCount);
  const delays = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);
  const target = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const uv = new THREE.Vector2();
  let particleIndex = 0;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (const allocation of allocations) {
    const sampler = new MeshSurfaceSampler(allocation.surface.mesh).build();

    for (let count = 0; count < allocation.count; count += 1) {
      sampler.sample(target, normal, undefined, uv);
      const offset = particleIndex * 3;
      const height = clamp(target.y / BOUQUET_HEIGHT + 0.5, 0, 1);
      const angle = particleIndex * goldenAngle + Math.random() * 0.45;
      const radius = 1.25 + Math.random() * 1.9 * (1 - height * 0.24);
      const brightness = (0.88 + Math.random() * 0.18) * textureShadeAt(allocation.surface.texturePixels, uv, allocation.surface.isPetal);

      positions[offset] = target.x;
      positions[offset + 1] = target.y;
      positions[offset + 2] = target.z;
      starts[offset] = target.x * 0.12 + Math.cos(angle) * radius;
      starts[offset + 1] = -BOUQUET_HEIGHT * 0.72 - Math.random() * 1.15 + height * 0.22;
      starts[offset + 2] = target.z * 0.12 + Math.sin(angle) * radius;
      colors[offset] = Math.min(1, allocation.surface.color.r * brightness);
      colors[offset + 1] = Math.min(1, allocation.surface.color.g * brightness);
      colors[offset + 2] = Math.min(1, allocation.surface.color.b * brightness);
      normals[offset] = normal.x;
      normals[offset + 1] = normal.y;
      normals[offset + 2] = normal.z;
      petals[particleIndex] = allocation.surface.isPetal ? 1 : 0;
      spins[particleIndex] = Math.random() * Math.PI * 2;
      delays[particleIndex] = 0.05 + height * 0.43 + Math.random() * 0.1;
      sizes[particleIndex] = (1.4 + Math.pow(Math.random(), 1.8) * 1.25) * 1.1 * (allocation.surface.isPetal ? 1.16 : 1);
      particleIndex += 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aStart", new THREE.Float32BufferAttribute(starts, 3));
  geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aNormal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aPetal", new THREE.Float32BufferAttribute(petals, 1));
  geometry.setAttribute("aSpin", new THREE.Float32BufferAttribute(spins, 1));
  geometry.setAttribute("aDelay", new THREE.Float32BufferAttribute(delays, 1));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));

  const uniforms = {
    uProgress: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uTime: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uProgress;
      uniform float uPixelRatio;
      uniform float uTime;
      attribute vec3 aStart;
      attribute vec3 aColor;
      attribute vec3 aNormal;
      attribute float aPetal;
      attribute float aSpin;
      attribute float aDelay;
      attribute float aSize;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vPetal;
      varying float vSpin;

      void main() {
        float moveProgress = smoothstep(aDelay, min(1.0, aDelay + 0.33), uProgress);
        vec3 transformed = mix(aStart, position, moveProgress);
        transformed.x += sin(uTime * 0.0017 + aDelay * 29.0) * (1.0 - moveProgress) * 0.07;
        transformed.z += cos(uTime * 0.0013 + aDelay * 23.0) * (1.0 - moveProgress) * 0.06;
        float appear = smoothstep(aDelay - 0.13, aDelay + 0.015, uProgress);
        vec3 viewNormal = normalize(normalMatrix * aNormal);
        float keyLight = max(dot(viewNormal, normalize(vec3(0.35, 0.72, 0.58))), 0.0);
        float facing = abs(viewNormal.z);
        vColor = aColor * (0.78 + keyLight * 0.22 + facing * 0.08);
        vAlpha = appear * mix(0.18, 1.0, moveProgress) * (0.78 + facing * 0.22);
        vPetal = aPetal;
        vSpin = aSpin;

        vec4 modelViewPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * modelViewPosition;
        gl_PointSize = aSize * mix(0.35, 1.0, moveProgress) * uPixelRatio * (8.0 / max(4.0, -modelViewPosition.z));
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vPetal;
      varying float vSpin;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float spinCos = cos(vSpin);
        float spinSin = sin(vSpin);
        vec2 rotated = vec2(centered.x * spinCos - centered.y * spinSin, centered.x * spinSin + centered.y * spinCos);
        float circleDistance = length(centered);
        float petalDistance = length(vec2(rotated.x * 1.5, rotated.y * 0.86));
        float distanceToCenter = mix(circleDistance, petalDistance, vPetal);
        float coreAlpha = 1.0 - smoothstep(0.32, 0.49, distanceToCenter);
        float haloAlpha = 1.0 - smoothstep(0.44, 0.5, distanceToCenter);
        float alpha = vAlpha * (coreAlpha * 0.94 + haloAlpha * 0.06);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const points = new THREE.Points(geometry, material);
  points.name = "qixi-surface-particles";
  points.frustumCulled = false;
  points.renderOrder = 2;
  return { points, uniforms };
}

function initQixiRose(page) {
  const canvas = page.querySelector("[data-qixi-canvas]");
  const bloomButton = page.querySelector("[data-qixi-bloom]");
  const shareButton = page.querySelector("[data-qixi-share]");
  const status = page.querySelector("[data-qixi-status]");
  if (!canvas || !status) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isLowPowerDevice = window.innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  const particleCount = isLowPowerDevice ? 60000 : 112000;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 8.6);
  const bouquetRoot = new THREE.Group();
  bouquetRoot.rotation.set(-0.08, -0.24, 0.02);
  scene.add(bouquetRoot);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !isLowPowerDevice,
      powerPreference: "high-performance"
    });
  } catch {
    status.textContent = "当前浏览器无法显示3D粒子花束，请尝试更新浏览器。";
    if (bloomButton) bloomButton.disabled = true;
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  let particleSystem = null;
  let ready = false;
  let phase = "loading";
  let animationElapsed = 0;
  let animationDuration = 3200;
  let isEntranceAnimation = false;
  let animationRotationStart = bouquetRoot.rotation.y;
  let frameRequest = 0;
  let previousFrameTime = 0;
  let activePointerId = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let rotationStartX = 0;
  let rotationStartY = 0;
  let didDrag = false;
  let isInViewport = true;
  let isDocumentVisible = !document.hidden;

  function revealPageCopy() {
    page.classList.add("is-entering");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => page.classList.add("is-entered"));
    });
    window.setTimeout(() => page.classList.remove("is-entering", "is-entered"), 1700);
  }

  function canRender() {
    return isInViewport && isDocumentVisible;
  }

  function renderScene() {
    if (!canRender()) return;
    renderer.render(scene, camera);
  }

  function requestFrame() {
    if (frameRequest || !canRender()) return;
    frameRequest = window.requestAnimationFrame(renderFrame);
  }

  function resizeRenderer() {
    const width = Math.max(1, page.clientWidth || window.innerWidth);
    const height = Math.max(1, page.clientHeight || window.innerHeight);
    const ratioLimit = width < 700 ? 1.35 : 1.8;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, ratioLimit);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (width < 700) {
      bouquetRoot.position.set(0, -0.8, 0);
      bouquetRoot.scale.setScalar(clamp(width / 800, 0.4, 0.66));
    } else if (width < 1000) {
      bouquetRoot.position.set(0.92, -0.08, 0);
      bouquetRoot.scale.setScalar(0.78);
    } else {
      bouquetRoot.position.set(1.25, 0.12, 0);
      bouquetRoot.scale.setScalar(0.84);
    }

    if (particleSystem) particleSystem.uniforms.uPixelRatio.value = pixelRatio;
    renderScene();
  }

  function finishBloom(isEntrance) {
    phase = "idle";
    if (particleSystem) {
      particleSystem.uniforms.uProgress.value = 1;
      particleSystem.points.visible = true;
    }
    page.classList.remove("is-blooming");
    if (bloomButton) bloomButton.disabled = false;
    status.textContent = isEntrance ? "粉蓝星光已经聚成3D粒子花束。拖动看看它的每一面。" : "粉蓝星光已经重新聚成玫瑰。七夕快乐。";
    renderScene();
  }

  function startBloom(isEntrance = false) {
    if (!ready || phase === "animating") return;
    if (reducedMotionQuery.matches) {
      status.textContent = "花束已经为你盛开。";
      return;
    }

    phase = "animating";
    animationElapsed = 0;
    animationDuration = isEntrance ? 3200 : 2800;
    isEntranceAnimation = isEntrance;
    animationRotationStart = bouquetRoot.rotation.y;
    previousFrameTime = 0;
    particleSystem.points.visible = true;
    particleSystem.uniforms.uProgress.value = 0;
    page.classList.add("is-blooming");
    if (bloomButton) bloomButton.disabled = true;
    status.textContent = isEntrance ? "星光正从银河落下，聚成一束玫瑰……" : "星光正在重新聚成玫瑰……";
    requestFrame();
  }

  function renderFrame(time) {
    frameRequest = 0;
    if (!canRender()) return;
    const elapsed = previousFrameTime ? Math.min(50, time - previousFrameTime) : 0;
    previousFrameTime = time;

    if (phase === "animating") {
      animationElapsed += elapsed;
      const progress = clamp(animationElapsed / animationDuration, 0, 1);
      particleSystem.uniforms.uProgress.value = progress;
      particleSystem.uniforms.uTime.value = time;
      bouquetRoot.rotation.y = animationRotationStart + easeInOutCubic(progress) * 0.16;
      renderScene();

      if (progress >= 1) finishBloom(isEntranceAnimation);
      else requestFrame();
    }
  }

  function showStaticBouquet() {
    if (!ready) return;
    phase = "idle";
    particleSystem.uniforms.uProgress.value = 1;
    particleSystem.points.visible = true;
    page.classList.remove("is-blooming");
    if (bloomButton) bloomButton.disabled = false;
    status.textContent = "已按照你的动态效果偏好展示静态3D粒子花束。";
    renderScene();
  }

  function handlePointerMove(event) {
    if (activePointerId !== event.pointerId || !ready || phase === "animating") return;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) didDrag = true;
    bouquetRoot.rotation.y = rotationStartY + deltaX * 0.008;
    bouquetRoot.rotation.x = clamp(rotationStartX + deltaY * 0.0045, -0.56, 0.34);
    if (particleSystem) particleSystem.uniforms.uTime.value = performance.now();
    renderScene();
  }

  function releasePointer(event, replayOnTap) {
    if (activePointerId !== event.pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    activePointerId = null;
    page.classList.remove("is-dragging");
    if (replayOnTap && !didDrag) startBloom(false);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!ready || phase === "animating" || activePointerId !== null) return;
    activePointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    rotationStartX = bouquetRoot.rotation.x;
    rotationStartY = bouquetRoot.rotation.y;
    didDrag = false;
    canvas.setPointerCapture(event.pointerId);
    page.classList.add("is-dragging");
  });
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", (event) => releasePointer(event, true));
  canvas.addEventListener("pointercancel", (event) => releasePointer(event, false));

  if (bloomButton) bloomButton.addEventListener("click", () => startBloom(false));
  if (shareButton) {
    shareButton.addEventListener("click", () => {
      const shareData = {
        title: "送你一束七夕粉蓝粒子玫瑰",
        text: "把银河折成一束不会凋谢的玫瑰，送给最特别的你。",
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData).then(
          () => {
            status.textContent = "这束花已经送出去了。";
          },
          () => {}
        );
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareData.url).then(
          () => {
            status.textContent = "链接已复制，可以把这束花送给 TA 了。";
          },
          () => {
            status.textContent = "复制当前页面地址，就可以把花送给 TA。";
          }
        );
      } else {
        status.textContent = "复制当前页面地址，就可以把花送给 TA。";
      }
    });
  }

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    status.textContent = "3D粒子花束渲染暂时中断，正在等待浏览器恢复。";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    status.textContent = "3D粒子花束已经恢复。";
    renderScene();
  });

  window.addEventListener("resize", resizeRenderer, { passive: true });
  document.addEventListener("visibilitychange", () => {
    isDocumentVisible = !document.hidden;
    previousFrameTime = 0;
    if (phase === "animating") requestFrame();
    else renderScene();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        isInViewport = entries[0] ? entries[0].isIntersecting : true;
        previousFrameTime = 0;
        if (phase === "animating") requestFrame();
        else renderScene();
      },
      { threshold: 0.01 }
    ).observe(page);
  }

  function handleMotionPreference() {
    if (reducedMotionQuery.matches) showStaticBouquet();
    else if (ready && phase !== "animating") {
      status.textContent = "轻触花束，星光会重新聚拢。";
      renderScene();
    }
  }

  if (reducedMotionQuery.addEventListener) reducedMotionQuery.addEventListener("change", handleMotionPreference);
  else reducedMotionQuery.addListener(handleMotionPreference);

  revealPageCopy();
  if (bloomButton) bloomButton.disabled = true;
  status.textContent = "正在加载3D粒子玫瑰花束……";
  resizeRenderer();

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      try {
        const surfaces = createBouquetSurfaces(gltf.scene);
        particleSystem = createParticles(surfaces, particleCount, renderer.getPixelRatio());
        for (const surface of surfaces) {
          surface.mesh.geometry.dispose();
          surface.mesh.material.dispose();
        }
        bouquetRoot.add(particleSystem.points);
        ready = true;
        phase = "idle";
        page.classList.add("has-three-model");
        resizeRenderer();
        if (reducedMotionQuery.matches) showStaticBouquet();
        else startBloom(true);
      } catch (error) {
        console.error("Unable to prepare the Qixi bouquet model.", error);
        phase = "error";
        status.textContent = "3D粒子花束暂时无法显示，请稍后重试。";
        if (bloomButton) bloomButton.disabled = true;
      }
    },
    undefined,
    (error) => {
      console.error("Unable to load the Qixi bouquet model.", error);
      phase = "error";
      status.textContent = "3D粒子花束资源加载失败，请稍后重试。";
      if (bloomButton) bloomButton.disabled = true;
    }
  );
}
