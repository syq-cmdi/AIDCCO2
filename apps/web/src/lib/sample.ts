import type { ChipSimulationResponse, ChipTwin, DigitalTwinResponse, EfficiencySummaryResponse, MatchingResult, OmniverseFidelityPolicy, QuotaStatus, RackTwin, RealtimeMetrics, ServerTwin } from "./api";

export const fallbackRealtime: RealtimeMetrics = {
  site_id: "aidc-sg-01",
  generated_at: new Date().toISOString(),
  interval_minutes: 5,
  metrics: {
    facility_energy_kwh: {
      value: 28430,
      unit: "kWh",
      method_version: "nrt-dmrv-v0.1",
      data_quality_flag: "measured",
      uncertainty_range: [27600, 29290]
    },
    it_energy_kwh: {
      value: 23510,
      unit: "kWh",
      method_version: "iso-iec-30134-v0.1",
      data_quality_flag: "measured",
      uncertainty_range: [22820, 24120]
    },
    pue: {
      value: 1.21,
      unit: "ratio",
      method_version: "iso-iec-30134-v0.1",
      data_quality_flag: "measured",
      uncertainty_range: [1.18, 1.24]
    },
    cue: {
      value: 0.42,
      unit: "kgCO2e/IT-kWh",
      method_version: "cue-ghgp-v0.1",
      data_quality_flag: "estimated",
      uncertainty_range: [0.37, 0.48]
    },
    wue: {
      value: 0.31,
      unit: "L/IT-kWh",
      method_version: "iso-iec-30134-v0.1",
      data_quality_flag: "measured",
      uncertainty_range: [0.28, 0.35]
    },
    ref: {
      value: 0.58,
      unit: "ratio",
      method_version: "iso-iec-30134-v0.1",
      data_quality_flag: "contractual",
      uncertainty_range: [0.55, 0.61]
    },
    location_based_emissions_kg: {
      value: 9875,
      unit: "kgCO2e",
      method_version: "ghgp-scope2-location-v0.1",
      data_quality_flag: "estimated",
      uncertainty_range: [8760, 11160]
    },
    market_based_emissions_kg: {
      value: 5024,
      unit: "kgCO2e",
      method_version: "ghgp-scope2-market-v0.1",
      data_quality_flag: "contractual",
      uncertainty_range: [4510, 5760]
    }
  }
};

export const fallbackQuota: QuotaStatus = {
  site_id: "aidc-sg-01",
  policy_id: "global-internal-netzero-2026",
  used_kg_co2e: 1480000,
  quota_kg_co2e: 2400000,
  remaining_kg_co2e: 920000,
  used_percent: 61.7,
  forecast_exceedance_date: null,
  compliance_gap_kg_co2e: 0,
  carbon_price_risk_usd: 0
};

export const fallbackMatching: MatchingResult = {
  site_id: "aidc-sg-01",
  cfe_score: 0.72,
  annual_match_ratio: 1.08,
  avoided_emissions_kg_co2e: 6420,
  unmatched_load_kwh: 7900,
  duplicate_certificate_ids: []
};

export const fallbackEfficiencySummary: EfficiencySummaryResponse = {
  site_id: "aidc-sg-01",
  generated_at: "2026-06-07T00:00:00Z",
  method_version: "cross-layer-efficiency-v0.1",
  levers: [
    {
      lever: "workload_scheduling",
      title: "虚拟化与工作负载调度",
      headline: "SLA-sensitive + batch co-location on an improved Xen boost scheduler",
      primary_metric: "energy_saving_pct",
      primary_value: 0.1,
      reference_value: 0.7,
      endpoint: "/efficiency/workload-scheduling",
      insight: "Real-time QoS-ratio monitoring lets servers run hot without breaking SLAs, removing the need for overprovisioning."
    },
    {
      lever: "thermal_management",
      title: "热管理与冷却优化",
      headline: "Predictive hotspot detection co-scheduled with fan/cooling setpoints",
      primary_metric: "cooling_saving_pct",
      primary_value: 0.36,
      reference_value: 0.36,
      endpoint: "/efficiency/thermal-management",
      insight: "Anticipating hotspots avoids reactive fan overspeed; cooling power follows the affinity (cube) law."
    },
    {
      lever: "distributed_battery",
      title: "分布式电池技术",
      headline: "Distributed server-level LiFePO4 UPS shaves multi-hour power peaks",
      primary_metric: "extra_capacity_pct",
      primary_value: 0.24,
      reference_value: 0.24,
      endpoint: "/efficiency/distributed-battery",
      insight: "The data center becomes an energy-storage hub: batteries buffer peaks and renewable supply/demand mismatch."
    },
    {
      lever: "global_energy_routing",
      title: "全局分布式能源管理",
      headline: "Green forecast + green-aware WAN routing across geo-distributed sites",
      primary_metric: "interruption_reduction_x",
      primary_value: 4.2,
      reference_value: 5,
      endpoint: "/efficiency/global-energy-routing",
      insight: "Software-defined efficiency: place compute where and when green energy is available, with a brown-power fallback."
    },
    {
      lever: "optical_fabric",
      title: "光通信技术",
      headline: "High-speed optical links (40G/100G+/DWDM) for migration and congestion relief",
      primary_metric: "median_speedup_x",
      primary_value: 10,
      reference_value: 10,
      endpoint: "/efficiency/optical-fabric",
      insight: "Optical bandwidth is the enabler that makes intra-DC and cross-region workload mobility practical."
    }
  ],
  cross_layer_insights: [
    "能效与性能平衡：用实时 QoS 比率监控取代过度配置，是释放能效潜力的关键。",
    "绿能利用的动态性：数据中心正演变为'储能中心'，分布式储能既削峰也平抑绿能供需错配。",
    "软件定义的能效：硬件趋于固定能耗后，节能取决于软件如何感知温度、电力合约与网络带宽，动态调整算力的物理位置。",
    "数据中心能效已是跨层协同的系统工程，而非单点硬件升级。"
  ],
  safety_constraints: [
    "Efficiency estimates are operational guidance and never reduce audited Scope 1/2/3 emissions or SCI.",
    "All levers preserve SLA, redundancy (N+1), data-residency, and chip thermal limits."
  ]
};

