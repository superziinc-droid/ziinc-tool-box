const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

if (!script) {
  throw new Error("Cannot find inline script in index.html");
}

const start = script.indexOf("function formatNumber");
const end = script.indexOf("function hertzNumber");

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Cannot isolate pipe calculation code");
}

const pipeCode = script.slice(start, end);

const testProgram = `
let pipeInputMap = {};
${pipeCode}

function approx(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual)) {
    throw new Error(label + " is not finite: " + actual);
  }
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(label + " expected " + expected + " got " + actual);
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(label);
}

function option(value, text) {
  return {
    value: String(value),
    selectedOptions: [{ textContent: text || String(value) }]
  };
}

function setPipeInputs(values = {}) {
  const defaults = {
    element: "circular",
    mediumPreset: "water20",
    mediumTemp: 20,
    phase: "liquid",
    flowMode: "volume",
    flowValue: 100,
    flowUnit: "m3h",
    density: 998.206,
    densityUnit: "kg_m3",
    viscosity: 1001.605,
    viscosityUnit: "uPaS",
    count: 1,
    diameter: 100,
    secondDiameter: 160,
    length: 1000,
    roughness: 0.1,
    angle: 90,
    radiusRatio: 1.5,
    openArea: 60,
    extraZeta: 0,
    inletPressure: 1.01325,
    inletTemp: 20,
    outletTemp: 20,
    targetDrop: 0.1,
    targetDropUnit: "bar",
    resultPressureUnit: "bar",
    solveTarget: "auto"
  };
  const merged = { ...defaults, ...values };
  pipeInputMap = Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, option(value)]));
}

function baseData(overrides = {}) {
  const element = overrides.element || "circular";
  return {
    element,
    elementName: pipeElementCatalog[element].name,
    elementDef: pipeElementCatalog[element],
    medium: "Water 20°C",
    mediumTempC: 20,
    phase: "liquid",
    flowMode: "volume",
    flowValue: 100,
    flowUnit: "m3h",
    densityKgM3: 998.206,
    densityUnit: "kg_m3",
    viscosityPaS: 1001.605e-6,
    count: 1,
    diameterM: 0.1,
    secondDiameterM: 0.16,
    lengthM: 1,
    roughnessM: 0.0001,
    angleDeg: 90,
    radiusRatio: 1.5,
    openAreaRatio: 0.6,
    extraZeta: 0,
    inletPressurePa: 101325,
    inletTempK: 293.15,
    outletTempK: 293.15,
    ...overrides
  };
}

const straight = calculatePipeDrop(baseData());
approx(straight.velocityMS, 3.53677651315323, 1e-12, "straight velocity");
approx(straight.reynolds, 352477.4273381857, 1e-6, "straight Reynolds");
approx(straight.lambda, 0.02045767358321545, 1e-10, "straight Darcy lambda");
approx(straight.totalZeta, 0.2045767358321545, 1e-10, "straight total zeta");
approx(pipePressurePaToUnit(straight.totalPressureDropPa, "bar"), 0.012772080901061076, 1e-10, "straight pressure drop bar");

approx(pipeFlowValueToM3S(1, "m3h"), 1 / 3600, 1e-15, "m3h conversion");
approx(pipeFlowValueToM3S(60, "lmin"), 0.001, 1e-15, "L/min conversion");
approx(pipeFlowValueToM3S(1, "nm3h"), 1 / 3600, 1e-15, "Nm3/h conversion");
approx(pipeFlowValueToM3S(1, "nm3min"), 1 / 60, 1e-15, "Nm3/min conversion");
approx(pipeFlowValueToM3S(1, "nm3s"), 1, 1e-15, "Nm3/s conversion");

const downhill = calculatePipeDrop(baseData({ element: "heightDifference", elementDef: pipeElementCatalog.heightDifference, elementName: pipeElementCatalog.heightDifference.name, lengthM: -10 }));
approx(downhill.totalPressureDropPa, -998.206 * 9.80665 * 10, 1e-8, "negative height pressure gain");

const orificeTarget = calculatePipeDrop(baseData({ element: "orifice", elementDef: pipeElementCatalog.orifice, elementName: pipeElementCatalog.orifice.name, secondDiameterM: 0.05 })).totalPressureDropPa;

setPipeInputs({ element: "orifice", diameter: 100, secondDiameter: 20, solveTarget: "secondDiameter" });
const solvedBore = solvePipeVariableForTarget(orificeTarget, { key: "secondDiameter", label: "孔径 d", input: pipeInputMap.secondDiameter });
approx(solvedBore.valueMm, 50, 1e-5, "reverse solve bore diameter");

setPipeInputs({ element: "orifice", diameter: 150, secondDiameter: 50, solveTarget: "diameter" });
const solvedPipe = solvePipeVariableForTarget(orificeTarget, { key: "diameter", label: "管径 D", input: pipeInputMap.diameter });
approx(solvedPipe.valueMm, 100, 1e-5, "reverse solve pipe diameter");

for (const diameterMm of [20, 50, 100, 250, 1000]) {
  const result = calculatePipeDrop(baseData({
    diameterM: diameterMm / 1000,
    secondDiameterM: Math.max(0.01, diameterMm / 2000),
    lengthM: 2,
    roughnessM: 0.00002
  }));
  assert(Number.isFinite(result.totalPressureDropPa) && result.totalPressureDropPa >= 0, "finite circular result " + diameterMm);
}

console.log("pipe regression tests passed");
`;

new Function(testProgram)();
