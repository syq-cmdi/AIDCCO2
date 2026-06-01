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

function metric(metrics: RealtimeMetrics, key: string, fallback = 0) {
  return metrics.metrics[key]?.value ?? fallback;
}

function createTexture(kind: "ground" | "roof" | "solar" | "road") {
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
      const stripe = kind === "solar" && (x % 58 < 4 || y % 86 < 3);
      let r = 28;
      let g = 42;
      let b = 38;
      if (kind === "roof") {
        r = 154;
        g = 170;
        b = 175;
      } else if (kind === "solar") {
        r = stripe ? 42 : 16;
        g = stripe ? 112 : 52;
        b = stripe ? 156 : 92;
      } else if (kind === "road") {
        r = 36;
        g = 43;
        b = 48;
      }
      image.data[i] = Math.min(255, r + grain + (grid && kind === "ground" ? 16 : 0));
      image.data[i + 1] = Math.min(255, g + grain + (grid && kind === "ground" ? 16 : 0));
      image.data[i + 2] = Math.min(255, b + grain + (grid && kind === "ground" ? 16 : 0));
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

function addBuilding(scene: THREE.Scene, x: number, z: number, name: string, tone: string, rows: number) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 1.3, 2.4),
    new THREE.MeshPhysicalMaterial({
      color: tone,
      roughness: 0.38,
      metalness: 0.42,
      clearcoat: 0.34,
      transparent: true,
      opacity: 0.92
    })
  );
  shell.position.y = 0.65;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(3.38, 0.72, 0.035),
    new THREE.MeshPhysicalMaterial({
      color: "#9fd9ff",
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.28,
      transmission: 0.38,
      clearcoat: 1
    })
  );
  glass.position.set(0, 0.78, -1.23);
  group.add(glass);

  const roofTexture = createTexture("roof");
  roofTexture?.repeat.set(3, 2);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.7, 0.12, 2.6),
    new THREE.MeshPhysicalMaterial({ color: "#d5dee2", map: roofTexture ?? undefined, roughness: 0.46, metalness: 0.18 })
  );
  roof.position.y = 1.38;
  roof.castShadow = true;
  group.add(roof);

  const solarTexture = createTexture("solar");
  solarTexture?.repeat.set(2, 2);
  const solar = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 0.035, 1.5),
    new THREE.MeshPhysicalMaterial({ color: "#164f7b", map: solarTexture ?? undefined, roughness: 0.22, metalness: 0.22, clearcoat: 0.45 })
  );
  solar.position.set(0.1, 1.47, -0.08);
  group.add(solar);

  const rackMaterial = new THREE.MeshPhysicalMaterial({ color: "#202f38", roughness: 0.28, metalness: 0.72, clearcoat: 0.25 });
  const ledMaterial = new THREE.MeshBasicMaterial({ color: "#76d7b2" });
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.22), rackMaterial);
      rack.position.set(-1.25 + col * 0.62, 0.46, -0.82 + row * 0.42);
      rack.castShadow = true;
      group.add(rack);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.016), ledMaterial);
      led.position.set(rack.position.x, 0.62, -0.94 + row * 0.42);
      group.add(led);
    }
  }

  const label = createLabel(name);
  if (label) {
    label.position.set(0, 2.18, -1.35);
    group.add(label);
  }

  scene.add(group);
  return { group, roofTexture, solarTexture };
}