export const hourlyCarbon = [468, 452, 441, 430, 398, 376, 344, 318, 290, 266, 238, 224, 236, 258, 286, 330, 382, 438, 478, 492, 510, 502, 486, 474];
export const hourlyLoad = [920, 880, 850, 820, 835, 900, 1040, 1180, 1290, 1340, 1380, 1420, 1470, 1500, 1540, 1580, 1660, 1720, 1680, 1580, 1450, 1280, 1110, 980];
export const cfeMatched = [340, 350, 360, 390, 460, 560, 690, 840, 1060, 1240, 1320, 1360, 1330, 1200, 1080, 940, 760, 580, 480, 420, 400, 380, 360, 350];

export const optimizerItems = [
  {
    title: "冷却数字孪生",
    impact: "预计 3.8% 站点电量下降",
    detail: "在 SLA 温度上限内提高冷冻水供水设定点，并锁定泵组最低冗余。"
  },
  {
    title: "碳感知训练调度",
    impact: "预计 5.2 tCO2e/日可避免排放",
    detail: "将可延迟训练窗口迁移到低边际排放时段，保持 GPU 队列等待小于 45 分钟。"
  },
  {
    title: "GPU 批处理与缓存",
    impact: "预计 8.4% SCI 下降",
    detail: "合并低优先级推理批次，提高加速卡利用率并减少重复 token 计算。"
  }
];

function chipsForServer(serverId: string, rackIndex: number, slotIndex: number, serverPowerKw: number, x: number, z: number): ChipTwin[] {
  const chipSpecs = [
    ...Array.from({ length: 8 }, (_, index) => [`GPU-${index + 1}`, "gpu", "HBM GPU SXM module", 820, 700, 0.088] as const),
    ["CPU-1", "cpu", "server CPU package", 620, 360, 0.07] as const,
    ["CPU-2", "cpu", "server CPU package", 620, 360, 0.07] as const,
    ...Array.from({ length: 4 }, (_, index) => [`HBM-${index + 1}`, "hbm", "stacked memory package", 92, 55, 0.025] as const),
    ["DPU-1", "dpu", "network acceleration package", 180, 110, 0.023] as const,
    ["VRM-1", "vrm", "power stage array", 260, 140, 0.033] as const
  ];

  return chipSpecs.map(([name, chipType, packageName, dieArea, tdp, share], index) => {
    const currentPower = serverPowerKw * 1000 * share;
    const utilization = Math.min(0.36 + slotIndex * 0.055 + (rackIndex % 5) * 0.025 + (index % 4) * 0.018, 0.98);
    const thermalResistance = chipType === "gpu" ? 0.045 : chipType === "cpu" ? 0.061 : 0.082;
    const junction = 41 + utilization * 28 + (currentPower / Math.max(tdp, 1)) * 16;
    const hotspot = junction + (chipType === "gpu" ? 6.5 : 4.2);
    return {
      id: `${serverId}-chip-${name.toLowerCase()}`,
      server_id: serverId,
      name,
      chip_type: chipType,
      package: packageName,
      die_area_mm2: dieArea,
      tdp_w: tdp,
      current_power_w: Number(currentPower.toFixed(3)),
      utilization: Number(utilization.toFixed(3)),
      junction_temp_c: Number(junction.toFixed(2)),
      hotspot_temp_c: Number(hotspot.toFixed(2)),
      coolant_flow_lpm: chipType === "gpu" || chipType === "cpu" ? Number((0.42 + currentPower / 1250).toFixed(3)) : 0,
      thermal_resistance_c_per_w: thermalResistance,
      carbon_kg_co2e_per_hour: Number(((currentPower / 1000) * 0.316).toFixed(6)),
      material_ref: `mdl://aidc/materials/chip/${chipType}-black-ceramic-gold-pins`,
      sensor_refs: [`redfish://server/${serverId}/thermal/${name}`, `nvml://server/${serverId}/power/${name}`],
      position: {
        x: x + ((index % 4) - 1.5) * 0.12,
        y: 0.22 + slotIndex * 0.16,
        z: z + Math.floor(index / 4) * 0.07
      }
    };
  });
}

