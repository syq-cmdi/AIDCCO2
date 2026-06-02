"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { DigitalTwinResponse, MatchingResult, QuotaStatus, RealtimeMetrics } from "../lib/api";

type CampusSceneProps = {
  twin: DigitalTwinResponse;
  metrics: RealtimeMetrics;
  matching: MatchingResult;
  quota: QuotaStatus;
};

type TextureKind = "ground" | "roof" | "solar" | "road" | "field" | "concrete" | "metal";

type BuildingOptions = {
  label?: boolean;
  heat?: string;
  solar?: boolean;
  coolingDensity?: number;
};

function metric(metrics: RealtimeMetrics, key: string, fallback = 0) {
  return metrics.metrics[key]?.value ?? fallback;
}

function createTexture(kind: TextureKind) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const raw = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = Math.floor((raw - Math.floor(raw)) * 18);
      const grid = x % 96 < 2 || y % 96 < 2;
      const fineGrid = x % 38 < 1 || y % 38 < 1;
      const fieldRows = Math.sin((x + y * 0.18) * 0.095) > 0.84;
      const roadStripe = kind === "road" && y > 244 && y < 252 && x % 116 < 58;
      const roofSeam = kind === "roof" && (x % 86 < 2 || y % 72 < 2);
      const solarStripe = kind === "solar" && (x % 58 < 4 || y % 86 < 3);

      let r = 28;
      let g = 42;
      let b = 38;

      if (kind === "roof") {
        r = roofSeam ? 184 : 154;
        g = roofSeam ? 194 : 170;
        b = roofSeam ? 198 : 175;
      } else if (kind === "solar") {
        r = solarStripe ? 42 : 15;
        g = solarStripe ? 112 : 55;
        b = solarStripe ? 156 : 94;
      } else if (kind === "road") {
        r = roadStripe ? 194 : 36;
        g = roadStripe ? 202 : 43;
        b = roadStripe ? 192 : 48;
      } else if (kind === "field") {
        r = fieldRows ? 67 : 38;
        g = fieldRows ? 132 : 104;
        b = fieldRows ? 56 : 47;
      } else if (kind === "concrete") {
        r = 92;
        g = 105;
        b = 101;
      } else if (kind === "metal") {
        r = 132;
        g = 149;
        b = 155;
      }

      image.data[i] = Math.min(255, r + grain + (grid && kind === "ground" ? 16 : 0) + (fineGrid && kind === "concrete" ? 12 : 0));
      image.data[i + 1] = Math.min(255, g + grain + (grid && kind === "ground" ? 16 : 0) + (fineGrid && kind === "concrete" ? 12 : 0));
      image.data[i + 2] = Math.min(255, b + grain + (grid && kind === "ground" ? 16 : 0) + (fineGrid && kind === "concrete" ? 12 : 0));
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createLabel(text: string, color = "#dff8ff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.fillStyle = "rgba(7, 18, 25, 0.72)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(118, 215, 178, 0.55)";
  context.lineWidth = 4;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = color;
  context.font = "700 34px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(2.7, 0.84, 1);
  return sprite;
}

function addHeatOverlay(group: THREE.Group, width: number, depth: number, color: string) {
  const overlay = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.018, depth),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  overlay.position.y = 1.25;
  group.add(overlay);
  return overlay;
}

