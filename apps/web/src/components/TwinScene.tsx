"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { DigitalTwinResponse, RackTwin } from "../lib/api";

type TwinSceneProps = {
  twin: DigitalTwinResponse;
  selectedRackId?: string;
  onSelectRack?: (rack: RackTwin) => void;
};

function rackColor(rack: RackTwin, maxCarbon: number) {
  const ratio = Math.min(rack.carbon_kg_co2e_per_hour / Math.max(maxCarbon, 1), 1);
  return new THREE.Color().setHSL(0.34 - ratio * 0.32, 0.72, 0.46);
}

function createProceduralTexture(kind: "floor" | "wall" | "metal" | "pcb") {
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
      const rawNoise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = Math.floor((rawNoise - Math.floor(rawNoise)) * 18);
      const tileEdge = kind === "floor" && (x % 96 < 3 || y % 96 < 3);
      const groove = kind === "metal" && y % 18 < 2;
      const trace = kind === "pcb" && ((x + y * 2) % 73 < 3 || (x * 2 + y) % 89 < 3);
      let r = 38;
      let g = 50;
      let b = 57;
      if (kind === "wall") {
        r = 186;
        g = 196;
        b = 201;
      } else if (kind === "metal") {
        r = 86;
        g = 98;
        b = 105;
      } else if (kind === "pcb") {
        r = trace ? 198 : 22;
        g = trace ? 154 : 76;
        b = trace ? 82 : 62;
      }
      image.data[i] = Math.max(0, Math.min(255, r + grain + (tileEdge || groove ? 24 : 0)));
      image.data[i + 1] = Math.max(0, Math.min(255, g + grain + (tileEdge || groove ? 24 : 0)));
      image.data[i + 2] = Math.max(0, Math.min(255, b + grain + (tileEdge || groove ? 24 : 0)));
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

function createLabelTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.fillStyle = "rgba(16, 24, 32, 0.82)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f7fafb";
  context.font = "700 28px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function TwinScene({ twin, selectedRackId, onSelectRack }: TwinSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const racks = useMemo(
    () => twin.campus.buildings.flatMap((building) => building.rooms.flatMap((room) => room.racks)),
    [twin]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#101820");
    scene.fog = new THREE.Fog("#101820", 14, 30);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 120);
    camera.position.set(8, 7, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.8, -0.9);
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 5;
    controls.maxDistance = 24;

    const ambient = new THREE.HemisphereLight("#dff8ff", "#172026", 1.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight("#ffffff", 2.4);
    keyLight.position.set(-4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight("#76d7b2", 1.3, 18);
    fillLight.position.set(5, 3, -5);
    scene.add(fillLight);

    [-4.8, 0, 4.8].forEach((x) => {
      const panel = new THREE.RectAreaLight("#e9fbff", 2.2, 2.8, 0.55);
      panel.position.set(x, 3.15, -1.15);
      panel.rotation.x = -Math.PI / 2;
      scene.add(panel);
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.035, 0.55),
        new THREE.MeshBasicMaterial({ color: "#d9f4ff" })
      );
      fixture.position.copy(panel.position);
      scene.add(fixture);
    });

    const floorTexture = createProceduralTexture("floor");
    const wallTexture = createProceduralTexture("wall");
    const metalTexture = createProceduralTexture("metal");
    const pcbTexture = createProceduralTexture("pcb");
    floorTexture?.repeat.set(8, 5);
    wallTexture?.repeat.set(4, 2);
    metalTexture?.repeat.set(2, 2);
    pcbTexture?.repeat.set(2, 2);

    const floorMaterial = new THREE.MeshPhysicalMaterial({
      color: "#263640",
      map: floorTexture ?? undefined,
      roughness: 0.38,
      metalness: 0.16,
      clearcoat: 0.28,
      clearcoatRoughness: 0.55
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.08, 8.2), floorMaterial);
    floor.position.set(0, -0.04, -1.1);
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMaterial = new THREE.MeshPhysicalMaterial({
      color: "#c4ccd2",
      map: wallTexture ?? undefined,
      roughness: 0.72,
      metalness: 0.08
    });
    const sideWallMaterial = wallMaterial.clone();
    sideWallMaterial.color = new THREE.Color("#aeb9c0");
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(14.9, 3.15, 0.08), wallMaterial);
    backWall.position.set(0, 1.55, -5.23);
    backWall.receiveShadow = true;
    scene.add(backWall);
    [-7.48, 7.48].forEach((x) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.15, 8.28), sideWallMaterial);
      wall.position.set(x, 1.55, -1.1);
      wall.receiveShadow = true;
      scene.add(wall);
    });
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(14.9, 0.08, 8.25),
      new THREE.MeshPhysicalMaterial({ color: "#d9dee2", map: wallTexture ?? undefined, roughness: 0.65, metalness: 0.04 })
    );
    ceiling.position.set(0, 3.24, -1.1);
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    const wallStripeMaterial = new THREE.MeshBasicMaterial({ color: "#e9f4f7", transparent: true, opacity: 0.42 });
    for (let x = -6.8; x <= 6.8; x += 1.7) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.025, 2.7, 0.012), wallStripeMaterial);
      stripe.position.set(x, 1.62, -5.18);
      scene.add(stripe);
    }

    const tileLineMaterial = new THREE.LineBasicMaterial({ color: "#435867", transparent: true, opacity: 0.34 });
    for (let x = -7; x <= 7; x += 1) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.011, -5.2), new THREE.Vector3(x, 0.011, 3)]), tileLineMaterial);
      scene.add(line);
    }
    for (let z = -5; z <= 3; z += 1) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-7.4, 0.012, z), new THREE.Vector3(7.4, 0.012, z)]), tileLineMaterial);
      scene.add(line);
    }

    const grid = new THREE.GridHelper(15, 30, "#5f7482", "#253843");
    grid.position.y = 0.005;
    scene.add(grid);

    const trayMaterial = new THREE.MeshPhysicalMaterial({ color: "#6e7f89", map: metalTexture ?? undefined, roughness: 0.48, metalness: 0.82 });
    [-2.4, 0.2].forEach((z) => {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.12, 0.18), trayMaterial);
      tray.position.set(0, 2.82, z);
      tray.castShadow = true;
      scene.add(tray);
      for (let x = -6.2; x <= 6.2; x += 0.62) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.34), trayMaterial);
        rib.position.set(x, 2.86, z);
        scene.add(rib);
      }
    });

    const pipeMaterial = new THREE.MeshPhysicalMaterial({ color: "#2d98b8", roughness: 0.24, metalness: 0.62, clearcoat: 0.25 });
    [-3.05, 0.85].forEach((z) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 13.2, 24), pipeMaterial);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 2.48, z);
      pipe.castShadow = true;
      scene.add(pipe);
    });

    const aisleMaterials = {
      cold: new THREE.MeshStandardMaterial({ color: "#2364aa", transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
      hot: new THREE.MeshStandardMaterial({ color: "#c44e3a", transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    };
    const coldAisle = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 1.1), aisleMaterials.cold);
    coldAisle.rotation.x = -Math.PI / 2;
    coldAisle.position.set(0, 0.02, -2.4);
    scene.add(coldAisle);
    const hotAisle = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 1.1), aisleMaterials.hot);
    hotAisle.rotation.x = -Math.PI / 2;
    hotAisle.position.set(0, 0.025, 0.2);
    scene.add(hotAisle);

    const containmentGlass = new THREE.MeshPhysicalMaterial({
      color: "#d7f2ff",
      transparent: true,
      opacity: 0.18,
      roughness: 0.03,
      metalness: 0,
      transmission: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      side: THREE.DoubleSide
    });
    const containmentFrame = new THREE.MeshPhysicalMaterial({ color: "#202b32", roughness: 0.28, metalness: 0.82 });
    [-0.42, 0.82, -3.02, -1.78].forEach((z, index) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(13.25, 1.92, 0.035), containmentGlass);
      panel.position.set(0, 1.2, z);
      panel.castShadow = true;
      scene.add(panel);
      const header = new THREE.Mesh(new THREE.BoxGeometry(13.25, 0.055, 0.075), containmentFrame);
      header.position.set(0, 2.18, z);
      scene.add(header);
      if (index < 2) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.78, 0.045), containmentGlass);
        door.position.set(6.9, 1.05, z);
        scene.add(door);
      }
    });

    const chillerMaterial = new THREE.MeshPhysicalMaterial({ color: "#8ea0aa", map: metalTexture ?? undefined, roughness: 0.34, metalness: 0.68, clearcoat: 0.25 });
    const motorMaterial = new THREE.MeshPhysicalMaterial({ color: "#2d98b8", roughness: 0.28, metalness: 0.62, clearcoat: 0.18 });
    const electricalMaterial = new THREE.MeshPhysicalMaterial({ color: "#2c3640", map: metalTexture ?? undefined, roughness: 0.26, metalness: 0.78, clearcoat: 0.22 });
    [
      { name: "chiller", x: -6.65, y: 0.54, z: 2.55, w: 1.15, h: 1.08, d: 0.8 },
      { name: "phx", x: 6.65, y: 0.58, z: 2.55, w: 0.8, h: 1.16, d: 0.55 },
      { name: "cdu", x: 6.55, y: 0.63, z: 1.55, w: 0.62, h: 1.25, d: 0.5 },
      { name: "crah", x: -6.7, y: 0.83, z: -1.3, w: 0.68, h: 1.66, d: 0.74 }
    ].forEach((item) => {
      const equipment = new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h, item.d), chillerMaterial);
      equipment.position.set(item.x, item.y, item.z);
      equipment.castShadow = true;
      equipment.receiveShadow = true;
      scene.add(equipment);
      for (let offset = -0.22; offset <= 0.22; offset += 0.22) {
        const grille = new THREE.Mesh(new THREE.BoxGeometry(item.w * 0.74, 0.025, 0.014), new THREE.MeshBasicMaterial({ color: "#d7e3e8" }));
        grille.position.set(item.x, item.y + offset, item.z - item.d / 2 - 0.01);
        scene.add(grille);
      }
    });
    [-6.05, -5.65, 6.02].forEach((x, index) => {
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.48, 24), motorMaterial);
      pump.rotation.z = Math.PI / 2;
      pump.position.set(x, 0.34, index === 2 ? 2.05 : 2.42);
      pump.castShadow = true;
      scene.add(pump);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.32), trayMaterial);
      base.position.set(x, 0.06, index === 2 ? 2.05 : 2.42);
      scene.add(base);
    });
    for (let i = 0; i < 5; i += 1) {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.72, 0.54), electricalMaterial);
      cabinet.position.set(6.72, 0.86, -4.25 + i * 0.55);
      cabinet.castShadow = true;
      cabinet.receiveShadow = true;
      scene.add(cabinet);
      const meter = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.018), new THREE.MeshBasicMaterial({ color: i === 0 ? "#76d7b2" : "#d9f4ff" }));
      meter.position.set(6.5, 1.35, -4.25 + i * 0.55);
      scene.add(meter);
    }
    const roofTower = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 0.88), chillerMaterial);
    roofTower.position.set(-6.6, 3.68, -4.62);
    roofTower.castShadow = true;
    scene.add(roofTower);
    for (let i = 0; i < 2; i += 1) {
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 28), new THREE.MeshPhysicalMaterial({ color: "#19242b", roughness: 0.28, metalness: 0.7 }));
      fan.rotation.x = Math.PI / 2;
      fan.position.set(-6.85 + i * 0.5, 4.06, -4.62);
      scene.add(fan);
    }

    const maxCarbon = Math.max(...racks.map((rack) => rack.carbon_kg_co2e_per_hour), 1);
    const selectableMeshes: THREE.Mesh[] = [];
    const rackByUuid = new Map<string, RackTwin>();

    racks.forEach((rack) => {
      const group = new THREE.Group();
      group.position.set(rack.position.x, 0, rack.position.z);
      group.rotation.y = (rack.rotation_deg * Math.PI) / 180;

      const isSelected = rack.id === selectedRackId;
      const rackMaterial = new THREE.MeshPhysicalMaterial({
        color: rackColor(rack, maxCarbon),
        map: metalTexture ?? undefined,
        emissive: isSelected ? "#1f7a5c" : "#000000",
        emissiveIntensity: isSelected ? 0.34 : 0.05,
        roughness: 0.27,
        metalness: 0.74,
        clearcoat: 0.42,
        clearcoatRoughness: 0.32
      });
      const rackBody = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.22, 1.12), rackMaterial);
      rackBody.position.y = 1.11;
      rackBody.castShadow = true;
      rackBody.receiveShadow = true;
      rackBody.userData.rackId = rack.id;
      group.add(rackBody);
      selectableMeshes.push(rackBody);
      rackByUuid.set(rackBody.uuid, rack);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(rackBody.geometry),
        new THREE.LineBasicMaterial({ color: isSelected ? "#ffffff" : "#9fb2be", transparent: true, opacity: isSelected ? 0.9 : 0.38 })
      );
      edges.position.copy(rackBody.position);
      group.add(edges);

      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 2.04, 0.025),
        new THREE.MeshPhysicalMaterial({
          color: "#d7f2ff",
          transparent: true,
          opacity: 0.22,
          roughness: 0.05,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.03,
          transmission: 0.42
        })
      );
      glass.position.set(0, 1.13, -0.584);
      glass.castShadow = true;
      group.add(glass);

      const sideRailMaterial = new THREE.MeshPhysicalMaterial({ color: "#101820", map: metalTexture ?? undefined, roughness: 0.2, metalness: 0.86 });
      [-0.43, 0.43].forEach((x) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.18, 1.18), sideRailMaterial);
        rail.position.set(x, 1.1, 0);
        rail.castShadow = true;
        group.add(rail);
      });

      rack.servers.forEach((server, index) => {
        const serverRatio = Math.min(server.current_power_kw / server.rated_power_kw, 1);
        const serverMaterial = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color().setHSL(0.55 - serverRatio * 0.45, 0.78, 0.5),
          emissive: "#081012",
          emissiveIntensity: 0.15,
          roughness: 0.24,
          metalness: 0.78,
          clearcoat: 0.2
        });
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.06), serverMaterial);
        blade.position.set(0, 0.35 + index * 0.28, -0.59);
        blade.castShadow = true;
        blade.userData.rackId = rack.id;
        group.add(blade);

        [-0.22, 0, 0.22].forEach((x) => {
          const fan = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20),
            new THREE.MeshPhysicalMaterial({ color: "#1b2a35", roughness: 0.32, metalness: 0.7 })
          );
          fan.rotation.x = Math.PI / 2;
          fan.position.set(x, blade.position.y, -0.628);
          group.add(fan);
        });

        const led = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.025, 0.012),
          new THREE.MeshBasicMaterial({ color: serverRatio > 0.78 ? "#ffb25c" : "#76d7b2" })
        );
        led.position.set(0.31, blade.position.y + 0.035, -0.636);
        group.add(led);
      });

      if (isSelected && rack.servers[0]?.chips.length) {
        const board = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.42, 0.035),
          new THREE.MeshPhysicalMaterial({ color: "#174c3e", map: pcbTexture ?? undefined, roughness: 0.5, metalness: 0.08, clearcoat: 0.14 })
        );
        board.position.set(0, 0.24, -0.82);
        board.castShadow = true;
        board.userData.rackId = rack.id;
        group.add(board);

        const maxHotspot = Math.max(...rack.servers[0].chips.map((chip) => chip.hotspot_temp_c), 1);
        rack.servers[0].chips.slice(0, 12).forEach((chip, chipIndex) => {
          const intensity = chip.hotspot_temp_c / maxHotspot;
          const chipPackage = new THREE.Mesh(
            new THREE.BoxGeometry(chip.chip_type === "gpu" ? 0.12 : 0.075, 0.035, chip.chip_type === "gpu" ? 0.075 : 0.052),
            new THREE.MeshPhysicalMaterial({
              color: new THREE.Color().setHSL(0.34 - intensity * 0.28, 0.74, 0.38),
              emissive: new THREE.Color().setHSL(0.04, 0.8, 0.22),
              emissiveIntensity: chip.chip_type === "gpu" ? 0.22 : 0.08,
              roughness: 0.34,
              metalness: 0.35,
              clearcoat: 0.18
            })
          );
          chipPackage.position.set(-0.27 + (chipIndex % 4) * 0.18, 0.38 - Math.floor(chipIndex / 4) * 0.13, -0.85);
          chipPackage.userData.rackId = rack.id;
          group.add(chipPackage);
        });
        [-0.1, 0.1].forEach((y) => {
          const coldPlatePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.64, 12), pipeMaterial);
          coldPlatePipe.rotation.z = Math.PI / 2;
          coldPlatePipe.position.set(0, 0.24 + y, -0.88);
          group.add(coldPlatePipe);
        });
      }

      const labelTexture = createLabelTexture(rack.name);
      if (labelTexture) {
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true }));
        label.position.set(0, 2.55, -0.62);
        label.scale.set(0.9, 0.34, 1);
        group.add(label);
      }

      scene.add(group);
    });

    const arrowCold = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-6.8, 0.12, -2.4), 13.2, "#76b7ff", 0.3, 0.16);
    const arrowHot = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(6.8, 0.12, 0.2), 13.2, "#ff9b7f", 0.3, 0.16);
    scene.add(arrowCold, arrowHot);

    const pointCloudGeometry = new THREE.BufferGeometry();
    const points: number[] = [];
    for (let i = 0; i < 220; i += 1) {
      points.push((Math.random() - 0.5) * 14, 0.08 + Math.random() * 2.85, -4.8 + Math.random() * 7.3);
    }
    pointCloudGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const pointCloud = new THREE.Points(
      pointCloudGeometry,
      new THREE.PointsMaterial({ color: "#9fd9ff", size: 0.018, transparent: true, opacity: 0.34 })
    );
    scene.add(pointCloud);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onClick = (event: MouseEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObjects(selectableMeshes, false);
      if (hit && onSelectRack) {
        const rack = rackByUuid.get(hit.object.uuid);
        if (rack) {
          onSelectRack(rack);
        }
      }
    };
    renderer.domElement.addEventListener("click", onClick);

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
    const animate = () => {
      controls.update();
      frameId = window.requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("click", onClick);
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
        } else if (object instanceof THREE.Points) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((item) => item.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      [floorTexture, wallTexture, metalTexture, pcbTexture].forEach((texture) => texture?.dispose());
      container.removeChild(renderer.domElement);
    };
  }, [onSelectRack, racks, selectedRackId]);

  return <div className="twin-scene" ref={containerRef} />;
}