function server(rackId: string, rackIndex: number, slotIndex: number, x: number, z: number): ServerTwin {
  const currentPower = 1.35 + slotIndex * 0.18 + (rackIndex % 4) * 0.11;
  const inlet = 21.5 + (rackIndex % 3) * 0.7 + slotIndex * 0.18;
  const serverId = `${rackId}-srv-${String(slotIndex + 1).padStart(2, "0")}`;
  return {
    id: serverId,
    rack_id: rackId,
    name: `GPU node ${String(rackIndex + 1).padStart(2, "0")}-${String(slotIndex + 1).padStart(2, "0")}`,
    u_position: 2 + slotIndex * 6,
    height_u: 4,
    model: "8xGPU liquid-ready server",
    serial_hash: `sha256:${String(rackIndex).padStart(2, "0")}${String(slotIndex).padStart(2, "0")}b75f`,
    owner: slotIndex % 2 === 0 ? "foundation-model-platform" : "inference-service",
    workload_pool: slotIndex % 2 === 0 ? "training" : "inference",
    rated_power_kw: 3.2,
    current_power_kw: Number(currentPower.toFixed(3)),
    gpu_count: 8,
    cpu_count: 2,
    inlet_temp_c: Number(inlet.toFixed(2)),
    outlet_temp_c: Number((inlet + 9.5 + slotIndex * 0.4).toFixed(2)),
    utilization: Number(Math.min(0.42 + slotIndex * 0.07 + (rackIndex % 4) * 0.03, 0.94).toFixed(3)),
    embodied_kg_co2e: 13800 + rackIndex * 120 + slotIndex * 80,
    lca_lifetime_hours: 5 * 365 * 24,
    telemetry_quality: slotIndex < 5 ? "measured" : "estimated",
    position: { x, y: 0.15 + slotIndex * 0.16, z },
    chips: chipsForServer(serverId, rackIndex, slotIndex, Number(currentPower.toFixed(3)), x, z)
  };
}

function rack(roomId: string, rackIndex: number, row: string, column: number, x: number, z: number): RackTwin {
  const rackId = `${roomId}-rack-${row}${String(column).padStart(2, "0")}`;
  const servers = Array.from({ length: 6 }, (_, slotIndex) => server(rackId, rackIndex, slotIndex, x, z));
  const currentKw = servers.reduce((sum, item) => sum + item.current_power_kw, 0);
  const pueOverhead = 1.14 + (rackIndex % 3) * 0.025;
  return {
    id: rackId,
    room_id: roomId,
    name: `Rack ${row}${String(column).padStart(2, "0")}`,
    row,
    column,
    height_u: 42,
    design_kw: 22,
    current_kw: Number(currentKw.toFixed(3)),
    inlet_temp_c: Number((servers.reduce((sum, item) => sum + item.inlet_temp_c, 0) / servers.length).toFixed(2)),
    outlet_temp_c: Number((servers.reduce((sum, item) => sum + item.outlet_temp_c, 0) / servers.length).toFixed(2)),
    pressure_pa: Number((18 + (rackIndex % 5) * 2.8).toFixed(1)),
    pue_overhead_factor: Number(pueOverhead.toFixed(3)),
    carbon_kg_co2e_per_hour: Number((currentKw * pueOverhead * 0.316).toFixed(3)),
    geometry_ref: `speckle://aidc-sg-01/${roomId}/${rackId}`,
    position: { x, y: 0, z },
    rotation_deg: row === "A" || row === "C" ? 0 : 180,
    servers
  };
}

const fallbackRacksA = [
  rack("sg-b1-hall-a", 0, "A", 1, -5.4, -2.4),
  rack("sg-b1-hall-a", 1, "A", 2, -3.6, -2.4),
  rack("sg-b1-hall-a", 2, "A", 3, -1.8, -2.4),
  rack("sg-b1-hall-a", 3, "B", 1, -5.4, 0.2),
  rack("sg-b1-hall-a", 4, "B", 2, -3.6, 0.2),
  rack("sg-b1-hall-a", 5, "B", 3, -1.8, 0.2)
];

const fallbackRacksB = [
  rack("sg-b1-hall-b", 6, "C", 1, 1.8, -2.4),
  rack("sg-b1-hall-b", 7, "C", 2, 3.6, -2.4),
  rack("sg-b1-hall-b", 8, "C", 3, 5.4, -2.4),
  rack("sg-b1-hall-b", 9, "D", 1, 1.8, 0.2),
  rack("sg-b1-hall-b", 10, "D", 2, 3.6, 0.2),
  rack("sg-b1-hall-b", 11, "D", 3, 5.4, 0.2)
];

const allFallbackRacks = [...fallbackRacksA, ...fallbackRacksB];
const fallbackChipCount = allFallbackRacks.reduce(
  (sum, item) => sum + item.servers.reduce((serverSum, serverItem) => serverSum + serverItem.chips.length, 0),
  0
);

const serverAudit = allFallbackRacks.flatMap((item) =>
  item.servers.map((node) => {
    const energy = node.current_power_kw;
    const overhead = energy * Math.max(item.pue_overhead_factor - 1, 0);
    const embodied = node.embodied_kg_co2e / node.lca_lifetime_hours;
    const location = (energy + overhead) * 0.316;
    const market = (energy + overhead) * 0.136;
    return {
      node_level: "server" as const,
      node_id: node.id,
      parent_id: item.id,
      allocation_path: ["facility_meter", "room_busway", item.id, node.id, "server_power_kw"],
      energy_kwh: Number(energy.toFixed(6)),
      cooling_overhead_kwh: Number(overhead.toFixed(6)),
      scope2_location_kg: Number(location.toFixed(6)),
      scope2_market_kg: Number(market.toFixed(6)),
      embodied_kg: Number(embodied.toFixed(6)),
      total_location_kg: Number((location + embodied).toFixed(6)),
      total_market_kg: Number((market + embodied).toFixed(6)),
      method_version: "rack-server-twin-carbon-audit-v0.1",
      data_quality_flag: node.telemetry_quality,
      evidence_refs: [`dcim://rack/${item.id}/server/${node.id}/power`, `bim://geometry/${item.geometry_ref}`]
    };
  })
);