function addRooftopCooling(group: THREE.Group, width: number, depth: number, density: number) {
  const metal = new THREE.MeshPhysicalMaterial({ color: "#b6c3c7", roughness: 0.34, metalness: 0.62, clearcoat: 0.18 });
  const darkMetal = new THREE.MeshPhysicalMaterial({ color: "#263139", roughness: 0.42, metalness: 0.72 });
  const fanMaterial = new THREE.MeshBasicMaterial({ color: "#071219" });
  const pipeMaterial = new THREE.MeshBasicMaterial({ color: "#4bd7ff", transparent: true, opacity: 0.72 });
  const fans: THREE.Mesh[] = [];

  for (let index = 0; index < density; index += 1) {
    const x = -width * 0.34 + index * (width * 0.68) / Math.max(density - 1, 1);
    const z = depth * 0.22 + (index % 2) * 0.36;
    const chiller = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.34), metal);
    chiller.position.set(x, 1.36, z);
    chiller.castShadow = true;
    group.add(chiller);

    for (let fanIndex = 0; fanIndex < 2; fanIndex += 1) {
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.018, 28), fanMaterial);
      fan.position.set(x - 0.12 + fanIndex * 0.24, 1.47, z);
      group.add(fan);
      fans.push(fan);
    }

    const louver = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.025), darkMetal);
    louver.position.set(x, 1.37, z - 0.18);
    group.add(louver);
  }

  for (let index = 0; index < 3; index += 1) {
    const pipe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.026, 0.026), pipeMaterial);
    pipe.position.set(0, 1.51 + index * 0.012, -depth * 0.22 + index * 0.2);
    group.add(pipe);
  }

  return fans;
}

function addBuilding(scene: THREE.Scene, x: number, z: number, name: string, tone: string, rows: number, options: BuildingOptions = {}) {
  const width = 3.16;
  const depth = 2.04;
  const height = 1.08;
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshPhysicalMaterial({
      color: tone,
      roughness: 0.42,
      metalness: 0.28,
      clearcoat: 0.24,
      transparent: true,
      opacity: 0.96
    })
  );
  shell.position.y = height / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const panelMaterial = new THREE.MeshPhysicalMaterial({ color: "#314446", roughness: 0.46, metalness: 0.24 });
  [-1, 1].forEach((side) => {
    const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.045, height * 0.88, depth + 0.05), panelMaterial);
    sidePanel.position.set(side * (width / 2 + 0.025), height * 0.5, 0);
    group.add(sidePanel);
  });
  [-0.56, 0, 0.56].forEach((offset) => {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.035), panelMaterial);
    vent.position.set(offset, 0.62, -depth / 2 - 0.03);
    group.add(vent);
  });

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.78, 0.5, 0.035),
    new THREE.MeshPhysicalMaterial({
      color: "#9fd9ff",
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      transmission: 0.3,
      clearcoat: 1
    })
  );
  glass.position.set(0, 0.78, -depth / 2 - 0.04);
  group.add(glass);

  const roofTexture = createTexture("roof");
  roofTexture?.repeat.set(3, 2);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.22, 0.1, depth + 0.18),
    new THREE.MeshPhysicalMaterial({ color: "#d5dee2", map: roofTexture ?? undefined, roughness: 0.4, metalness: 0.28 })
  );
  roof.position.y = height + 0.08;
  roof.castShadow = true;
  group.add(roof);

  const solarTexture = createTexture("solar");
  solarTexture?.repeat.set(2, 2);
  if (options.solar !== false) {
    const solar = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.42, 0.035, depth * 0.56),
      new THREE.MeshPhysicalMaterial({ color: "#164f7b", map: solarTexture ?? undefined, roughness: 0.22, metalness: 0.22, clearcoat: 0.45 })
    );
    solar.position.set(-width * 0.22, height + 0.16, -depth * 0.14);
    group.add(solar);
  }

  const fans = addRooftopCooling(group, width, depth, options.coolingDensity ?? 4);
  const heat = addHeatOverlay(group, width * 0.9, depth * 0.68, options.heat ?? "#76d7b2");

  const rackMaterial = new THREE.MeshPhysicalMaterial({ color: "#202f38", roughness: 0.28, metalness: 0.72, clearcoat: 0.25 });
  const ledMaterial = new THREE.MeshBasicMaterial({ color: "#76d7b2" });
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.2), rackMaterial);
      rack.position.set(-1.18 + col * 0.58, 0.42, -0.76 + row * 0.38);
      rack.castShadow = true;
      group.add(rack);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.016), ledMaterial);
      led.position.set(rack.position.x, 0.57, -0.86 + row * 0.38);
      group.add(led);
    }
  }

  if (options.label !== false) {
    const label = createLabel(name);
    if (label) {
      label.position.set(0, 2.08, -1.15);
      group.add(label);
    }
  }

  scene.add(group);
  return { group, roofTexture, solarTexture, fans, heat };
}

