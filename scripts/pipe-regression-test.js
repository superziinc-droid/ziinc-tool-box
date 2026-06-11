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
    viscosityMode: "dynamic",
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
    inletPressureUnit: "bar",
    inletTemp: 20,
    inletTempUnit: "C",
    outletTemp: 20,
    outletTempUnit: "C",
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
approx(pipeFlowValueToM3S(1, "m3min"), 1 / 60, 1e-15, "m3/min conversion");
approx(pipeFlowValueToM3S(60, "lmin"), 0.001, 1e-15, "L/min conversion");
approx(pipeFlowValueToM3S(1, "cuft_min"), 0.028316846592 / 60, 1e-15, "cu.ft./min conversion");
approx(pipeFlowValueToM3S(1, "bbl_day"), 0.158987294928 / 86400, 1e-15, "petr.bl./day conversion");
approx(pipeFlowValueToM3S(1, "gal_min"), 0.003785411784 / 60, 1e-15, "gal/min conversion");
approx(pipeFlowValueToM3S(1, "nm3h"), 1 / 3600, 1e-15, "Nm3/h conversion");
approx(pipeFlowValueToM3S(1, "nm3min"), 1 / 60, 1e-15, "Nm3/min conversion");
approx(pipeFlowValueToM3S(1, "nm3s"), 1, 1e-15, "Nm3/s conversion");
approx(pipeMassFlowValueToKgS(1, "kgmin"), 1 / 60, 1e-15, "kg/min conversion");
approx(pipeMassFlowValueToKgS(1, "lb_s"), 0.45359237, 1e-15, "lb/s conversion");
approx(pipeMassFlowValueToKgS(1, "oz_min"), 0.028349523125 / 60, 1e-15, "oz/min conversion");
approx(pipeDensityToKgM3(1, "kg_l"), 1000, 1e-12, "kg/l density conversion");
approx(pipeDensityToKgM3(1, "g_l"), 1, 1e-12, "g/l density conversion");
approx(pipeDensityToKgM3(1, "lb_gal"), 0.45359237 / 0.003785411784, 1e-12, "lb/gal density conversion");
approx(pipeViscosityToPaS(1, "cP", "dynamic", 1000), 0.001, 1e-15, "cP viscosity conversion");
approx(pipeViscosityToPaS(1, "cSt", "kinematic", 998.206), 998.206e-6, 1e-15, "cSt kinematic conversion");
approx(pipePressureToPa(1, "psia"), 6894.757293168, 1e-9, "psia pressure conversion");
approx(pipeTemperatureToK(68, "F"), 293.15, 1e-12, "degF temperature conversion");

const downhill = calculatePipeDrop(baseData({ element: "heightDifference", elementDef: pipeElementCatalog.heightDifference, elementName: pipeElementCatalog.heightDifference.name, lengthM: -10 }));
approx(downhill.totalPressureDropPa, -998.206 * 9.80665 * 10, 1e-8, "negative height pressure gain");

const orificeTarget = calculatePipeDrop(baseData({ element: "orifice", elementDef: pipeElementCatalog.orifice, elementName: pipeElementCatalog.orifice.name, secondDiameterM: 0.05 })).totalPressureDropPa;

assert(pipeElementCatalog.thickOrifice.fields.includes("length"), "thick orifice exposes L parameter");
assert(pipeSourceGroups.length === 12, "source menu exposes 12 pressure-drop groups");
assert(
  pipeSourceGroups.find((group) => group.value === "orifices").subgroups.find((subgroup) => subgroup.value === "orifices.thick").element === "thickOrifice",
  "source menu maps thick-edged orifice to thickOrifice"
);
const thickShort = calculatePipeDrop(baseData({ element: "thickOrifice", elementDef: pipeElementCatalog.thickOrifice, elementName: pipeElementCatalog.thickOrifice.name, secondDiameterM: 0.05, lengthM: 0.01 }));
const thickLong = calculatePipeDrop(baseData({ element: "thickOrifice", elementDef: pipeElementCatalog.thickOrifice, elementName: pipeElementCatalog.thickOrifice.name, secondDiameterM: 0.05, lengthM: 0.02 }));
approx(thickLong.totalZeta - thickShort.totalZeta, 0.02 * (0.01 / 0.05) / 0.5 ** 4, 1e-10, "thick orifice L thickness term");

const thickOriginalSample = calculatePipeDrop(baseData({
  element: "thickOrifice",
  elementDef: pipeElementCatalog.thickOrifice,
  elementName: pipeElementCatalog.thickOrifice.name,
  flowValue: 0.9,
  flowUnit: "lmin",
  diameterM: 0.006,
  secondDiameterM: 0.002,
  lengthM: 0.005,
  roughnessM: 0,
  densityKgM3: 998.206,
  viscosityPaS: 1001.61e-6
}));
approx(thickOriginalSample.velocityMS, 0.5305164769729845, 1e-12, "pressure-drop sample velocity");
approx(thickOriginalSample.reynolds, 3172.281010053584, 1e-6, "pressure-drop sample Reynolds");
approx(thickOriginalSample.totalZeta, 87, 5e-4, "pressure-drop sample zeta");
approx(pipePressurePaToUnit(thickOriginalSample.totalPressureDropPa, "bar"), 0.12221012457198419, 5e-7, "pressure-drop sample pressure drop bar");

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