const rackAudit = allFallbackRacks.map((item) => {
  const children = serverAudit.filter((line) => line.parent_id === item.id);
  return {
    node_level: "rack" as const,
    node_id: item.id,
    parent_id: item.room_id,
    allocation_path: ["sum", "rack", item.id],
    energy_kwh: Number(children.reduce((sum, line) => sum + line.energy_kwh, 0).toFixed(6)),
    cooling_overhead_kwh: Number(children.reduce((sum, line) => sum + line.cooling_overhead_kwh, 0).toFixed(6)),
    scope2_location_kg: Number(children.reduce((sum, line) => sum + line.scope2_location_kg, 0).toFixed(6)),
    scope2_market_kg: Number(children.reduce((sum, line) => sum + line.scope2_market_kg, 0).toFixed(6)),
    embodied_kg: Number(children.reduce((sum, line) => sum + line.embodied_kg, 0).toFixed(6)),
    total_location_kg: Number(children.reduce((sum, line) => sum + line.total_location_kg, 0).toFixed(6)),
    total_market_kg: Number(children.reduce((sum, line) => sum + line.total_market_kg, 0).toFixed(6)),
    method_version: "rack-server-twin-carbon-audit-v0.1",
    data_quality_flag: "estimated",
    evidence_refs: [`dcim://rack/${item.id}/pdu`, `bim://geometry/${item.geometry_ref}`]
  };
});

const campusAudit = {
  node_level: "campus" as const,
  node_id: "aidc-sg-01",
  parent_id: null,
  allocation_path: ["campus", "building", "room", "rack", "server"],
  energy_kwh: Number(rackAudit.reduce((sum, line) => sum + line.energy_kwh, 0).toFixed(6)),
  cooling_overhead_kwh: Number(rackAudit.reduce((sum, line) => sum + line.cooling_overhead_kwh, 0).toFixed(6)),
  scope2_location_kg: Number(rackAudit.reduce((sum, line) => sum + line.scope2_location_kg, 0).toFixed(6)),
  scope2_market_kg: Number(rackAudit.reduce((sum, line) => sum + line.scope2_market_kg, 0).toFixed(6)),
  embodied_kg: Number(rackAudit.reduce((sum, line) => sum + line.embodied_kg, 0).toFixed(6)),
  total_location_kg: Number(rackAudit.reduce((sum, line) => sum + line.total_location_kg, 0).toFixed(6)),
  total_market_kg: Number(rackAudit.reduce((sum, line) => sum + line.total_market_kg, 0).toFixed(6)),
  method_version: "rack-server-twin-carbon-audit-v0.1",
  data_quality_flag: "estimated",
  evidence_refs: ["campus://aidc-sg-01", "model://rhino-speckle-ifc", "dcim://site/aidc-sg-01"]
};

const fallbackEnvelopeComponents = [
  {
    id: "env-b1-exterior-wall-north",
    building_id: "sg-b1",
    room_id: null,
    component_type: "exterior_wall",
    material: "precast concrete + vapor barrier + insulated metal panel",
    area_m2: 1180,
    u_value_w_m2k: 0.38,
    leakage_class: "EN 12207 class 4 equivalent",
    embodied_kg_co2e: 412000,
    surface_temp_c: 27.4,
    geometry_ref: "usd://aidc-sg-01/envelope/exterior_wall_north",
    material_ref: "mdl://aidc/materials/envelope/brushed-insulated-metal-panel",
    sensor_refs: ["bms://envelope/north-wall/surface-temp", "pointcloud://scan/envelope/north-wall"],
    position: { x: 0, y: 1.7, z: -5.25 }
  },
  {
    id: "env-b1-roof-white-membrane",
    building_id: "sg-b1",
    room_id: null,
    component_type: "roof",
    material: "cool roof membrane + PIR insulation + steel deck",
    area_m2: 1640,
    u_value_w_m2k: 0.24,
    leakage_class: "sealed roof penetration register",
    embodied_kg_co2e: 356000,
    surface_temp_c: 31.8,
    geometry_ref: "usd://aidc-sg-01/envelope/roof_white_membrane",
    material_ref: "mdl://aidc/materials/envelope/slightly-rough-white-roof",
    sensor_refs: ["bms://roof/solar-temp", "weather://site/global-horizontal-irradiance"],
    position: { x: 0, y: 3.25, z: -1.1 }
  },
  {
    id: "env-hall-a-hot-aisle-containment",
    building_id: "sg-b1",
    room_id: "sg-b1-hall-a",
    component_type: "hot_aisle_containment",
    material: "low-iron glass panels + anodized aluminum frame",
    area_m2: 142,
    u_value_w_m2k: 5.6,
    leakage_class: "containment leakage <= 3%",
    embodied_kg_co2e: 18200,
    surface_temp_c: 33.2,
    geometry_ref: "usd://aidc-sg-01/envelope/hall-a-hot-aisle-containment",
    material_ref: "mdl://aidc/materials/envelope/clear-tempered-glass-aluminum-frame",
    sensor_refs: ["bms://hall-a/hot-aisle/differential-pressure", "bms://hall-a/hot-aisle/temp"],
    position: { x: -3.6, y: 1.35, z: 0.2 }
  },
  {
    id: "env-hall-b-liquid-row-cold-aisle",
    building_id: "sg-b1",
    room_id: "sg-b1-hall-b",
    component_type: "cold_aisle_containment",
    material: "polycarbonate roof panels + steel doors",
    area_m2: 136,
    u_value_w_m2k: 4.8,
    leakage_class: "containment leakage <= 2.5%",
    embodied_kg_co2e: 16900,
    surface_temp_c: 22.6,
    geometry_ref: "usd://aidc-sg-01/envelope/hall-b-cold-aisle-containment",
    material_ref: "mdl://aidc/materials/envelope/translucent-polycarbonate",
    sensor_refs: ["bms://hall-b/cold-aisle/differential-pressure", "bms://hall-b/cold-aisle/temp"],
    position: { x: 3.6, y: 1.35, z: -2.4 }
  },
  {
    id: "env-b1-raised-floor",
    building_id: "sg-b1",
    room_id: null,
    component_type: "raised_floor",
    material: "anti-static perforated steel tiles on pedestal grid",
    area_m2: 1320,
    u_value_w_m2k: 1.9,
    leakage_class: "tile leakage measured by commissioning balance",
    embodied_kg_co2e: 221000,
    surface_temp_c: 20.8,
    geometry_ref: "usd://aidc-sg-01/envelope/raised_floor",
    material_ref: "mdl://aidc/materials/floor/perforated-anti-static-steel-tile",
    sensor_refs: ["bms://floor/plenum/static-pressure", "pointcloud://scan/raised-floor-grid"],
    position: { x: 0, y: 0, z: -1.1 }
  }
];