function addTube(scene: THREE.Scene, points: THREE.Vector3[], color: string, radius = 0.035, opacity = 0.68) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 92, radius, 12, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
  );
  scene.add(tube);
  return curve;
}

function addFence(scene: THREE.Scene, width: number, depth: number) {
  const fence = new THREE.Group();
  const railMaterial = new THREE.MeshBasicMaterial({ color: "#91a6ad", transparent: true, opacity: 0.82 });
  const postMaterial = new THREE.MeshPhysicalMaterial({ color: "#a8bcc1", roughness: 0.44, metalness: 0.4 });
  const railSpecs = [
    { x: 0, z: -depth / 2, w: width, d: 0.035 },
    { x: 0, z: depth / 2, w: width, d: 0.035 },
    { x: -width / 2, z: 0, w: 0.035, d: depth },
    { x: width / 2, z: 0, w: 0.035, d: depth }
  ];

  railSpecs.forEach((spec) => {
    for (let level = 0; level < 2; level += 1) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 0.026, spec.d), railMaterial);
      rail.position.set(spec.x, 0.22 + level * 0.22, spec.z);
      fence.add(rail);
    }
  });

  for (let x = -width / 2; x <= width / 2 + 0.01; x += 0.9) {
    [-depth / 2, depth / 2].forEach((z) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), postMaterial);
      post.position.set(x, 0.27, z);
      fence.add(post);
    });
  }
  for (let z = -depth / 2; z <= depth / 2 + 0.01; z += 0.9) {
    [-width / 2, width / 2].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), postMaterial);
      post.position.set(x, 0.27, z);
      fence.add(post);
    });
  }

  const gate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: "#4bd7ff", transparent: true, opacity: 0.7 }));
  gate.position.set(0, 0.18, depth / 2 + 0.02);
  fence.add(gate);

  scene.add(fence);
}

function addParking(scene: THREE.Scene, roadMaterial: THREE.Material) {
  const lot = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.026, 1.55), roadMaterial);
  lot.position.set(7.1, 0.018, 4.36);
  scene.add(lot);

  const stripeMaterial = new THREE.MeshBasicMaterial({ color: "#d7e1d6", transparent: true, opacity: 0.78 });
  for (let index = 0; index < 8; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.01, 0.82), stripeMaterial);
    stripe.position.set(5.72 + index * 0.36, 0.04, 4.36);
    scene.add(stripe);
  }

  const carColors = ["#e5eef3", "#d94e45", "#345e75", "#f0ba4d", "#1d2b32"];
  for (let index = 0; index < 9; index += 1) {
    const car = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.38),
      new THREE.MeshPhysicalMaterial({ color: carColors[index % carColors.length], roughness: 0.32, metalness: 0.22, clearcoat: 0.35 })
    );
    car.position.set(5.9 + (index % 5) * 0.5, 0.09, 4.05 + Math.floor(index / 5) * 0.5);
    car.castShadow = true;
    scene.add(car);
  }
}

function addWindTurbine(scene: THREE.Scene, x: number, z: number, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, -0.03, z);
  group.scale.setScalar(scale);
  const towerMaterial = new THREE.MeshPhysicalMaterial({ color: "#eff6f5", roughness: 0.28, metalness: 0.18 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 1.45, 18), towerMaterial);
  tower.position.y = 0.72;
  group.add(tower);

  const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.11), towerMaterial);
  nacelle.position.set(0, 1.44, -0.05);
  group.add(nacelle);

  const rotor = new THREE.Group();
  rotor.position.set(0, 1.44, -0.13);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), towerMaterial);
  rotor.add(hub);
  for (let index = 0; index < 3; index += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.48, 0.012), towerMaterial);
    blade.position.y = 0.24;
    blade.rotation.z = (index * Math.PI * 2) / 3;
    rotor.add(blade);
  }
  group.add(rotor);
  scene.add(group);
  return rotor;
}