function addTube(scene: THREE.Scene, points: THREE.Vector3[], color: string, radius = 0.035) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 80, radius, 12, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.68 })
  );
  scene.add(tube);
  return curve;
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
    scene.background = new THREE.Color("#071219");
    scene.fog = new THREE.Fog("#071219", 12, 34);

    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 120);
    camera.position.set(8.6, 6.6, 8.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.32;
    controls.target.set(0.2, 0.55, -0.2);
    controls.minDistance = 6;
    controls.maxDistance = 17;
    controls.maxPolarAngle = Math.PI * 0.47;

    scene.add(new THREE.HemisphereLight("#dff8ff", "#10251f", 1.35));
    const sun = new THREE.DirectionalLight("#ffffff", 2.3);
    sun.position.set(-5, 8, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const cyan = new THREE.PointLight("#4bd7ff", 2.8, 14);
    cyan.position.set(4.8, 2.2, -4.6);
    scene.add(cyan);
    const green = new THREE.PointLight("#76d7b2", 2.1, 12);
    green.position.set(-4.8, 1.8, 3.6);
    scene.add(green);

    const groundTexture = createTexture("ground");
    groundTexture?.repeat.set(9, 6);
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(14.8, 0.08, 10.2),
      new THREE.MeshPhysicalMaterial({ color: "#22332e", map: groundTexture ?? undefined, roughness: 0.62, metalness: 0.05 })
    );
    ground.position.y = -0.04;
    ground.receiveShadow = true;
    scene.add(ground);

    const roadTexture = createTexture("road");
    roadTexture?.repeat.set(7, 1);
    const roadMaterial = new THREE.MeshPhysicalMaterial({ color: "#263039", map: roadTexture ?? undefined, roughness: 0.54, metalness: 0.06 });
    [
      { x: 0, z: 3.75, w: 13.5, d: 0.72 },
      { x: 5.15, z: -0.65, w: 0.68, d: 7.9 },
      { x: -5.1, z: -0.65, w: 0.68, d: 7.9 }
    ].forEach((item) => {
      const road = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.03, item.d), roadMaterial);
      road.position.set(item.x, 0.012, item.z);
      scene.add(road);
    });

    const createdTextures: Array<THREE.Texture | null> = [groundTexture, roadTexture];
    const b1 = addBuilding(scene, -2.05, -0.75, "Compute Building 1", "#52616b", 2);
    const b2 = addBuilding(scene, 2.55, -1.15, "AI Expansion Hall", "#3f5f61", 2);
    createdTextures.push(b1.roofTexture, b1.solarTexture, b2.roofTexture, b2.solarTexture);

    const coolingMat = new THREE.MeshPhysicalMaterial({ color: "#85a0ab", roughness: 0.32, metalness: 0.68, clearcoat: 0.22 });
    const coolingPlant = new THREE.Group();
    coolingPlant.position.set(-5.15, 0, -2.85);
    const chiller = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.88, 0.88), coolingMat);
    chiller.position.y = 0.44;
    chiller.castShadow = true;
    coolingPlant.add(chiller);
    for (let index = 0; index < 3; index += 1) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.84, 28), coolingMat);
      tower.position.set(-0.52 + index * 0.52, 1.04, 0.82);
      tower.castShadow = true;
      coolingPlant.add(tower);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 28), new THREE.MeshBasicMaterial({ color: "#071219" }));
      fan.rotation.x = Math.PI / 2;
      fan.position.set(tower.position.x, 1.48, tower.position.z);
      coolingPlant.add(fan);
    }
    const coolingLabel = createLabel("Cooling Plant", "#b7ecff");
    if (coolingLabel) {
      coolingLabel.position.set(0, 2.05, 0.2);
      coolingPlant.add(coolingLabel);
    }
    scene.add(coolingPlant);

    const substation = new THREE.Group();
    substation.position.set(5.4, 0, -3.15);
    const electricalMat = new THREE.MeshPhysicalMaterial({ color: "#2c3640", roughness: 0.3, metalness: 0.78, clearcoat: 0.2 });
    for (let index = 0; index < 5; index += 1) {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.5), electricalMat);
      cabinet.position.set(-0.7 + index * 0.35, 0.45, 0);
      cabinet.castShadow = true;
      substation.add(cabinet);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.015), new THREE.MeshBasicMaterial({ color: index < 4 ? "#76d7b2" : "#ffc857" }));
      light.position.set(cabinet.position.x, 0.78, -0.26);
      substation.add(light);
    }
    const transformer = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.62, 0.72), electricalMat);
    transformer.position.set(0.25, 0.31, 0.78);
    transformer.castShadow = true;
    substation.add(transformer);
    const subLabel = createLabel("Utility + UPS", "#ffe3a3");
    if (subLabel) {
      subLabel.position.set(0, 1.72, 0.12);
      substation.add(subLabel);
    }
    scene.add(substation);

    const battery = new THREE.Group();
    battery.position.set(4.7, 0, 2.55);
    const batteryMat = new THREE.MeshPhysicalMaterial({ color: "#365057", roughness: 0.3, metalness: 0.64, clearcoat: 0.22 });
    for (let index = 0; index < 6; index += 1) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.86, 0.42), batteryMat);
      cell.position.set(-0.95 + index * 0.38, 0.43, 0);
      cell.castShadow = true;
      battery.add(cell);
      const soc = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.018), new THREE.MeshBasicMaterial({ color: "#76d7b2" }));
      soc.position.set(cell.position.x, 0.72, -0.22);
      battery.add(soc);
    }
    const batteryLabel = createLabel("Solar + Battery", "#b7ffd8");
    if (batteryLabel) {
      batteryLabel.position.set(0, 1.65, 0.1);
      battery.add(batteryLabel);
    }
    scene.add(battery);

    const curves = [
      addTube(scene, [new THREE.Vector3(-5.15, 0.35, -2.55), new THREE.Vector3(-3.8, 0.45, -1.7), new THREE.Vector3(-2.8, 0.45, -0.85)], "#4bd7ff"),
      addTube(scene, [new THREE.Vector3(5.4, 0.5, -3.0), new THREE.Vector3(3.85, 0.65, -2.2), new THREE.Vector3(2.55, 0.7, -1.15)], "#ffc857", 0.028),
      addTube(scene, [new THREE.Vector3(4.7, 0.55, 2.55), new THREE.Vector3(2.6, 0.74, 1.4), new THREE.Vector3(0.4, 0.8, -0.45), new THREE.Vector3(-1.5, 0.78, -0.75)], "#76d7b2", 0.03),
      addTube(scene, [new THREE.Vector3(-2.05, 1.65, -0.75), new THREE.Vector3(-0.2, 2.25, -0.35), new THREE.Vector3(2.55, 1.7, -1.15)], "#ff7d66", 0.022)
    ];

    const flowMarkers: Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; speed: number; phase: number }> = [];
    curves.forEach((curve, index) => {
      for (let marker = 0; marker < 4; marker += 1) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 16, 16),
          new THREE.MeshBasicMaterial({ color: index === 0 ? "#4bd7ff" : index === 1 ? "#ffc857" : index === 2 ? "#76d7b2" : "#ff7d66" })
        );
        scene.add(mesh);
        flowMarkers.push({ mesh, curve, speed: 0.055 + index * 0.008, phase: marker / 4 });
      }
    });

    const cfeLabel = createLabel(`24/7 CFE ${summary.cfe.toFixed(1)}%`, "#b7ffd8");
    if (cfeLabel) {
      cfeLabel.position.set(0.2, 3.25, 1.92);
      scene.add(cfeLabel);
    }
    const carbonLabel = createLabel(`${summary.carbon.toFixed(1)} tCO2e/h LB`, "#ffd2c7");
    if (carbonLabel) {
      carbonLabel.position.set(-0.2, 2.95, -3.65);
      scene.add(carbonLabel);
    }
    const capacityLabel = createLabel(`${summary.racks} racks / ${summary.chips} chips`, "#dff8ff");
    if (capacityLabel) {
      capacityLabel.position.set(0.2, 2.75, 3.6);
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
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      flowMarkers.forEach((item) => {
        item.mesh.position.copy(item.curve.getPoint((item.phase + elapsed * item.speed) % 1));
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