const fallbackCoolingSystem = [
  {
    id: "chw-chiller-01",
    building_id: "sg-b1",
    equipment_type: "water_cooled_chiller",
    loop: "primary_chilled_water",
    name: "Primary chiller 01",
    current_kw: 148,
    cooling_load_kw: 830,
    flow_lps: 42.5,
    supply_temp_c: 16,
    return_temp_c: 21.4,
    delta_p_kpa: 94,
    cop: 5.61,
    status: "running",
    geometry_ref: "usd://aidc-sg-01/cooling/chiller-01",
    sensor_refs: ["bms://chiller-01/power", "bms://chiller-01/chw-supply", "bms://chiller-01/chw-return"],
    position: { x: -7.1, y: 0.8, z: 2.7 }
  },
  {
    id: "chw-pump-p01",
    building_id: "sg-b1",
    equipment_type: "primary_chilled_water_pump",
    loop: "primary_chilled_water",
    name: "Primary CHW pump P01",
    current_kw: 18.4,
    cooling_load_kw: 830,
    flow_lps: 42.5,
    supply_temp_c: 16,
    return_temp_c: 21.4,
    delta_p_kpa: 118,
    cop: null,
    status: "running",
    geometry_ref: "usd://aidc-sg-01/cooling/chw-pump-p01",
    sensor_refs: ["bms://chw-pump-p01/vfd", "bms://chw-pump-p01/dp"],
    position: { x: -6, y: 0.45, z: 2.4 }
  },
  {
    id: "ct-01",
    building_id: "sg-b1",
    equipment_type: "cooling_tower",
    loop: "condenser_water",
    name: "Cooling tower 01",
    current_kw: 22.6,
    cooling_load_kw: 978,
    flow_lps: 48.1,
    supply_temp_c: 29.4,
    return_temp_c: 34.9,
    delta_p_kpa: 66,
    cop: null,
    status: "running",
    geometry_ref: "usd://aidc-sg-01/cooling/cooling-tower-01",
    sensor_refs: ["bms://ct-01/fan-power", "bms://ct-01/cw-supply", "bms://ct-01/cw-return"],
    position: { x: -7.2, y: 2.1, z: -4.8 }
  },
  {
    id: "phx-01",
    building_id: "sg-b1",
    equipment_type: "plate_heat_exchanger",
    loop: "secondary_liquid",
    name: "Liquid cooling plate heat exchanger 01",
    current_kw: 3.2,
    cooling_load_kw: 420,
    flow_lps: 28,
    supply_temp_c: 28,
    return_temp_c: 34,
    delta_p_kpa: 52,
    cop: null,
    status: "running",
    geometry_ref: "usd://aidc-sg-01/cooling/plate-heat-exchanger-01",
    sensor_refs: ["bms://phx-01/secondary-flow", "bms://phx-01/approach-temp"],
    position: { x: 6.8, y: 0.7, z: 2.6 }
  },
  {
    id: "cdu-row-c01",
    building_id: "sg-b1",
    equipment_type: "cdu",
    loop: "secondary_liquid",
    name: "CDU row C01",
    current_kw: 6.7,
    cooling_load_kw: 310,
    flow_lps: 20.5,
    supply_temp_c: 28.2,
    return_temp_c: 35.1,
    delta_p_kpa: 72,
    cop: null,
    status: "running",
    geometry_ref: "usd://aidc-sg-01/cooling/cdu-row-c01",
    sensor_refs: ["bms://cdu-row-c01/pump-power", "bms://cdu-row-c01/leak-detection"],
    position: { x: 6.5, y: 0.75, z: 1.6 }
  },
  {
    id: "crah-a01",
    building_id: "sg-b1",
    equipment_type: "crah",
    loop: "airside",
    name: "CRAH A01",
    current_kw: 14.2,
    cooling_load_kw: 260,
    flow_lps: 0,
    supply_temp_c: 19.5,
    return_temp_c: 31.8,
    delta_p_kpa: 0.8,
    cop: null,
    status: "running",
    geometry_ref: "usd://aidc-sg-01/cooling/crah-a01",
    sensor_refs: ["bms://crah-a01/fan-power", "bms://crah-a01/discharge-air"],
    position: { x: -7, y: 0.9, z: -1.3 }
  }
];

