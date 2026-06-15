const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "tolerance_allocator_web.js"), "utf8");
const window = {};
const document = { readyState: "loading", addEventListener() {} };

new Function("window", "document", script)(window, document);

const {
  calculateSingle,
  calculateTwoFace,
  baseRatioSingle,
  baseRatioTwoFace
} = window.ZiincToleranceAllocator;

function approx(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual)) throw new Error(`${label} is not finite: ${actual}`);
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} expected ${expected} got ${actual}`);
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(label);
}

approx(baseRatioSingle(["平面度", "平行度"], "间隙", "标准", true), 0.3591, 1e-12, "single default geo ratio");

const single = calculateSingle({
  nominal: 500,
  total: 0.08,
  unit: "mm",
  fit: "间隙",
  material: "AL7075",
  processLimit: "不限",
  strategy: "标准",
  isKey: true,
  safetyMode: "自动",
  safetyValue: 10,
  safetyUnit: "um",
  geos: ["平面度", "平行度"]
});

approx(single.allocations.reduce((sum, item) => sum + item.valueMm, 0), 0.0258552, 1e-10, "single geo total");
approx(single.allocations[0].valueMm, 0.0110808, 1e-12, "single flatness allocation");
assert(single.text.includes("推荐双边尺寸标注：500.0000 ± 0.02307 mm"), "single output includes dimension callout");

approx(baseRatioTwoFace(["平面度"], ["平面度"], ["平行度"], "间隙", "标准", true), 0.417525, 1e-12, "two face default geo ratio");

const twoFace = calculateTwoFace({
  nominal: 82,
  total: 0.05,
  unit: "mm",
  la: 500,
  wa: 82,
  lb: 500,
  wb: 82,
  fit: "间隙",
  material: "AL7075",
  processLimit: "不限",
  strategy: "标准",
  isKey: true,
  safetyMode: "自动",
  safetyValue: 10,
  safetyUnit: "um",
  faceA: ["平面度"],
  faceB: ["平面度"],
  relation: ["平行度"]
});

approx(twoFace.allocations.reduce((sum, item) => sum + item.valueMm, 0), 0.018788625, 1e-12, "two face geo total");
assert(twoFace.text.includes("推荐尺寸标注：82.0000 ± 0.01311 mm"), "two face output includes dimension callout");
assert(twoFace.text.includes("面 A 平面度"), "two face output includes face reasonableness");

console.log("tolerance regression tests passed");
