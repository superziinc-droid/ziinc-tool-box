(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const geoRules = {
    "平面度": { weight: 0.30, type: "form", inspection: "大理石平台+千分表 / 三坐标 / 平面度仪" },
    "直线度": { weight: 0.30, type: "form", inspection: "三坐标 / 直线度仪 / 平台+百分表" },
    "圆度": { weight: 0.35, type: "form", inspection: "圆度仪 / 三坐标" },
    "圆柱度": { weight: 0.45, type: "form", inspection: "圆度仪 / 三坐标" },
    "平行度": { weight: 0.40, type: "orientation", inspection: "三坐标 / 高度仪 / 平台+百分表" },
    "垂直度": { weight: 0.40, type: "orientation", inspection: "三坐标 / 角尺+百分表 / 垂直度仪" },
    "倾斜度": { weight: 0.42, type: "orientation", inspection: "三坐标 / 角度仪" },
    "位置度": { weight: 0.50, type: "location", inspection: "三坐标 / 专用检具" },
    "同轴度": { weight: 0.50, type: "location", inspection: "三坐标 / 同轴度检具 / 偏摆仪" },
    "对称度": { weight: 0.45, type: "location", inspection: "三坐标 / 专用检具" },
    "圆跳动": { weight: 0.40, type: "runout", inspection: "偏摆仪 / V形架+千分表" },
    "全跳动": { weight: 0.55, type: "runout", inspection: "偏摆仪 / 三坐标" },
    "轮廓度": { weight: 0.45, type: "profile", inspection: "三坐标 / 轮廓仪 / 扫描检测" }
  };

  const fitModifier = { "间隙": 0.90, "过渡": 1.00, "过盈": 0.85 };
  const strategyModifier = { "保守": 0.85, "标准": 1.00, "激进": 1.15 };
  const processLimitRank = { "不限": 99, "CNC": 2, "磨削": 4, "研磨": 5 };
  const processLevels = [
    [0.200, 1, "普通铣削 / 普通车削", "容易"],
    [0.100, 2, "CNC 铣削 / CNC 车削", "较容易"],
    [0.050, 2, "精铣 / 精车 / 镗削", "中等"],
    [0.020, 4, "精铣 + 磨削 / 精镗", "中等偏难"],
    [0.005, 5, "精密磨削 / 研磨 / 坐标磨", "困难"],
    [0.000, 6, "超精密加工 / 恒温加工检测", "很困难"]
  ];
  const itMultipliers = {
    IT5: 7, IT6: 10, IT7: 16, IT8: 25, IT9: 40, IT10: 64,
    IT11: 100, IT12: 160, IT13: 250, IT14: 400, IT15: 640, IT16: 1000
  };
  const materialRules = {
    "AL7075": {
      note: "铝合金易加工，但长尺寸/薄壁件易受残余应力、装夹变形和热变形影响。",
      process: "建议粗加工后去应力，再半精加工、精加工；长面高平面度建议增加精磨或研磨。"
    },
    "SUS304": {
      note: "SUS304 黏刀和加工硬化明显，尺寸稳定性较普通钢差。",
      process: "建议使用锋利刀具、充分冷却、降低进给；高精度面建议精磨或慢走刀精加工。"
    },
    "45钢": {
      note: "45钢综合加工性较好，热处理后精加工稳定性较好。",
      process: "高精度尺寸建议调质/时效后精加工；轴孔类可采用车削、镗削、磨削。"
    },
    "钛合金": {
      note: "钛合金导热差、刀具磨损快、回弹明显，加工热和残余应力风险较高。",
      process: "建议低速强冷却、锋利刀具、分层小切深；高精度面需控制磨削烧伤，必要时采用精磨/研磨。"
    },
    "塑料": {
      note: "塑料刚度低、热膨胀和蠕变明显，夹持和检测状态会显著影响尺寸。",
      process: "建议降低装夹力、控制温度、预留稳定化时间；过严公差应考虑材料替代或结构调整。"
    },
    "陶瓷": {
      note: "陶瓷硬脆，烧结尺寸离散大，最终精度通常依赖后续金刚石磨削/研磨。",
      process: "高精度面建议金刚石磨削、研磨或抛光；孔和薄边需注意崩边、裂纹和检测夹持。"
    },
    "其他": {
      note: "未指定材料，按一般金属材料估算。",
      process: "建议结合供应商实际加工能力、热处理状态和检测条件复核。"
    }
  };

  const initialLists = {
    single: ["平面度", "平行度"],
    faceA: ["平面度"],
    faceB: ["平面度"],
    relation: ["平行度"]
  };
  const state = { mode: "single", lists: clone(initialLists) };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseNumber(value, label) {
    const text = String(value).trim().replace(/,/g, "");
    const number = Number(text);
    if (!Number.isFinite(number)) throw new Error(`${label}必须是数字。`);
    return number;
  }

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  function fmtMm(value) {
    return Math.abs(value) >= 0.01 ? `${value.toFixed(4)} mm` : `${value.toFixed(5)} mm`;
  }

  function normalizeTol(value, unit) {
    return unit === "um" ? value / 1000 : value;
  }

  function weight(name) {
    return geoRules[name]?.weight ?? 0.35;
  }

  function geoType(name) {
    return geoRules[name]?.type ?? "custom";
  }

  function inspection(name) {
    return geoRules[name]?.inspection ?? "三坐标 / 专用检具 / 按企业检测规范";
  }

  function estimateItGrade(nominalMm, totalToleranceMm) {
    if (!(nominalMm > 0) || !(totalToleranceMm > 0)) return "无法判断";
    const iUm = 0.45 * nominalMm ** (1 / 3) + 0.001 * nominalMm;
    const tolUm = totalToleranceMm * 1000;
    let best = "无法判断";
    let bestDiff = Infinity;
    Object.entries(itMultipliers).forEach(([grade, multiplier]) => {
      const diff = Math.abs(Math.log(Math.max(tolUm, 1e-9) / Math.max(multiplier * iUm, 1e-9)));
      if (diff < bestDiff) {
        best = grade;
        bestDiff = diff;
      }
    });
    return nominalMm > 500 ? `${best}（D>500 mm 时为扩展近似，建议查表复核）` : best;
  }

  function recommendProcess(minRequirementMm, material, processLimit, maxFaceLen = null) {
    let selected = processLevels[processLevels.length - 1];
    for (const level of processLevels) {
      if (minRequirementMm >= level[0]) {
        selected = level;
        break;
      }
    }
    let [, rank, processName, difficulty] = selected;
    const mat = materialRules[material] || materialRules["其他"];
    const notes = [mat.note, mat.process];

    if (material === "陶瓷") {
      if (minRequirementMm < 0.05) {
        processName = "金刚石磨削 / 研磨 / 抛光";
        rank = Math.max(rank, 5);
        difficulty = "困难";
      } else {
        processName = "烧结毛坯预留余量 + 金刚石磨削";
        rank = Math.max(rank, 4);
      }
      notes.push("陶瓷尺寸精度通常不建议完全依赖烧结保证，关键面应安排后加工。");
    } else if (material === "塑料") {
      if (minRequirementMm < 0.05) {
        difficulty = "高风险";
        notes.push("塑料小于 0.05 mm 的稳定公差风险较高，需重点控制温度、湿度、夹持和蠕变。");
      }
      if (maxFaceLen && maxFaceLen >= 300) notes.push("塑料大尺寸面形位受刚度和热膨胀影响明显，应谨慎给出过严平面度/平行度。");
    } else if (material === "钛合金" && minRequirementMm < 0.02) {
      difficulty = "困难";
      notes.push("钛合金 20 μm 以下要求对刀具磨损、热变形和检测条件较敏感。");
    }

    if (maxFaceLen && maxFaceLen >= 500 && minRequirementMm <= 0.02) {
      notes.push("长尺寸面且公差不大于 0.02 mm，建议增加去应力、对称加工、恒温检测和工装变形复核。");
    }
    if (processLimit !== "不限" && rank > (processLimitRank[processLimit] ?? 99)) {
      notes.push(`当前加工方式限制为“${processLimit}”，但推荐工艺已达到“${processName}”等级，存在超差风险。`);
    }
    return { processName, difficulty, rank, notes };
  }

  function safetyMargin(totalMm, mode, value, unit, isKey) {
    if (mode === "自动") {
      const ratio = isKey ? 0.10 : 0.05;
      return { marginMm: totalMm * ratio, desc: `自动：${isKey ? "关键尺寸" : "普通尺寸"}，按 ${(ratio * 100).toFixed(1)}% 取值` };
    }
    if (mode === "手动百分比") {
      const ratio = value / 100;
      if (ratio < 0 || ratio >= 0.60) throw new Error("安全余量百分比建议在 0%~60% 之间。");
      return { marginMm: totalMm * ratio, desc: `手动百分比：${(ratio * 100).toFixed(2)}%` };
    }
    if (mode === "手动固定值") {
      const marginMm = normalizeTol(value, unit);
      if (marginMm < 0 || marginMm >= totalMm) throw new Error("安全余量固定值必须大于等于 0 且小于总允许误差。");
      return { marginMm, desc: `手动固定值：${fmtMm(marginMm)}` };
    }
    throw new Error("未知安全余量模式。");
  }

  function baseRatioSingle(geos, fit, strategy, isKey) {
    const avg = geos.map(weight).reduce((sum, item) => sum + item, 0) / Math.max(1, geos.length);
    let ratio = 0.22 + 0.10 * Math.min(geos.length, 4) + 0.08 * ((avg - 0.35) / 0.20);
    ratio *= fitModifier[fit] ?? 1;
    ratio *= strategyModifier[strategy] ?? 1;
    if (isKey) ratio *= 0.95;
    return clamp(ratio, 0.20, 0.75);
  }

  function baseRatioTwoFace(faceA, faceB, relation, fit, strategy, isKey) {
    const geos = [...faceA, ...faceB, ...relation];
    if (!geos.length) return 0;
    const avg = geos.map(weight).reduce((sum, item) => sum + item, 0) / geos.length;
    let ratio = 0.24 + 0.075 * Math.min(geos.length, 5) + 0.08 * ((avg - 0.35) / 0.20) + 0.03 * Math.min(relation.length, 3);
    ratio *= fitModifier[fit] ?? 1;
    ratio *= strategyModifier[strategy] ?? 1;
    if (isKey) ratio *= 0.95;
    return clamp(ratio, 0.20, 0.75);
  }

  function allocateGeos(names, totalMm, group = "") {
    const totalWeight = names.map(weight).reduce((sum, item) => sum + item, 0);
    return names.map((name) => {
      const w = weight(name);
      return {
        group,
        name,
        valueMm: totalWeight > 0 ? totalMm * w / totalWeight : 0,
        percent: totalWeight > 0 ? 100 * w / totalWeight : 0,
        inspection: inspection(name)
      };
    });
  }

  function allocateGrouped(groups, totalMm) {
    const items = [];
    groups.forEach(({ group, names, multiplier }) => {
      names.forEach((name) => items.push({ group, name, weight: weight(name) * multiplier }));
    });
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    return items.map((item) => ({
      group: item.group,
      name: item.name,
      valueMm: totalWeight > 0 ? totalMm * item.weight / totalWeight : 0,
      percent: totalWeight > 0 ? 100 * item.weight / totalWeight : 0,
      inspection: inspection(item.name)
    }));
  }

  function analyzeFace(name, tolMm, lengthMm, widthMm, material, group) {
    const leff = Math.max(lengthMm, widthMm);
    const ratioUrad = leff > 0 ? tolMm / leff * 1_000_000 : 0;
    const type = geoType(name);
    const notes = [
      type === "orientation" || type === "location" || type === "runout" || ["平行度", "垂直度", "倾斜度"].includes(name)
        ? `${group} ${name}：${fmtMm(tolMm)} / 控制长度 ${leff.toFixed(1)} mm，等效角度/相对误差约 ${ratioUrad.toFixed(1)} μrad。`
        : `${group} ${name}：${fmtMm(tolMm)} / 特征长度 ${leff.toFixed(1)} mm，相对精度约 ${ratioUrad.toFixed(1)} μrad。`
    ];
    let risk = "";
    if (leff >= 500) {
      if (tolMm <= 0.010) risk = "要求很高；长面稳定保证通常需要磨削/研磨、去应力和恒温检测。";
      else if (tolMm <= 0.020) risk = "要求较高；仅 CNC 精铣稳定保证风险较高，建议评估磨削或研磨。";
      else if (tolMm <= 0.050) risk = "中等偏严；需控制装夹和热变形。";
    } else if (leff >= 300) {
      if (tolMm <= 0.010) risk = "要求较高；建议磨削或高稳定精加工。";
      else if (tolMm <= 0.030) risk = "中等偏严；需关注装夹变形。";
    } else if (leff >= 100 && tolMm <= 0.010) {
      risk = "要求偏严；建议精加工并复核检测能力。";
    }
    if (material === "塑料" && tolMm <= 0.050) risk = `${risk ? `${risk} ` : ""}塑料材料受温度、湿度、蠕变和装夹影响大，公差稳定性风险高。`;
    if (material === "陶瓷" && tolMm <= 0.020) risk = `${risk ? `${risk} ` : ""}陶瓷需依赖金刚石磨削/研磨，注意崩边和微裂纹。`;
    if (material === "钛合金" && tolMm <= 0.020) risk = `${risk ? `${risk} ` : ""}钛合金需控制刀具磨损、加工热和回弹。`;
    if (risk) notes.push(`  - ${risk}`);
    return notes;
  }

  function calculateSingle(input) {
    const totalMm = normalizeTol(input.total, input.unit);
    if (!(input.nominal > 0)) throw new Error("名义尺寸 D 必须大于 0。");
    if (!(totalMm > 0)) throw new Error("总允许误差必须大于 0。");
    if (!input.geos.length) throw new Error("请至少添加一个形位公差项目。");
    const { marginMm, desc } = safetyMargin(totalMm, input.safetyMode, input.safetyValue, input.safetyUnit, input.isKey);
    const available = totalMm - marginMm;
    if (available <= 0) throw new Error("安全余量过大，剩余可分配公差小于等于 0。");
    const ratio = baseRatioSingle(input.geos, input.fit, input.strategy, input.isKey);
    const geoTotal = available * ratio;
    const dimTotal = available - geoTotal;
    const allocations = allocateGeos(input.geos, geoTotal);
    const geoSum = allocations.reduce((sum, item) => sum + item.valueMm, 0);
    const process = recommendProcess(Math.min(dimTotal, ...allocations.map((item) => item.valueMm)), input.material, input.processLimit);
    const it = estimateItGrade(input.nominal, dimTotal);
    const lines = [
      "单尺寸 + 多形位公差分配结果",
      "-".repeat(60),
      `名义尺寸 D：${input.nominal.toFixed(4)} mm`,
      `总允许误差：${fmtMm(totalMm)}（${(totalMm * 1000).toFixed(2)} μm）`,
      `安全余量：${fmtMm(marginMm)}（${desc}）`,
      `可分配公差：${fmtMm(available)}`,
      "",
      `配合方式：${input.fit}    材料：${input.material}    策略：${input.strategy}    关键尺寸：${input.isKey ? "是" : "否"}`,
      "",
      `推荐尺寸总公差：${fmtMm(dimTotal)}`,
      `推荐双边尺寸标注：${input.nominal.toFixed(4)} ± ${(dimTotal / 2).toFixed(5)} mm`,
      `近似尺寸精度等级：${it}`,
      `形位公差总预算：${fmtMm(geoTotal)}，占可分配公差 ${(ratio * 100).toFixed(1)}%`,
      "",
      "推荐形位公差：",
      ...allocations.map((item) => `  - ${item.name}：${fmtMm(item.valueMm)}    权重占比 ${item.percent.toFixed(1)}%    检测：${item.inspection}`),
      "",
      "总公差校核：",
      `  尺寸总公差 ${fmtMm(dimTotal)} + 形位合计 ${fmtMm(geoSum)} + 安全余量 ${fmtMm(marginMm)} = ${fmtMm(dimTotal + geoSum + marginMm)}`,
      "",
      "推荐加工方式：",
      `  ${process.processName}`,
      `可加工性判断：${process.difficulty}`,
      "",
      "风险/工艺提示：",
      ...process.notes.map((note) => `  - ${note}`)
    ];
    if (input.fit === "过盈") lines.push("  - 过盈配合建议额外复核压装量、圆度/圆柱度、同轴度或圆跳动，避免压装偏斜和局部接触应力过大。");
    lines.push("  - 本结果为规则库辅助分配，正式图纸建议结合 GB/T 1800、GB/T 1184、企业工艺能力和尺寸链校核复核。");
    return resultPayload(dimTotal, geoTotal, ratio, marginMm, desc, totalMm, geoSum, process, it, allocations, lines, "尺寸总公差");
  }

  function calculateTwoFace(input) {
    const totalMm = normalizeTol(input.total, input.unit);
    if (!(input.nominal > 0)) throw new Error("名义距离 H 必须大于 0。");
    if (!(totalMm > 0)) throw new Error("Z 向总允许误差必须大于 0。");
    if (![input.la, input.wa, input.lb, input.wb].every((value) => value > 0)) throw new Error("面 A/B 的长宽尺寸必须大于 0。");
    if (![...input.faceA, ...input.faceB, ...input.relation].length) throw new Error("请至少添加一个面 A、面 B 或关联形位公差项目。");
    const { marginMm, desc } = safetyMargin(totalMm, input.safetyMode, input.safetyValue, input.safetyUnit, input.isKey);
    const available = totalMm - marginMm;
    if (available <= 0) throw new Error("安全余量过大，剩余可分配公差小于等于 0。");
    const ratio = baseRatioTwoFace(input.faceA, input.faceB, input.relation, input.fit, input.strategy, input.isKey);
    const geoTotal = available * ratio;
    const dimTotal = available - geoTotal;
    const allocations = allocateGrouped([
      { group: "面 A", names: input.faceA, multiplier: 1.00 },
      { group: "面 B", names: input.faceB, multiplier: 1.00 },
      { group: "关联", names: input.relation, multiplier: 1.15 }
    ], geoTotal);
    const geoSum = allocations.reduce((sum, item) => sum + item.valueMm, 0);
    const maxLen = Math.max(input.la, input.wa, input.lb, input.wb);
    const process = recommendProcess(Math.min(dimTotal, ...allocations.map((item) => item.valueMm)), input.material, input.processLimit, maxLen);
    const it = estimateItGrade(input.nominal, dimTotal);
    const faceNotes = [];
    allocations.forEach((item) => {
      if (item.group === "面 A") faceNotes.push(...analyzeFace(item.name, item.valueMm, input.la, input.wa, input.material, "面 A"));
      else if (item.group === "面 B") faceNotes.push(...analyzeFace(item.name, item.valueMm, input.lb, input.wb, input.material, "面 B"));
      else faceNotes.push(...analyzeFace(item.name, item.valueMm, maxLen, Math.min(Math.max(input.wa, input.wb), maxLen), input.material, "两面关联"));
    });
    const lines = [
      "两面 Z 向公差分配结果",
      "-".repeat(70),
      `名义距离 H：${input.nominal.toFixed(4)} mm`,
      `Z 向总允许误差：${fmtMm(totalMm)}（${(totalMm * 1000).toFixed(2)} μm）`,
      `面 A 尺寸：${input.la.toFixed(3)} × ${input.wa.toFixed(3)} mm`,
      `面 B 尺寸：${input.lb.toFixed(3)} × ${input.wb.toFixed(3)} mm`,
      `配合方式：${input.fit}    材料：${input.material}    策略：${input.strategy}    关键尺寸：${input.isKey ? "是" : "否"}`,
      "",
      `安全余量：${fmtMm(marginMm)}（${desc}）`,
      `可分配公差：${fmtMm(available)}`,
      `形位公差总预算：${fmtMm(geoTotal)}，占可分配公差 ${(ratio * 100).toFixed(1)}%`,
      `推荐两面距离尺寸总公差：${fmtMm(dimTotal)}`,
      `推荐尺寸标注：${input.nominal.toFixed(4)} ± ${(dimTotal / 2).toFixed(5)} mm`,
      `近似尺寸精度等级：${it}`,
      "",
      "推荐形位公差："
    ];
    ["面 A", "面 B", "关联"].forEach((group) => {
      const groupItems = allocations.filter((item) => item.group === group);
      if (!groupItems.length) return;
      lines.push(`  ${group}：`);
      groupItems.forEach((item) => lines.push(`    - ${item.name}：${fmtMm(item.valueMm)}    预算占比 ${item.percent.toFixed(1)}%    检测：${item.inspection}`));
    });
    lines.push(
      "",
      "总公差校核：",
      `  距离尺寸总公差 ${fmtMm(dimTotal)} + 形位合计 ${fmtMm(geoSum)} + 安全余量 ${fmtMm(marginMm)} = ${fmtMm(dimTotal + geoSum + marginMm)}`,
      "",
      "形位公差合理性判断：",
      ...faceNotes,
      "",
      "推荐加工方式：",
      `  ${process.processName}`,
      `可加工性判断：${process.difficulty}`,
      "",
      "风险/工艺提示：",
      ...process.notes.map((note) => `  - ${note}`)
    );
    if (input.fit === "过盈") lines.push("  - 过盈配合下，两面距离尺寸会影响压装量；建议同步复核圆度、圆柱度、同轴度、倒角和表面粗糙度。");
    if (input.relation.length && !input.faceA.length) lines.push("  - 仅给关联形位而未给基准面自身形位时，需确认基准面 A 是否已有平面度或其他基准质量要求。");
    if ((input.relation.includes("平行度") || input.relation.includes("垂直度")) && maxLen >= 300) lines.push("  - 大尺寸面方向公差建议优先使用可靠基准加工；检测时注意支撑点、重力变形和温度一致性。");
    lines.push("  - 本工具按极值叠加思路分配：T_total = T_dim + ΣT_geo + T_margin；正式图纸仍需结合基准体系和尺寸链复核。");
    return resultPayload(dimTotal, geoTotal, ratio, marginMm, desc, totalMm, geoSum, process, it, allocations, lines, "距离尺寸公差");
  }

  function resultPayload(dimTotal, geoTotal, ratio, marginMm, marginDesc, totalMm, geoSum, process, it, allocations, lines, dimensionLabel) {
    return {
      cards: [
        [dimensionLabel, fmtMm(dimTotal), `± ${(dimTotal / 2).toFixed(5)} mm`],
        ["形位预算", fmtMm(geoTotal), `${(ratio * 100).toFixed(1)}%`],
        ["安全余量", fmtMm(marginMm), marginDesc],
        ["推荐工艺", process.processName, process.difficulty],
        ["近似 IT", it, "估算"],
        ["校核合计", fmtMm(dimTotal + geoSum + marginMm), `目标 ${fmtMm(totalMm)}`]
      ],
      allocations,
      text: lines.join("\n")
    };
  }

  function init() {
    const section = $('[data-page-section="tolerance"]');
    if (!section) return;

    const inputs = Object.fromEntries($$("[data-tolerance]").map((input) => [input.dataset.tolerance, input]));
    const defaults = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
    const cards = $("#toleranceCards");
    const tableWrap = $("#toleranceTableWrap");
    const summary = $("#toleranceSummary");
    const singlePanel = $("#toleranceSinglePanel");
    const twoPanel = $("#toleranceTwoFacePanel");
    const lbField = $("#toleranceLbField");
    const wbField = $("#toleranceWbField");
    const listTargets = {
      single: $("#toleranceSingleList"),
      faceA: $("#toleranceFaceAList"),
      faceB: $("#toleranceFaceBList"),
      relation: $("#toleranceRelationList")
    };
    const sourceSelects = Object.fromEntries($$("[data-tolerance-geo-source]").map((select) => [select.dataset.toleranceGeoSource, select]));

    function fillOptions() {
      const materialOptions = Object.keys(materialRules).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
      ["single.material", "two.material"].forEach((key) => {
        inputs[key].innerHTML = materialOptions;
        inputs[key].value = "AL7075";
      });
      const geoOptions = Object.keys(geoRules).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
      Object.values(sourceSelects).forEach((select) => {
        select.innerHTML = geoOptions;
      });
      if (sourceSelects.relation) sourceSelects.relation.value = "平行度";
    }

    function num(key, label) {
      return parseNumber(inputs[key].value, label);
    }

    function collectSingle() {
      return {
        nominal: num("single.nominal", "名义尺寸 D"),
        total: num("single.total", "总允许误差"),
        unit: inputs["single.unit"].value,
        fit: inputs["single.fit"].value,
        material: inputs["single.material"].value,
        processLimit: inputs["single.processLimit"].value,
        strategy: inputs["single.strategy"].value,
        isKey: inputs["single.key"].value === "是",
        safetyMode: inputs["single.safetyMode"].value,
        safetyValue: num("single.safetyValue", "安全余量数值"),
        safetyUnit: inputs["single.safetyUnit"].value,
        geos: [...state.lists.single]
      };
    }

    function collectTwo() {
      const sameSize = inputs["two.sameSize"].value === "是";
      const la = num("two.la", "面 A 长度");
      const wa = num("two.wa", "面 A 宽度");
      return {
        nominal: num("two.nominal", "名义距离 H"),
        total: num("two.total", "Z 向总允许误差"),
        unit: inputs["two.unit"].value,
        la,
        wa,
        lb: sameSize ? la : num("two.lb", "面 B 长度"),
        wb: sameSize ? wa : num("two.wb", "面 B 宽度"),
        fit: inputs["two.fit"].value,
        material: inputs["two.material"].value,
        processLimit: inputs["two.processLimit"].value,
        strategy: inputs["two.strategy"].value,
        isKey: inputs["two.key"].value === "是",
        safetyMode: inputs["two.safetyMode"].value,
        safetyValue: num("two.safetyValue", "安全余量数值"),
        safetyUnit: inputs["two.safetyUnit"].value,
        faceA: [...state.lists.faceA],
        faceB: [...state.lists.faceB],
        relation: [...state.lists.relation]
      };
    }

    function renderChips(key) {
      listTargets[key].innerHTML = state.lists[key].map((name, index) => `
        <span class="tolerance-chip">${escapeHtml(name)}<button type="button" aria-label="删除 ${escapeHtml(name)}" data-tolerance-remove="${key}" data-index="${index}">×</button></span>
      `).join("");
    }

    function renderAllChips() {
      Object.keys(listTargets).forEach(renderChips);
    }

    function updateMode() {
      $$("[data-tolerance-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.toleranceMode === state.mode)));
      singlePanel.hidden = state.mode !== "single";
      twoPanel.hidden = state.mode !== "twoFace";
      const sameSize = inputs["two.sameSize"].value === "是";
      lbField.classList.toggle("field-hidden", sameSize);
      wbField.classList.toggle("field-hidden", sameSize);
    }

    function render(result) {
      cards.innerHTML = result.cards.map(([label, value, unit]) => `
        <div class="result-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><span>${escapeHtml(unit)}</span></div>
      `).join("");
      tableWrap.innerHTML = `
        <table class="tolerance-table">
          <thead><tr><th>分组</th><th>项目</th><th>推荐值</th><th>预算占比</th><th>检测建议</th></tr></thead>
          <tbody>${result.allocations.map((item) => `
            <tr>
              <td>${escapeHtml(item.group || "-")}</td>
              <td>${escapeHtml(item.name)}</td>
              <td>${escapeHtml(fmtMm(item.valueMm))}</td>
              <td>${item.percent.toFixed(1)}%</td>
              <td>${escapeHtml(item.inspection)}</td>
            </tr>`).join("")}</tbody>
        </table>
      `;
      summary.textContent = result.text;
      window.lastToleranceText = result.text;
    }

    function run() {
      try {
        updateMode();
        renderAllChips();
        render(state.mode === "single" ? calculateSingle(collectSingle()) : calculateTwoFace(collectTwo()));
      } catch (error) {
        cards.innerHTML = "";
        tableWrap.innerHTML = "";
        summary.textContent = error.message;
        window.lastToleranceText = "";
      }
    }

    fillOptions();
    run();

    $$("[data-tolerance-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.toleranceMode;
        run();
      });
    });
    $$("[data-tolerance]").forEach((input) => input.addEventListener("input", run));
    $$("[data-tolerance]").forEach((input) => input.addEventListener("change", run));
    $$("[data-tolerance-add]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.toleranceAdd;
        const value = sourceSelects[key].value;
        if (value) state.lists[key].push(value);
        run();
      });
    });
    $$("[data-tolerance-clear]").forEach((button) => {
      button.addEventListener("click", () => {
        state.lists[button.dataset.toleranceClear] = [];
        run();
      });
    });
    section.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-tolerance-remove]");
      if (!removeButton) return;
      const key = removeButton.dataset.toleranceRemove;
      state.lists[key].splice(Number(removeButton.dataset.index), 1);
      run();
    });
    $("#resetTolerance")?.addEventListener("click", () => {
      Object.entries(defaults).forEach(([key, value]) => {
        inputs[key].value = value;
      });
      state.mode = "single";
      state.lists = clone(initialLists);
      fillOptions();
      run();
    });
    $("#copyTolerance")?.addEventListener("click", async () => {
      if (!window.lastToleranceText) run();
      try {
        await navigator.clipboard.writeText(window.lastToleranceText || "");
      } catch {
        const area = document.createElement("textarea");
        area.value = window.lastToleranceText || "";
        document.body.append(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
    });
  }

  window.ZiincToleranceAllocator = {
    calculateSingle,
    calculateTwoFace,
    baseRatioSingle,
    baseRatioTwoFace,
    estimateItGrade,
    fmtMm
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