const fallbackElectricalSystem = [
  {
    id: "util-meter-01",
    building_id: "sg-b1",
    equipment_type: "revenue_meter",
    name: "Utility revenue meter 01",
    upstream_id: null,
    voltage_v: 22000,
    current_a: 1020,
    real_power_kw: 31800,
    power_factor: 0.97,
    loss_kw: 0,
    meter_class: "0.2S",
    status: "energized",
    geometry_ref: "usd://aidc-sg-01/electrical/utility-meter-01",
    sensor_refs: ["meter://utility/revenue-01/kwh", "meter://utility/revenue-01/pq"],
    position: { x: 7.4, y: 1.1, z: -4.7 }
  },
  {
    id: "tx-01",
    building_id: "sg-b1",
    equipment_type: "transformer",
    name: "22kV/415V transformer 01",
    upstream_id: "util-meter-01",
    voltage_v: 415,
    current_a: 3820,
    real_power_kw: 2450,
    power_factor: 0.96,
    loss_kw: 24.5,
    meter_class: "IEC 60076 loss model",
    status: "energized",
    geometry_ref: "usd://aidc-sg-01/electrical/transformer-01",
    sensor_refs: ["meter://tx-01/load", "thermal://tx-01/oil-temp"],
    position: { x: 7.1, y: 0.8, z: -3.7 }
  },
  {
    id: "ups-a",
    building_id: "sg-b1",
    equipment_type: "ups",
    name: "UPS block A",
    upstream_id: "tx-01",
    voltage_v: 415,
    current_a: 1860,
    real_power_kw: 1180,
    power_factor: 0.98,
    loss_kw: 31.4,
    meter_class: "IEC 62040 metered efficiency",
    status: "energized",
    geometry_ref: "usd://aidc-sg-01/electrical/ups-a",
    sensor_refs: ["meter://ups-a/input", "meter://ups-a/output", "bms://ups-a/battery-soc"],
    position: { x: 7, y: 0.9, z: -2.6 }
  },
  {
    id: "busway-hall-a",
    building_id: "sg-b1",
    equipment_type: "busway",
    name: "Hall A overhead busway",
    upstream_id: "ups-a",
    voltage_v: 415,
    current_a: 720,
    real_power_kw: 455,
    power_factor: 0.99,
    loss_kw: 4.1,
    meter_class: "branch meter 0.5S",
    status: "energized",
    geometry_ref: "usd://aidc-sg-01/electrical/busway-hall-a",
    sensor_refs: ["meter://busway-hall-a/kwh", "thermal://busway-hall-a/joints"],
    position: { x: -3.6, y: 2.65, z: -1.1 }
  },
  {
    id: "pdu-rack-a01",
    building_id: "sg-b1",
    equipment_type: "pdu",
    name: "Rack A01 intelligent PDU",
    upstream_id: "busway-hall-a",
    voltage_v: 415,
    current_a: 24,
    real_power_kw: 9.97,
    power_factor: 0.99,
    loss_kw: 0.08,
    meter_class: "outlet metering 1%",
    status: "energized",
    geometry_ref: "usd://aidc-sg-01/electrical/pdu-rack-a01",
    sensor_refs: ["pdu://rack-a01/kwh", "pdu://rack-a01/outlet-current"],
    position: { x: -5.4, y: 1.4, z: -1.7 }
  }
];