function addLightShafts(scene: THREE.Scene) {
  const shaftMaterial = new THREE.MeshBasicMaterial({
    color: "#f6fff0",
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  [
    { x: -5.8, y: 4.2, z: -5.2, rz: -0.32 },
    { x: 1.8, y: 4.5, z: -4.8, rz: -0.22 },
    { x: 6.2, y: 3.8, z: -1.6, rz: -0.45 }
  ].forEach((spec) => {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 8.6), shaftMaterial);
    shaft.position.set(spec.x, spec.y, spec.z);
    shaft.rotation.set(1.04, 0.26, spec.rz);
    scene.add(shaft);
  });
}

function addKpiRing(scene: THREE.Scene, x: number, z: number, y: number, radius: number, color: string, labelText: string) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.018, 8, 72),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending })
  );
  ring.position.set(x, y, z);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  const label = createLabel(labelText, color);
  if (label) {
    label.position.set(x, y + 0.42, z);
    label.scale.set(1.65, 0.52, 1);
    scene.add(label);
  }

  return ring;
}

export default function CampusScene({ twin, metrics, matching, quota }: CampusSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const summary = useMemo(
    () => ({
      loadMw: metric(metrics, "facility_energy_kwh", 0) / 1000,
      pue: metric(metrics, "pue", 1.2),
      carbon: metric(metrics, "location_based_emissions_kg", 0) / 1000,
      cfe: matching.cfe_score * 100,
      quota: quota.used_percent,
      racks: twin.rack_count,
      chips: twin.chip_count
    }),
    [matching.cfe_score, metrics, quota.used_percent, twin.chip_count, twin.rack_count]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#a7c7d8");
    scene.fog = new THREE.FogExp2("#cfe2d6", 0.044);

    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 160);
    camera.position.set(10.8, 8.2, 10.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.2;
    controls.target.set(0.2, 0.55, 0);
    controls.minDistance = 6;
    controls.maxDistance = 21;
    controls.maxPolarAngle = Math.PI * 0.47;

    scene.add(new THREE.HemisphereLight("#fffaf0", "#3f654d", 1.65));
    const sun = new THREE.DirectionalLight("#fff4d9", 3.1);
    sun.position.set(-6.2, 9.6, 5.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);
    const cyan = new THREE.PointLight("#4bd7ff", 2.1, 16);
    cyan.position.set(4.8, 2.2, -4.6);
    scene.add(cyan);
    const green = new THREE.PointLight("#76d7b2", 1.6, 14);
    green.position.set(-5.8, 1.8, 3.6);
    scene.add(green);

    const createdTextures: Array<THREE.Texture | null> = [];
    const rotatingFans: THREE.Mesh[] = [];
    const heatOverlays: THREE.Mesh[] = [];
    const kpiRings: THREE.Mesh[] = [];
    const turbineRotors: THREE.Group[] = [];

    const fieldTexture = createTexture("field");
    fieldTexture?.repeat.set(18, 12);
    createdTextures.push(fieldTexture);
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 24),
      new THREE.MeshPhysicalMaterial({ color: "#4d8b49", map: fieldTexture ?? undefined, roughness: 0.82, metalness: 0.02 })
    );
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.095;
    field.receiveShadow = true;
    scene.add(field);

    const campusTexture = createTexture("concrete");
    campusTexture?.repeat.set(9, 6);
    createdTextures.push(campusTexture);
    const campus = new THREE.Mesh(
      new THREE.BoxGeometry(19.2, 0.09, 12.8),
      new THREE.MeshPhysicalMaterial({ color: "#66786f", map: campusTexture ?? undefined, roughness: 0.64, metalness: 0.04 })
    );
    campus.position.y = -0.04;
    campus.receiveShadow = true;
    scene.add(campus);

    const roadTexture = createTexture("road");
    roadTexture?.repeat.set(9, 1);
    createdTextures.push(roadTexture);
    const roadMaterial = new THREE.MeshPhysicalMaterial({ color: "#29323a", map: roadTexture ?? undefined, roughness: 0.56, metalness: 0.05 });
    [
      { x: 0, z: 4.6, w: 16.8, d: 0.72 },
      { x: 0, z: -4.72, w: 16.6, d: 0.7 },
      { x: -7.65, z: -0.1, w: 0.7, d: 9.7 },
      { x: 7.65, z: -0.1, w: 0.7, d: 9.7 },
      { x: 0, z: -0.1, w: 16.2, d: 0.52 }
    ].forEach((item) => {
      const road = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.032, item.d), roadMaterial);
      road.position.set(item.x, 0.012, item.z);
      road.receiveShadow = true;
      scene.add(road);
    });

    addFence(scene, 18.6, 12.2);
    addParking(scene, roadMaterial);
    addLightShafts(scene);

    const buildingSpecs = [
      { x: -5.7, z: -2.85, name: "AI Hall A", tone: "#6f8f73", label: true, heat: "#ff7d66", coolingDensity: 5 },
      { x: -1.95, z: -2.85, name: "AI Hall B", tone: "#6a8770", label: false, heat: "#ffc857", coolingDensity: 5 },
      { x: 1.8, z: -2.85, name: "Training Hall", tone: "#688a76", label: true, heat: "#ff9966", coolingDensity: 6 },
      { x: 5.55, z: -2.85, name: "Inference Hall", tone: "#718f77", label: false, heat: "#76d7b2", coolingDensity: 4 },
      { x: -5.7, z: 1.35, name: "GPU Expansion", tone: "#628573", label: false, heat: "#4bd7ff", coolingDensity: 5 },
      { x: -1.95, z: 1.35, name: "Compute Building 1", tone: "#6e8f78", label: true, heat: "#76d7b2", coolingDensity: 4 },
      { x: 1.8, z: 1.35, name: "Liquid Cooling Lab", tone: "#5f8174", label: false, heat: "#38f2c2", coolingDensity: 6 },
      { x: 5.55, z: 1.35, name: "AI Expansion Hall", tone: "#6e9278", label: true, heat: "#ffc857", coolingDensity: 5 }
    ];

    buildingSpecs.forEach((spec, index) => {
      const building = addBuilding(scene, spec.x, spec.z, spec.name, spec.tone, index % 3 === 0 ? 3 : 2, {
        label: spec.label,
        heat: spec.heat,
        solar: index % 4 !== 2,
        coolingDensity: spec.coolingDensity
      });
      createdTextures.push(building.roofTexture, building.solarTexture);
      rotatingFans.push(...building.fans);
      heatOverlays.push(building.heat);
    });

    const coolingMat = new THREE.MeshPhysicalMaterial({ color: "#9fb4ba", roughness: 0.34, metalness: 0.62, clearcoat: 0.18 });
    const pipeBlue = new THREE.MeshBasicMaterial({ color: "#4bd7ff", transparent: true, opacity: 0.85 });
    const pipeYellow = new THREE.MeshBasicMaterial({ color: "#ffc857", transparent: true, opacity: 0.76 });
    const coolingPlant = new THREE.Group();
    coolingPlant.position.set(-6.55, 0, 4.15);
    for (let index = 0; index < 4; index += 1) {
      const chiller = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.58, 0.55), coolingMat);
      chiller.position.set(-1.2 + index * 0.8, 0.29, -0.25);
      chiller.castShadow = true;
      coolingPlant.add(chiller);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 28), new THREE.MeshBasicMaterial({ color: "#071219" }));
      fan.position.set(chiller.position.x, 0.6, -0.25);
      coolingPlant.add(fan);
      rotatingFans.push(fan);
    }
    for (let index = 0; index < 4; index += 1) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.74, 28), coolingMat);
      tower.position.set(-1.2 + index * 0.78, 0.92, 0.62);
      tower.castShadow = true;
      coolingPlant.add(tower);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 28), new THREE.MeshBasicMaterial({ color: "#071219" }));
      fan.position.set(tower.position.x, 1.31, 0.62);
      coolingPlant.add(fan);
      rotatingFans.push(fan);
    }
    for (let index = 0; index < 5; index += 1) {
      const pipe = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.035, 0.035), index % 2 === 0 ? pipeBlue : pipeYellow);
      pipe.position.set(-0.08, 0.75 + index * 0.07, 0.05 + index * 0.08);
      coolingPlant.add(pipe);
    }
    const coolingLabel = createLabel("Cooling Yard + CDU", "#b7ecff");
    if (coolingLabel) {
      coolingLabel.position.set(-0.08, 1.95, 0.2);
      coolingPlant.add(coolingLabel);
    }
    scene.add(coolingPlant);

    const substation = new THREE.Group();
    substation.position.set(6.85, 0, -5.05);
    const electricalMat = new THREE.MeshPhysicalMaterial({ color: "#2c3640", roughness: 0.3, metalness: 0.78, clearcoat: 0.2 });
    for (let index = 0; index < 8; index += 1) {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.82, 0.44), electricalMat);
      cabinet.position.set(-1.15 + index * 0.32, 0.41, 0);
      cabinet.castShadow = true;
      substation.add(cabinet);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.015), new THREE.MeshBasicMaterial({ color: index < 6 ? "#76d7b2" : "#ffc857" }));
      light.position.set(cabinet.position.x, 0.72, -0.23);
      substation.add(light);
    }
    for (let index = 0; index < 3; index += 1) {
      const transformer = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.62), electricalMat);
      transformer.position.set(-0.68 + index * 0.68, 0.24, 0.7);
      transformer.castShadow = true;
      substation.add(transformer);
    }
    const subLabel = createLabel("Utility / UPS / EPMS", "#ffe3a3");
    if (subLabel) {
      subLabel.position.set(0, 1.62, 0.12);
      substation.add(subLabel);
    }
    scene.add(substation);

    const battery = new THREE.Group();
    battery.position.set(6.5, 0, 4.0);
    const batteryMat = new THREE.MeshPhysicalMaterial({ color: "#365057", roughness: 0.3, metalness: 0.64, clearcoat: 0.22 });
    for (let index = 0; index < 10; index += 1) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.72, 0.38), batteryMat);
      cell.position.set(-1.35 + index * 0.3, 0.36, -0.42);
      cell.castShadow = true;
      battery.add(cell);
      const soc = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.018), new THREE.MeshBasicMaterial({ color: "#76d7b2" }));
      soc.position.set(cell.position.x, 0.62, -0.62);
      battery.add(soc);
    }
    const batteryLabel = createLabel("24/7 CFE + Battery", "#b7ffd8");
    if (batteryLabel) {
      batteryLabel.position.set(0, 1.45, -0.28);
      battery.add(batteryLabel);
    }
    scene.add(battery);

    [-7.2, -5.2, -3.2, 3.8, 5.7, 7.5].forEach((x, index) => {
      turbineRotors.push(addWindTurbine(scene, x, -9.0 - (index % 2) * 0.45, 0.92 + (index % 3) * 0.08));
    });

    const curves = [
      addTube(scene, [new THREE.Vector3(-6.55, 0.48, 4.15), new THREE.Vector3(-5.6, 0.78, 2.8), new THREE.Vector3(-5.7, 1.52, 1.35)], "#4bd7ff", 0.03, 0.72),
      addTube(scene, [new THREE.Vector3(-6.55, 0.55, 4.15), new THREE.Vector3(-1.8, 0.88, 3.3), new THREE.Vector3(1.8, 1.55, 1.35)], "#4bd7ff", 0.026, 0.6),
      addTube(scene, [new THREE.Vector3(6.85, 0.5, -5.05), new THREE.Vector3(4.8, 0.7, -4.1), new THREE.Vector3(5.55, 1.55, -2.85)], "#ffc857", 0.03, 0.74),
      addTube(scene, [new THREE.Vector3(6.5, 0.55, 4.0), new THREE.Vector3(4.4, 0.76, 2.6), new THREE.Vector3(1.8, 1.58, -2.85)], "#76d7b2", 0.028, 0.68),
      addTube(scene, [new THREE.Vector3(-5.7, 1.5, -2.85), new THREE.Vector3(-1.95, 1.95, -2.85), new THREE.Vector3(1.8, 1.7, -2.85), new THREE.Vector3(5.55, 1.58, -2.85)], "#ff7d66", 0.02, 0.58)
    ];

    const flowMarkers: Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; speed: number; phase: number }> = [];
    curves.forEach((curve, index) => {
      for (let marker = 0; marker < 5; marker += 1) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 16, 16),
          new THREE.MeshBasicMaterial({ color: index <= 1 ? "#4bd7ff" : index === 2 ? "#ffc857" : index === 3 ? "#76d7b2" : "#ff7d66" })
        );
        scene.add(mesh);
        flowMarkers.push({ mesh, curve, speed: 0.048 + index * 0.008, phase: marker / 5 });
      }
    });

    kpiRings.push(addKpiRing(scene, -5.7, -2.85, 2.55, 0.54, "#ff7d66", `${summary.carbon.toFixed(1)} tCO2e/h`));
    kpiRings.push(addKpiRing(scene, -1.95, 1.35, 2.48, 0.48, "#76d7b2", `PUE ${summary.pue.toFixed(2)}`));
    kpiRings.push(addKpiRing(scene, 5.55, 1.35, 2.45, 0.5, "#b7ffd8", `CFE ${summary.cfe.toFixed(1)}%`));
    kpiRings.push(addKpiRing(scene, 1.8, -2.85, 2.6, 0.44, "#ffc857", `Quota ${summary.quota.toFixed(1)}%`));

    const capacityLabel = createLabel(`${summary.racks} racks / ${summary.chips} chips / ${summary.loadMw.toFixed(1)} MWh`, "#dff8ff");
    if (capacityLabel) {
      capacityLabel.position.set(0.2, 3.18, 4.92);
      scene.add(capacityLabel);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) {
        return;
      }
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    let frameId = 0;
    const animationStart = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - animationStart) / 1000;
      flowMarkers.forEach((item) => {
        item.mesh.position.copy(item.curve.getPoint((item.phase + elapsed * item.speed) % 1));
      });
      rotatingFans.forEach((fan, index) => {
        fan.rotation.y = elapsed * (1.8 + (index % 3) * 0.32);
      });
      turbineRotors.forEach((rotor, index) => {
        rotor.rotation.z = elapsed * (0.48 + index * 0.035);
      });
      heatOverlays.forEach((heat, index) => {
        const scale = 1 + Math.sin(elapsed * 1.2 + index) * 0.025;
        heat.scale.set(scale, 1, 1 + Math.cos(elapsed * 1.1 + index) * 0.025);
      });
      kpiRings.forEach((ring, index) => {
        ring.rotation.z = elapsed * (0.3 + index * 0.04);
      });
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        } else if (object instanceof THREE.Sprite) {
          const material = object.material;
          material.map?.dispose();
          material.dispose();
        }
      });
      createdTextures.forEach((texture) => texture?.dispose());
      container.removeChild(renderer.domElement);
    };
  }, [summary]);

  return <div className="campus-scene" ref={containerRef} />;
}