export const fallbackDigitalTwin: DigitalTwinResponse = {
  site_id: "aidc-sg-01",
  generated_at: new Date().toISOString(),
  refresh_seconds: 1,
  model_sources: [
    {
      name: "Rhino 8 / Grasshopper",
      tool_type: "commercial_cad",
      official_url: "https://www.rhino3d.com/download/",
      connector: "Rhino.Compute REST API + Grasshopper Hops",
      supported_formats: ["3DM", "GH", "STEP", "IGES", "OBJ", "FBX", "glTF via export pipeline"],
      integration_status: "optional_license_required",
      audit_role: "高真实感建模、机柜间距、围护结构、MEP 路由和 CFD-ready 曲面。"
    },
    {
      name: "Speckle",
      tool_type: "model_hub",
      official_url: "https://docs.speckle.systems/connectors",
      connector: "Rhino / Grasshopper / Revit / Blender connectors + REST API",
      supported_formats: ["IFC", "3DM", "OBJ", "PLY", "STL", "STEP", "FBX"],
      integration_status: "open_source_ready",
      audit_role: "模型版本、对象元数据、设计变更血缘和跨工具同步。"
    },
    {
      name: "Three.js glTF runtime",
      tool_type: "web_3d_engine",
      official_url: "https://threejs.org/",
      connector: "Browser WebGL scene with GLB/glTF loader and telemetry overlays",
      supported_formats: ["GLB", "glTF", "KTX2", "Draco-compressed meshes"],
      integration_status: "configured",
      audit_role: "平台内机柜级三维场景、碳热图和传感器叠加。"
    }
  ],
  campus: {
    site_id: "aidc-sg-01",
    name: "AIDC Singapore Digital Twin",
    coordinate_system: "EPSG:3414 + local BIM origin",
    buildings: [
      {
        id: "sg-b1",
        site_id: "aidc-sg-01",
        name: "Compute Building 1",
        geometry_ref: "rhino://aidc-sg-01/campus/compute-building-1.3dm",
        rooms: [
          {
            id: "sg-b1-hall-a",
            building_id: "sg-b1",
            name: "AI Hall A",
            floor: "L2",
            cooling_topology: "hot_aisle_containment",
            geometry_ref: "ifc://aidc-sg-01/building-1/hall-a.ifc#IfcSpace/AI-HALL-A",
            point_cloud_ref: "e57://aidc-sg-01/as-built/2026-05-hall-a.e57",
            racks: fallbackRacksA
          },
          {
            id: "sg-b1-hall-b",
            building_id: "sg-b1",
            name: "AI Hall B",
            floor: "L2",
            cooling_topology: "liquid_cooling_hybrid",
            geometry_ref: "ifc://aidc-sg-01/building-1/hall-b.ifc#IfcSpace/AI-HALL-B",
            point_cloud_ref: "las://aidc-sg-01/as-built/2026-05-hall-b.laz",
            racks: fallbackRacksB
          }
        ]
      }
    ]
  },
  envelope_components: fallbackEnvelopeComponents,
  primary_cooling_system: fallbackCoolingSystem,
  electrical_metering_system: fallbackElectricalSystem,
  rack_count: fallbackRacksA.length + fallbackRacksB.length,
  server_count: allFallbackRacks.reduce((sum, item) => sum + item.servers.length, 0),
  chip_count: fallbackChipCount,
  aggregate_location_kg_per_hour: campusAudit.total_location_kg,
  aggregate_market_kg_per_hour: campusAudit.total_market_kg,
  server_layer_audit: [campusAudit, ...rackAudit, ...serverAudit]
};

const fallbackFirstServer = fallbackRacksA[0].servers[0];

export const fallbackChipSimulation: ChipSimulationResponse = {
  site_id: "aidc-sg-01",
  generated_at: new Date().toISOString(),
  rack_id: fallbackRacksA[0].id,
  server_id: fallbackFirstServer.id,
  solver_method: "reduced-order liquid/air thermal network + NVML/Redfish telemetry binding v0.1",
  timestep_ms: 1000,
  total_chip_power_kw: Number((fallbackFirstServer.chips.reduce((sum, chip) => sum + chip.current_power_w, 0) / 1000).toFixed(6)),
  max_junction_temp_c: Math.max(...fallbackFirstServer.chips.map((chip) => chip.junction_temp_c)),
  max_hotspot_temp_c: Math.max(...fallbackFirstServer.chips.map((chip) => chip.hotspot_temp_c)),
  coolant_flow_lpm: Number(fallbackFirstServer.chips.reduce((sum, chip) => sum + chip.coolant_flow_lpm, 0).toFixed(3)),
  chip_count: fallbackFirstServer.chips.length,
  chips: fallbackFirstServer.chips
};

export const fallbackOmniversePolicy: OmniverseFidelityPolicy = {
  site_id: "aidc-sg-01",
  generated_at: new Date().toISOString(),
  target_fidelity: "Omniverse/OpenUSD photoreal operations twin: path-traced validation, real-time web operations, rack/server carbon audit parity.",
  usd_stage_uri: "omniverse://aidc-sg-01/stages/campus_root.usd",
  web_runtime_uri: "glb://aidc-sg-01/web-runtime/campus_lod2.glb",
  renderer_modes: [
    "Omniverse RTX Real-Time 2.0",
    "Omniverse RTX Interactive Path Tracing",
    "Three.js PBR browser fallback",
    "Offline still-frame QA"
  ],
  policy_principles: [
    "OpenUSD 是高真实感主场景图，GLB 是浏览器运行派生产物。",
    "所有影响碳核算的可见对象必须绑定 asset_id、rack_id/server_id、material_id、model_version 和 evidence_ref。",
    "视觉 LOD 可以简化几何，但碳核算始终绑定计量、LCA 和证据链。",
    "绿证、PPA、offset 和 avoided emissions 分开披露，不冲抵 server 层物理排放。"
  ],
  tool_integrations: [
    {
      name: "NVIDIA Omniverse Kit SDK",
      category: "usd_platform",
      official_url: "https://docs.nvidia.com/omniverse/index.html",
      integration_role: "构建 OpenUSD 高真实感应用、扩展和碳核查数据面板。",
      connector: "Kit SDK extension: aidc.carbon.audit + aidc.telemetry.overlay",
      runtime_status: "requires_license",
      evidence_refs: ["official://nvidia/omniverse-kit-sdk", "usd://aidc-sg-01/extensions/aidc.carbon.audit"]
    },
    {
      name: "Omniverse RTX Renderer",
      category: "rendering",
      official_url: "https://docs.omniverse.nvidia.com/composer/latest/feature_rendering.html",
      integration_role: "实时运维用 Real-Time 2.0，验收签核用 Interactive Path Tracing。",
      connector: "OpenUSD render settings + material QA extension",
      runtime_status: "requires_license",
      evidence_refs: ["render://rtx-realtime-2.0", "render://rtx-interactive-path-tracing"]
    },
    {
      name: "Three.js PBR Web Runtime",
      category: "web_runtime",
      official_url: "https://threejs.org/",
      integration_role: "平台内浏览器原生机柜级 PBR 操作视图和碳热图。",
      connector: "apps/web/src/components/TwinScene.tsx",
      runtime_status: "installed",
      evidence_refs: ["npm://three", "web://localhost:3000/#孪生"]
    }
  ],
  pipeline_stages: [
    {
      stage_id: "capture-01",
      name: "Reality capture and coordinate lock",
      owner: "BIM / survey",
      input_formats: ["E57", "LAS", "LAZ", "IFC", "RVT"],
      output_formats: ["registered point cloud", "BIM origin transform", "as-built delta report"],
      acceptance_criteria: ["Rack anchor residual <= 20 mm", "Every rack has row, column, and geometry_ref"],
      automation_endpoint: "/digital-twin/{site_id}",
      status: "ready"
    },
    {
      stage_id: "usd-02",
      name: "OpenUSD scene composition",
      owner: "3D pipeline",
      input_formats: ["3DM", "IFC", "FBX", "OBJ", "Speckle object graph"],
      output_formats: ["USD", "USDA", "USDC", "USDZ"],
      acceptance_criteria: ["Stable prim paths", "AIDC carbon schema fields on rack/server prims", "Calibrated PBR material hashes"],
      automation_endpoint: "/photorealism/omniverse-policy/{site_id}",
      status: "requires_license"
    },
    {
      stage_id: "audit-04",
      name: "Carbon accounting binding",
      owner: "carbon MRV",
      input_formats: ["telemetry", "LCA/EPD", "EAC/PPA", "grid carbon intensity", "USD prim metadata"],
      output_formats: ["server audit lines", "evidence package", "SCI rates"],
      acceptance_criteria: ["Server lines reconcile to campus rollup", "Market instruments remain separate", "All lines have telemetry/model/LCA evidence"],
      automation_endpoint: "/carbon-audit/server-layer",
      status: "ready"
    }
  ],
  quality_gates: [
    {
      gate_id: "geo-mm",
      name: "As-built geometry tolerance",
      target: "<= 20 mm rack anchor error; <= 50 mm MEP route error",
      current: "20 mm simulated rack anchors; MEP route evidence configured",
      status: "warning",
      evidence_refs: ["pointcloud://aidc-sg-01/as-built/2026-05-hall-a.e57"]
    },
    {
      gate_id: "usd-schema",
      name: "OpenUSD carbon metadata schema",
      target: "All carbon-relevant prims carry stable IDs and evidence refs",
      current: "Schema policy defined; web/runtime sample has rack/server IDs",
      status: "pass",
      evidence_refs: ["usd://schema/AIDCCarbonBinding", "api://digital-twin/aidc-sg-01"]
    },
    {
      gate_id: "rtx-signoff",
      name: "RTX path-traced sign-off",
      target: "Approved RTX Interactive Path Tracing render per audited model version",
      current: "Requires Omniverse RTX runtime and licensed workstation/cloud streaming",
      status: "blocked",
      evidence_refs: ["official://nvidia/omniverse-rtx-renderer"]
    },
    {
      gate_id: "audit-reconcile",
      name: "Server-to-campus carbon reconciliation",
      target: "Absolute rollup delta <= 0.1%",
      current: "API tests verify 72 server lines and full hierarchy",
      status: "pass",
      evidence_refs: ["test://services/api/tests/test_api.py"]
    }
  ],
  accounting_integrations: [
    {
      name: "GHG Protocol / ISO 14064 inventory",
      domain: "corporate_inventory",
      official_url: "https://ghgprotocol.org/corporate-standard",
      connector: "Inventory export from emission_records and carbon_audit_lines",
      data_objects: ["EmissionRecord", "CarbonAuditLine", "EvidencePackage"],
      verification_controls: ["Scope separation", "location/market-based split", "offsets disclosed separately"],
      runtime_status: "configured"
    },
    {
      name: "openLCA IPC",
      domain: "lifecycle_assessment",
      official_url: "https://pypi.org/project/openlca-ipc/",
      connector: "Calculate server/GPU/building component LCA and return component factors",
      data_objects: ["LCAComponent", "ServerTwin", "Asset"],
      verification_controls: ["LCA database/version stored", "allocation basis stored", "uncertainty retained"],
      runtime_status: "planned"
    },
    {
      name: "Electricity Maps / marginal emissions API",
      domain: "marginal_emissions",
      official_url: "https://app.electricitymaps.com/developer-hub/api/getting-started",
      connector: "GridCarbonIntensity feed for average and marginal emissions",
      data_objects: ["GridCarbonIntensity", "HourlyEnergy"],
      verification_controls: ["Hourly timezone alignment", "source timestamp stored", "avoided emissions separate from inventory"],
      runtime_status: "requires_api_key"
    }
  ]
};
