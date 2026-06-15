# -*- coding: utf-8 -*-
"""
公差分配助手 V1.2
- 单尺寸 + 多形位公差模式
- 两面 Z 向公差分配模式
- 支持安全余量自动/手动百分比/手动固定值
- 支持面长宽对形位公差合理性判断

说明：本工具为工程预估和出图前公差分配辅助工具，不能替代正式标准查表、工艺评审和尺寸链专项校核。
"""

from __future__ import annotations

import math
import tkinter as tk
from dataclasses import dataclass
from tkinter import ttk, messagebox
from typing import Dict, List, Tuple, Optional

APP_TITLE = "公差分配助手 V1.2"

# -----------------------------
# 规则库
# -----------------------------

GEOMETRIC_RULES: Dict[str, Dict[str, object]] = {
    "平面度": {"weight": 0.30, "type": "form", "inspection": "大理石平台+千分表 / 三坐标 / 平面度仪"},
    "直线度": {"weight": 0.30, "type": "form", "inspection": "三坐标 / 直线度仪 / 平台+百分表"},
    "圆度": {"weight": 0.35, "type": "form", "inspection": "圆度仪 / 三坐标"},
    "圆柱度": {"weight": 0.45, "type": "form", "inspection": "圆度仪 / 三坐标"},
    "平行度": {"weight": 0.40, "type": "orientation", "inspection": "三坐标 / 高度仪 / 平台+百分表"},
    "垂直度": {"weight": 0.40, "type": "orientation", "inspection": "三坐标 / 角尺+百分表 / 垂直度仪"},
    "倾斜度": {"weight": 0.42, "type": "orientation", "inspection": "三坐标 / 角度仪"},
    "位置度": {"weight": 0.50, "type": "location", "inspection": "三坐标 / 专用检具"},
    "同轴度": {"weight": 0.50, "type": "location", "inspection": "三坐标 / 同轴度检具 / 偏摆仪"},
    "对称度": {"weight": 0.45, "type": "location", "inspection": "三坐标 / 专用检具"},
    "圆跳动": {"weight": 0.40, "type": "runout", "inspection": "偏摆仪 / V形架+千分表"},
    "全跳动": {"weight": 0.55, "type": "runout", "inspection": "偏摆仪 / 三坐标"},
    "轮廓度": {"weight": 0.45, "type": "profile", "inspection": "三坐标 / 轮廓仪 / 扫描检测"},
}

GEOMETRIC_NAMES = list(GEOMETRIC_RULES.keys())

FIT_MODIFIER = {
    "间隙": 0.90,
    "过渡": 1.00,
    "过盈": 0.85,
}

STRATEGY_MODIFIER = {
    # 数值越小，形位公差预算越小，形位控制越严，尺寸公差余量越大
    "保守": 0.85,
    "标准": 1.00,
    "激进": 1.15,
}

MATERIAL_RULES: Dict[str, Dict[str, str]] = {
    "AL7075": {
        "note": "铝合金易加工，但长尺寸/薄壁件易受残余应力、装夹变形和热变形影响。",
        "process": "建议粗加工后去应力，再半精加工、精加工；长面高平面度建议增加精磨或研磨。",
    },
    "SUS304": {
        "note": "SUS304 黏刀和加工硬化明显，尺寸稳定性较普通钢差。",
        "process": "建议使用锋利刀具、充分冷却、降低进给；高精度面建议精磨或慢走刀精加工。",
    },
    "45钢": {
        "note": "45钢综合加工性较好，热处理后精加工稳定性较好。",
        "process": "高精度尺寸建议调质/时效后精加工；轴孔类可采用车削、镗削、磨削。",
    },
    "钛合金": {
        "note": "钛合金导热差、刀具磨损快、回弹明显，加工热和残余应力风险较高。",
        "process": "建议低速强冷却、锋利刀具、分层小切深；高精度面需控制磨削烧伤，必要时采用精磨/研磨。",
    },
    "塑料": {
        "note": "塑料刚度低、热膨胀和蠕变明显，夹持和检测状态会显著影响尺寸。",
        "process": "建议降低装夹力、控制温度、预留稳定化时间；过严公差应考虑材料替代或结构调整。",
    },
    "陶瓷": {
        "note": "陶瓷硬脆，烧结尺寸离散大，最终精度通常依赖后续金刚石磨削/研磨。",
        "process": "高精度面建议金刚石磨削、研磨或抛光；孔和薄边需注意崩边、裂纹和检测夹持。",
    },
    "其他": {
        "note": "未指定材料，按一般金属材料估算。",
        "process": "建议结合供应商实际加工能力、热处理状态和检测条件复核。",
    },
}

PROCESS_LIMIT_RANK = {
    "不限": 99,
    "CNC": 2,
    "磨削": 4,
    "研磨": 5,
}

# 推荐工艺等级 rank：越大越精密
PROCESS_LEVELS = [
    (0.200, 1, "普通铣削 / 普通车削", "容易"),
    (0.100, 2, "CNC 铣削 / CNC 车削", "较容易"),
    (0.050, 2, "精铣 / 精车 / 镗削", "中等"),
    (0.020, 4, "精铣 + 磨削 / 精镗", "中等偏难"),
    (0.005, 5, "精密磨削 / 研磨 / 坐标磨", "困难"),
    (0.000, 6, "超精密加工 / 恒温加工检测", "很困难"),
]

IT_MULTIPLIERS = {
    "IT5": 7,
    "IT6": 10,
    "IT7": 16,
    "IT8": 25,
    "IT9": 40,
    "IT10": 64,
    "IT11": 100,
    "IT12": 160,
    "IT13": 250,
    "IT14": 400,
    "IT15": 640,
    "IT16": 1000,
}


@dataclass
class GeoAllocation:
    name: str
    value_mm: float
    weight: float
    percent_of_geo_budget: float
    group: str = ""


# -----------------------------
# 通用计算函数
# -----------------------------

def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def fmt_mm(x: float, digits: int = 4) -> str:
    if abs(x) >= 0.01:
        return f"{x:.4f} mm"
    return f"{x:.5f} mm"


def mm_to_um(x: float) -> float:
    return x * 1000.0


def parse_float(value: str, name: str, positive: bool = True) -> float:
    try:
        v = float(str(value).strip())
    except Exception:
        raise ValueError(f"{name} 必须为数字。")
    if positive and v <= 0:
        raise ValueError(f"{name} 必须大于 0。")
    return v


def normalize_tolerance(value: float, unit: str) -> float:
    if unit == "μm":
        return value / 1000.0
    return value


def get_geo_weight(name: str) -> float:
    if name in GEOMETRIC_RULES:
        return float(GEOMETRIC_RULES[name]["weight"])
    return 0.35


def get_geo_type(name: str) -> str:
    if name in GEOMETRIC_RULES:
        return str(GEOMETRIC_RULES[name]["type"])
    return "custom"


def get_inspection(name: str) -> str:
    if name in GEOMETRIC_RULES:
        return str(GEOMETRIC_RULES[name]["inspection"])
    return "三坐标 / 专用检具 / 按企业检测规范"


def estimate_it_grade(nominal_mm: float, total_tolerance_mm: float) -> str:
    """按标准公差单位 i 作近似 IT 等级判断，仅用于辅助估算。"""
    if nominal_mm <= 0 or total_tolerance_mm <= 0:
        return "无法判断"
    d = nominal_mm
    i_um = 0.45 * (d ** (1.0 / 3.0)) + 0.001 * d
    tol_um = total_tolerance_mm * 1000.0
    best = None
    best_diff = None
    for grade, mult in IT_MULTIPLIERS.items():
        grade_tol = mult * i_um
        diff = abs(math.log(max(tol_um, 1e-9) / max(grade_tol, 1e-9)))
        if best is None or diff < best_diff:
            best = grade
            best_diff = diff
    note = best or "无法判断"
    if d > 500:
        note += "（D>500 mm 时为扩展近似，建议查表复核）"
    return note


def recommend_process(min_requirement_mm: float, material: str, process_limit: str, max_face_len: Optional[float] = None) -> Tuple[str, str, int, List[str]]:
    selected = PROCESS_LEVELS[-1]
    for threshold, rank, process, difficulty in PROCESS_LEVELS:
        if min_requirement_mm >= threshold:
            selected = (threshold, rank, process, difficulty)
            break
    _, rank, base_process, difficulty = selected

    notes: List[str] = []
    mat = MATERIAL_RULES.get(material, MATERIAL_RULES["其他"])
    notes.append(mat["note"])
    notes.append(mat["process"])

    if material == "陶瓷":
        if min_requirement_mm < 0.05:
            base_process = "金刚石磨削 / 研磨 / 抛光"
            rank = max(rank, 5)
            difficulty = "困难"
        else:
            base_process = "烧结毛坯预留余量 + 金刚石磨削"
            rank = max(rank, 4)
        notes.append("陶瓷尺寸精度通常不建议完全依赖烧结保证，关键面应安排后加工。")
    elif material == "塑料":
        if min_requirement_mm < 0.05:
            difficulty = "高风险"
            notes.append("塑料小于 0.05 mm 的稳定公差风险较高，需重点控制温度、湿度、夹持和蠕变。")
        if max_face_len and max_face_len >= 300:
            notes.append("塑料大尺寸面形位受刚度和热膨胀影响明显，应谨慎给出过严平面度/平行度。")
    elif material == "钛合金":
        if min_requirement_mm < 0.02:
            difficulty = "困难"
            notes.append("钛合金 20 μm 以下要求对刀具磨损、热变形和检测条件较敏感。")

    if max_face_len and max_face_len >= 500 and min_requirement_mm <= 0.02:
        notes.append("长尺寸面且公差不大于 0.02 mm，建议增加去应力、对称加工、恒温检测和工装变形复核。")

    limit_rank = PROCESS_LIMIT_RANK.get(process_limit, 99)
    if process_limit != "不限" and rank > limit_rank:
        notes.append(f"当前加工方式限制为“{process_limit}”，但推荐工艺已达到“{base_process}”等级，存在超差风险。")

    return base_process, difficulty, rank, notes


def calc_safety_margin(total_mm: float, mode: str, value_text: str, value_unit: str, is_key: bool) -> Tuple[float, str]:
    if mode == "自动":
        ratio = 0.10 if is_key else 0.05
        return total_mm * ratio, f"自动：{'关键尺寸' if is_key else '普通尺寸'}，按 {ratio*100:.1f}% 取值"
    if mode == "手动百分比":
        ratio = parse_float(value_text, "安全余量百分比", positive=False) / 100.0
        if ratio < 0 or ratio >= 0.60:
            raise ValueError("安全余量百分比建议在 0%~60% 之间。")
        return total_mm * ratio, f"手动百分比：{ratio*100:.2f}%"
    if mode == "手动固定值":
        v = parse_float(value_text, "安全余量固定值", positive=False)
        v_mm = normalize_tolerance(v, value_unit)
        if v_mm < 0 or v_mm >= total_mm:
            raise ValueError("安全余量固定值必须大于等于 0 且小于总允许误差。")
        return v_mm, f"手动固定值：{fmt_mm(v_mm)}"
    raise ValueError("未知安全余量模式。")


def base_geo_ratio_single(geos: List[str], fit: str, strategy: str, is_key: bool) -> float:
    weights = [get_geo_weight(g) for g in geos]
    n = len(geos)
    avg_w = sum(weights) / max(1, n)
    ratio = 0.22 + 0.10 * min(n, 4) + 0.08 * ((avg_w - 0.35) / 0.20)
    ratio *= FIT_MODIFIER.get(fit, 1.0)
    ratio *= STRATEGY_MODIFIER.get(strategy, 1.0)
    if is_key:
        ratio *= 0.95
    return clamp(ratio, 0.20, 0.75)


def base_geo_ratio_two_face(face_a: List[str], face_b: List[str], relation: List[str], fit: str, strategy: str, is_key: bool) -> float:
    geos = face_a + face_b + relation
    n = len(geos)
    if n == 0:
        return 0.0
    avg_w = sum(get_geo_weight(g) for g in geos) / n
    relation_bonus = 0.03 * min(len(relation), 3)
    ratio = 0.24 + 0.075 * min(n, 5) + 0.08 * ((avg_w - 0.35) / 0.20) + relation_bonus
    ratio *= FIT_MODIFIER.get(fit, 1.0)
    ratio *= STRATEGY_MODIFIER.get(strategy, 1.0)
    if is_key:
        ratio *= 0.95
    return clamp(ratio, 0.20, 0.75)


def allocate_geos(geo_names: List[str], geo_total_mm: float, group: str = "") -> List[GeoAllocation]:
    if not geo_names:
        return []
    weights = [get_geo_weight(g) for g in geo_names]
    total_w = sum(weights)
    allocations: List[GeoAllocation] = []
    for g, w in zip(geo_names, weights):
        value = geo_total_mm * w / total_w if total_w > 0 else 0
        allocations.append(GeoAllocation(g, value, w, 100.0 * w / total_w if total_w > 0 else 0, group=group))
    return allocations


def allocate_geos_grouped(groups: List[Tuple[str, List[str], float]], geo_total_mm: float) -> List[GeoAllocation]:
    weighted_items: List[Tuple[str, str, float]] = []
    for group_name, names, multiplier in groups:
        for n in names:
            weighted_items.append((group_name, n, get_geo_weight(n) * multiplier))
    total_w = sum(item[2] for item in weighted_items)
    result: List[GeoAllocation] = []
    for group_name, n, w in weighted_items:
        value = geo_total_mm * w / total_w if total_w > 0 else 0
        pct = 100.0 * w / total_w if total_w > 0 else 0
        result.append(GeoAllocation(n, value, w, pct, group=group_name))
    return result


def analyze_face_reasonableness(name: str, tol_mm: float, length_mm: float, width_mm: float, material: str, group: str) -> List[str]:
    leff = max(length_mm, width_mm)
    ratio_urad = tol_mm / leff * 1_000_000.0 if leff > 0 else 0
    notes: List[str] = []

    geo_type = get_geo_type(name)
    if geo_type in {"orientation", "location", "runout"} or name in {"平行度", "垂直度", "倾斜度"}:
        notes.append(f"{group} {name}：{fmt_mm(tol_mm)} / 控制长度 {leff:.1f} mm，等效角度/相对误差约 {ratio_urad:.1f} μrad。")
    else:
        notes.append(f"{group} {name}：{fmt_mm(tol_mm)} / 特征长度 {leff:.1f} mm，相对精度约 {ratio_urad:.1f} μrad。")

    risk = ""
    if leff >= 500:
        if tol_mm <= 0.010:
            risk = "要求很高；长面稳定保证通常需要磨削/研磨、去应力和恒温检测。"
        elif tol_mm <= 0.020:
            risk = "要求较高；仅 CNC 精铣稳定保证风险较高，建议评估磨削或研磨。"
        elif tol_mm <= 0.050:
            risk = "中等偏严；需控制装夹和热变形。"
    elif leff >= 300:
        if tol_mm <= 0.010:
            risk = "要求较高；建议磨削或高稳定精加工。"
        elif tol_mm <= 0.030:
            risk = "中等偏严；需关注装夹变形。"
    elif leff >= 100:
        if tol_mm <= 0.010:
            risk = "要求偏严；建议精加工并复核检测能力。"

    if material == "塑料" and tol_mm <= 0.050:
        risk = (risk + " " if risk else "") + "塑料材料受温度、湿度、蠕变和装夹影响大，公差稳定性风险高。"
    if material == "陶瓷" and tol_mm <= 0.020:
        risk = (risk + " " if risk else "") + "陶瓷需依赖金刚石磨削/研磨，注意崩边和微裂纹。"
    if material == "钛合金" and tol_mm <= 0.020:
        risk = (risk + " " if risk else "") + "钛合金需控制刀具磨损、加工热和回弹。"

    if risk:
        notes.append("  - " + risk)
    return notes


# -----------------------------
# GUI 辅助控件
# -----------------------------

class GeoListFrame(ttk.LabelFrame):
    def __init__(self, master, title: str, default_name: str = "平面度", height: int = 5):
        super().__init__(master, text=title)
        self.var = tk.StringVar(value=default_name)
        self.combo = ttk.Combobox(self, textvariable=self.var, values=GEOMETRIC_NAMES, width=16)
        self.combo.grid(row=0, column=0, padx=5, pady=4, sticky="ew")
        ttk.Button(self, text="添加", command=self.add_item).grid(row=0, column=1, padx=3, pady=4)
        ttk.Button(self, text="删除选中", command=self.delete_selected).grid(row=0, column=2, padx=3, pady=4)
        ttk.Button(self, text="清空", command=self.clear).grid(row=0, column=3, padx=3, pady=4)
        self.listbox = tk.Listbox(self, height=height, exportselection=False)
        self.listbox.grid(row=1, column=0, columnspan=4, padx=5, pady=(0, 5), sticky="nsew")
        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)

    def add_item(self):
        name = self.var.get().strip()
        if not name:
            messagebox.showwarning("提示", "请先选择或输入形位公差名称。")
            return
        self.listbox.insert(tk.END, name)

    def delete_selected(self):
        sel = list(self.listbox.curselection())
        for idx in reversed(sel):
            self.listbox.delete(idx)

    def clear(self):
        self.listbox.delete(0, tk.END)

    def get_items(self) -> List[str]:
        return [self.listbox.get(i) for i in range(self.listbox.size())]

    def set_items(self, items: List[str]):
        self.clear()
        for item in items:
            self.listbox.insert(tk.END, item)


class SafetyFrame(ttk.LabelFrame):
    def __init__(self, master):
        super().__init__(master, text="安全余量")
        self.mode = tk.StringVar(value="自动")
        self.value = tk.StringVar(value="10")
        self.unit = tk.StringVar(value="μm")
        ttk.Label(self, text="模式").grid(row=0, column=0, padx=4, pady=4, sticky="e")
        ttk.Combobox(self, textvariable=self.mode, values=["自动", "手动百分比", "手动固定值"], width=12, state="readonly").grid(row=0, column=1, padx=4, pady=4)
        ttk.Label(self, text="数值").grid(row=0, column=2, padx=4, pady=4, sticky="e")
        ttk.Entry(self, textvariable=self.value, width=10).grid(row=0, column=3, padx=4, pady=4)
        ttk.Combobox(self, textvariable=self.unit, values=["mm", "μm"], width=6, state="readonly").grid(row=0, column=4, padx=4, pady=4)
        ttk.Label(self, text="自动模式忽略数值；百分比模式填 5/10/15；固定值模式按右侧单位换算。", foreground="#555").grid(row=1, column=0, columnspan=5, padx=4, pady=(0, 4), sticky="w")

    def calc(self, total_mm: float, is_key: bool) -> Tuple[float, str]:
        return calc_safety_margin(total_mm, self.mode.get(), self.value.get(), self.unit.get(), is_key)


class ScrollableFrame(ttk.Frame):
    def __init__(self, master, width: int = 430):
        super().__init__(master)
        self.canvas = tk.Canvas(self, width=width, highlightthickness=0, borderwidth=0)
        self.scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.content = ttk.Frame(self.canvas)
        self._window_id = self.canvas.create_window((0, 0), window=self.content, anchor="nw")

        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")

        self.content.bind("<Configure>", self._update_scroll_region)
        self.canvas.bind("<Configure>", self._resize_content)
        self.canvas.bind("<Enter>", self._bind_mousewheel)
        self.canvas.bind("<Leave>", self._unbind_mousewheel)

    def _update_scroll_region(self, _event=None):
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def _resize_content(self, event):
        self.canvas.itemconfigure(self._window_id, width=event.width)

    def _bind_mousewheel(self, _event=None):
        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)

    def _unbind_mousewheel(self, _event=None):
        self.canvas.unbind_all("<MouseWheel>")

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")


# -----------------------------
# 主程序
# -----------------------------

class ToleranceApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("1120x780")
        self.minsize(980, 680)
        self._build_ui()

    def _build_ui(self):
        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=8, pady=8)
        self.single_tab = ttk.Frame(notebook)
        self.two_face_tab = ttk.Frame(notebook)
        notebook.add(self.single_tab, text="单尺寸 + 多形位公差")
        notebook.add(self.two_face_tab, text="两面 Z 向公差分配")
        self._build_single_tab()
        self._build_two_face_tab()

    # ---------- 单尺寸模式 ----------
    def _build_single_tab(self):
        left = ttk.Frame(self.single_tab)
        right = ttk.Frame(self.single_tab)
        left.pack(side="left", fill="y", padx=6, pady=6)
        right.pack(side="right", fill="both", expand=True, padx=6, pady=6)

        self.s_nominal = tk.StringVar(value="500")
        self.s_total = tk.StringVar(value="0.08")
        self.s_unit = tk.StringVar(value="mm")
        self.s_fit = tk.StringVar(value="间隙")
        self.s_material = tk.StringVar(value="AL7075")
        self.s_process_limit = tk.StringVar(value="不限")
        self.s_strategy = tk.StringVar(value="标准")
        self.s_key = tk.StringVar(value="是")

        frm = ttk.LabelFrame(left, text="输入参数")
        frm.pack(fill="x", pady=4)
        self._row_entry(frm, 0, "名义尺寸 D / mm", self.s_nominal)
        self._row_entry(frm, 1, "总允许误差", self.s_total)
        self._row_combo(frm, 2, "单位", self.s_unit, ["mm", "μm"])
        self._row_combo(frm, 3, "配合方式", self.s_fit, ["间隙", "过渡", "过盈"])
        self._row_combo(frm, 4, "零件材料", self.s_material, list(MATERIAL_RULES.keys()))
        self._row_combo(frm, 5, "加工方式限制", self.s_process_limit, ["不限", "CNC", "磨削", "研磨"])
        self._row_combo(frm, 6, "分配策略", self.s_strategy, ["保守", "标准", "激进"])
        self._row_combo(frm, 7, "关键装配尺寸", self.s_key, ["是", "否"])

        self.s_safety = SafetyFrame(left)
        self.s_safety.pack(fill="x", pady=4)

        self.s_geo = GeoListFrame(left, "形位公差项目（可多次添加，可自定义输入）", default_name="平面度", height=8)
        self.s_geo.pack(fill="both", expand=True, pady=4)
        self.s_geo.set_items(["平面度"])

        btns = ttk.Frame(left)
        btns.pack(fill="x", pady=6)
        ttk.Button(btns, text="计算", command=self.calculate_single).pack(side="left", padx=4)
        ttk.Button(btns, text="清空结果", command=lambda: self.s_output.delete("1.0", tk.END)).pack(side="left", padx=4)

        self.s_output = tk.Text(right, wrap="word", font=("Consolas", 10))
        self.s_output.pack(fill="both", expand=True)

    def calculate_single(self):
        try:
            D = parse_float(self.s_nominal.get(), "名义尺寸 D")
            total_input = parse_float(self.s_total.get(), "总允许误差")
            total_mm = normalize_tolerance(total_input, self.s_unit.get())
            if total_mm <= 0:
                raise ValueError("总允许误差必须大于 0。")
            geos = self.s_geo.get_items()
            if not geos:
                raise ValueError("请至少添加一个形位公差项目。")
            is_key = self.s_key.get() == "是"
            margin_mm, margin_desc = self.s_safety.calc(total_mm, is_key)
            available = total_mm - margin_mm
            if available <= 0:
                raise ValueError("安全余量过大，剩余可分配公差小于等于 0。")

            ratio = base_geo_ratio_single(geos, self.s_fit.get(), self.s_strategy.get(), is_key)
            geo_total = available * ratio
            dim_total = available - geo_total
            allocations = allocate_geos(geos, geo_total)
            min_req = min([dim_total] + [a.value_mm for a in allocations])
            process, difficulty, _, notes = recommend_process(min_req, self.s_material.get(), self.s_process_limit.get())
            it = estimate_it_grade(D, dim_total)

            lines: List[str] = []
            lines.append("单尺寸 + 多形位公差分配结果")
            lines.append("-" * 60)
            lines.append(f"名义尺寸 D：{D:.4f} mm")
            lines.append(f"总允许误差：{fmt_mm(total_mm)}（{mm_to_um(total_mm):.2f} μm）")
            lines.append(f"安全余量：{fmt_mm(margin_mm)}（{margin_desc}）")
            lines.append(f"可分配公差：{fmt_mm(available)}")
            lines.append("")
            lines.append(f"配合方式：{self.s_fit.get()}    材料：{self.s_material.get()}    策略：{self.s_strategy.get()}    关键尺寸：{self.s_key.get()}")
            lines.append("")
            lines.append(f"推荐尺寸总公差：{fmt_mm(dim_total)}")
            lines.append(f"推荐双边尺寸标注：{D:.4f} ± {dim_total/2:.5f} mm")
            lines.append(f"近似尺寸精度等级：{it}")
            lines.append(f"形位公差总预算：{fmt_mm(geo_total)}，占可分配公差 {ratio*100:.1f}%")
            lines.append("")
            lines.append("推荐形位公差：")
            for a in allocations:
                lines.append(f"  - {a.name}：{fmt_mm(a.value_mm)}    权重占比 {a.percent_of_geo_budget:.1f}%    检测：{get_inspection(a.name)}")
            lines.append("")
            lines.append("总公差校核：")
            geo_sum = sum(a.value_mm for a in allocations)
            lines.append(f"  尺寸总公差 {fmt_mm(dim_total)} + 形位合计 {fmt_mm(geo_sum)} + 安全余量 {fmt_mm(margin_mm)} = {fmt_mm(dim_total + geo_sum + margin_mm)}")
            lines.append("")
            lines.append("推荐加工方式：")
            lines.append(f"  {process}")
            lines.append(f"可加工性判断：{difficulty}")
            lines.append("")
            lines.append("风险/工艺提示：")
            for n in notes:
                lines.append("  - " + n)
            if self.s_fit.get() == "过盈":
                lines.append("  - 过盈配合建议额外复核压装量、圆度/圆柱度、同轴度或圆跳动，避免压装偏斜和局部接触应力过大。")
            lines.append("  - 本结果为规则库辅助分配，正式图纸建议结合 GB/T 1800、GB/T 1184、企业工艺能力和尺寸链校核复核。")

            self._set_text(self.s_output, "\n".join(lines))
        except Exception as e:
            messagebox.showerror("计算错误", str(e))

    # ---------- 两面 Z 向模式 ----------
    def _build_two_face_tab(self):
        container = ttk.Frame(self.two_face_tab)
        container.pack(fill="both", expand=True, padx=6, pady=6)
        left_scroll = ScrollableFrame(container, width=430)
        left = left_scroll.content
        right = ttk.Frame(container)
        left_scroll.pack(side="left", fill="both", padx=6, pady=6)
        right.pack(side="right", fill="both", expand=True, padx=6, pady=6)

        self.z_nominal = tk.StringVar(value="82")
        self.z_total = tk.StringVar(value="0.05")
        self.z_unit = tk.StringVar(value="mm")
        self.z_same_size = tk.StringVar(value="是")
        self.z_la = tk.StringVar(value="500")
        self.z_wa = tk.StringVar(value="82")
        self.z_lb = tk.StringVar(value="500")
        self.z_wb = tk.StringVar(value="82")
        self.z_fit = tk.StringVar(value="间隙")
        self.z_material = tk.StringVar(value="AL7075")
        self.z_process_limit = tk.StringVar(value="不限")
        self.z_strategy = tk.StringVar(value="标准")
        self.z_key = tk.StringVar(value="是")

        top = ttk.LabelFrame(left, text="Z 向功能公差输入")
        top.pack(fill="x", pady=4)
        self._row_entry(top, 0, "名义距离 H / mm", self.z_nominal)
        self._row_entry(top, 1, "Z 向总允许误差", self.z_total)
        self._row_combo(top, 2, "单位", self.z_unit, ["mm", "μm"])
        self._row_combo(top, 3, "A/B 面尺寸相同", self.z_same_size, ["是", "否"])

        face = ttk.LabelFrame(left, text="两个面的长宽尺寸 / mm")
        face.pack(fill="x", pady=4)
        self._row_entry(face, 0, "面 A 长度 L_A", self.z_la)
        self._row_entry(face, 1, "面 A 宽度 W_A", self.z_wa)
        self._row_entry(face, 2, "面 B 长度 L_B", self.z_lb)
        self._row_entry(face, 3, "面 B 宽度 W_B", self.z_wb)
        ttk.Label(face, text="若 A/B 尺寸相同，程序自动采用面 A 长宽。", foreground="#555").grid(row=4, column=0, columnspan=2, padx=4, pady=(0, 4), sticky="w")

        opt = ttk.LabelFrame(left, text="工况与策略")
        opt.pack(fill="x", pady=4)
        self._row_combo(opt, 0, "配合方式", self.z_fit, ["间隙", "过渡", "过盈"])
        self._row_combo(opt, 1, "零件材料", self.z_material, list(MATERIAL_RULES.keys()))
        self._row_combo(opt, 2, "加工方式限制", self.z_process_limit, ["不限", "CNC", "磨削", "研磨"])
        self._row_combo(opt, 3, "分配策略", self.z_strategy, ["保守", "标准", "激进"])
        self._row_combo(opt, 4, "关键装配尺寸", self.z_key, ["是", "否"])

        self.z_safety = SafetyFrame(left)
        self.z_safety.pack(fill="x", pady=4)

        lists = ttk.Frame(left)
        lists.pack(fill="both", expand=True, pady=4)
        self.z_geo_a = GeoListFrame(lists, "面 A 自身形位公差", default_name="平面度", height=4)
        self.z_geo_b = GeoListFrame(lists, "面 B 自身形位公差", default_name="平面度", height=4)
        self.z_geo_rel = GeoListFrame(lists, "两面关联形位公差", default_name="平行度", height=4)
        self.z_geo_a.pack(fill="x", pady=2)
        self.z_geo_b.pack(fill="x", pady=2)
        self.z_geo_rel.pack(fill="x", pady=2)
        self.z_geo_a.set_items(["平面度"])
        self.z_geo_b.set_items(["平面度"])
        self.z_geo_rel.set_items(["平行度"])

        btns = ttk.Frame(left)
        btns.pack(fill="x", pady=6)
        ttk.Button(btns, text="计算", command=self.calculate_two_face).pack(side="left", padx=4)
        ttk.Button(btns, text="清空结果", command=lambda: self.z_output.delete("1.0", tk.END)).pack(side="left", padx=4)

        output_box = ttk.Frame(right)
        output_box.pack(fill="both", expand=True)
        self.z_output = tk.Text(output_box, wrap="word", font=("Consolas", 10))
        z_output_scroll = ttk.Scrollbar(output_box, orient="vertical", command=self.z_output.yview)
        self.z_output.configure(yscrollcommand=z_output_scroll.set)
        self.z_output.pack(side="left", fill="both", expand=True)
        z_output_scroll.pack(side="right", fill="y")

    def calculate_two_face(self):
        try:
            H = parse_float(self.z_nominal.get(), "名义距离 H")
            total_input = parse_float(self.z_total.get(), "Z 向总允许误差")
            total_mm = normalize_tolerance(total_input, self.z_unit.get())
            is_key = self.z_key.get() == "是"

            la = parse_float(self.z_la.get(), "面 A 长度")
            wa = parse_float(self.z_wa.get(), "面 A 宽度")
            if self.z_same_size.get() == "是":
                lb, wb = la, wa
            else:
                lb = parse_float(self.z_lb.get(), "面 B 长度")
                wb = parse_float(self.z_wb.get(), "面 B 宽度")

            face_a = self.z_geo_a.get_items()
            face_b = self.z_geo_b.get_items()
            relation = self.z_geo_rel.get_items()
            if not (face_a or face_b or relation):
                raise ValueError("请至少添加一个面 A、面 B 或关联形位公差项目。")

            margin_mm, margin_desc = self.z_safety.calc(total_mm, is_key)
            available = total_mm - margin_mm
            if available <= 0:
                raise ValueError("安全余量过大，剩余可分配公差小于等于 0。")

            ratio = base_geo_ratio_two_face(face_a, face_b, relation, self.z_fit.get(), self.z_strategy.get(), is_key)
            geo_total = available * ratio
            dim_total = available - geo_total

            allocations = allocate_geos_grouped([
                ("面 A", face_a, 1.00),
                ("面 B", face_b, 1.00),
                ("关联", relation, 1.15),
            ], geo_total)
            min_req = min([dim_total] + [a.value_mm for a in allocations])
            max_len = max(la, wa, lb, wb)
            process, difficulty, _, notes = recommend_process(min_req, self.z_material.get(), self.z_process_limit.get(), max_face_len=max_len)
            it = estimate_it_grade(H, dim_total)

            lines: List[str] = []
            lines.append("两面 Z 向公差分配结果")
            lines.append("-" * 70)
            lines.append(f"名义距离 H：{H:.4f} mm")
            lines.append(f"Z 向总允许误差：{fmt_mm(total_mm)}（{mm_to_um(total_mm):.2f} μm）")
            lines.append(f"面 A 尺寸：{la:.3f} × {wa:.3f} mm")
            lines.append(f"面 B 尺寸：{lb:.3f} × {wb:.3f} mm")
            lines.append(f"配合方式：{self.z_fit.get()}    材料：{self.z_material.get()}    策略：{self.z_strategy.get()}    关键尺寸：{self.z_key.get()}")
            lines.append("")
            lines.append(f"安全余量：{fmt_mm(margin_mm)}（{margin_desc}）")
            lines.append(f"可分配公差：{fmt_mm(available)}")
            lines.append(f"形位公差总预算：{fmt_mm(geo_total)}，占可分配公差 {ratio*100:.1f}%")
            lines.append(f"推荐两面距离尺寸总公差：{fmt_mm(dim_total)}")
            lines.append(f"推荐尺寸标注：{H:.4f} ± {dim_total/2:.5f} mm")
            lines.append(f"近似尺寸精度等级：{it}")
            lines.append("")
            lines.append("推荐形位公差：")
            for group_name in ["面 A", "面 B", "关联"]:
                group_items = [a for a in allocations if a.group == group_name]
                if not group_items:
                    continue
                lines.append(f"  {group_name}：")
                for a in group_items:
                    lines.append(f"    - {a.name}：{fmt_mm(a.value_mm)}    预算占比 {a.percent_of_geo_budget:.1f}%    检测：{get_inspection(a.name)}")
            lines.append("")
            geo_sum = sum(a.value_mm for a in allocations)
            lines.append("总公差校核：")
            lines.append(f"  距离尺寸总公差 {fmt_mm(dim_total)} + 形位合计 {fmt_mm(geo_sum)} + 安全余量 {fmt_mm(margin_mm)} = {fmt_mm(dim_total + geo_sum + margin_mm)}")
            lines.append("")
            lines.append("形位公差合理性判断：")
            for a in allocations:
                if a.group == "面 A":
                    lines.extend(analyze_face_reasonableness(a.name, a.value_mm, la, wa, self.z_material.get(), "面 A"))
                elif a.group == "面 B":
                    lines.extend(analyze_face_reasonableness(a.name, a.value_mm, lb, wb, self.z_material.get(), "面 B"))
                else:
                    ctrl_l = max(la, wa, lb, wb)
                    lines.extend(analyze_face_reasonableness(a.name, a.value_mm, ctrl_l, min(max(wa, wb), ctrl_l), self.z_material.get(), "两面关联"))
            lines.append("")
            lines.append("推荐加工方式：")
            lines.append(f"  {process}")
            lines.append(f"可加工性判断：{difficulty}")
            lines.append("")
            lines.append("风险/工艺提示：")
            for n in notes:
                lines.append("  - " + n)
            if self.z_fit.get() == "过盈":
                lines.append("  - 过盈配合下，两面距离尺寸会影响压装量；建议同步复核圆度、圆柱度、同轴度、倒角和表面粗糙度。")
            if relation and not face_a:
                lines.append("  - 仅给关联形位而未给基准面自身形位时，需确认基准面 A 是否已有平面度或其他基准质量要求。")
            if ("平行度" in relation or "垂直度" in relation) and max_len >= 300:
                lines.append("  - 大尺寸面方向公差建议优先使用可靠基准加工；检测时注意支撑点、重力变形和温度一致性。")
            lines.append("  - 本工具按极值叠加思路分配：T_total = T_dim + ΣT_geo + T_margin；正式图纸仍需结合基准体系和尺寸链复核。")

            self._set_text(self.z_output, "\n".join(lines))
        except Exception as e:
            messagebox.showerror("计算错误", str(e))

    # ---------- 小工具 ----------
    def _row_entry(self, parent, row: int, label: str, var: tk.StringVar):
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="e", padx=4, pady=4)
        ttk.Entry(parent, textvariable=var, width=18).grid(row=row, column=1, sticky="ew", padx=4, pady=4)
        parent.columnconfigure(1, weight=1)

    def _row_combo(self, parent, row: int, label: str, var: tk.StringVar, values: List[str]):
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="e", padx=4, pady=4)
        ttk.Combobox(parent, textvariable=var, values=values, width=16, state="readonly").grid(row=row, column=1, sticky="ew", padx=4, pady=4)
        parent.columnconfigure(1, weight=1)

    def _set_text(self, widget: tk.Text, content: str):
        widget.delete("1.0", tk.END)
        widget.insert(tk.END, content)


# -----------------------------
# 简单自测函数，供命令行调试
# -----------------------------

def self_test() -> str:
    total_mm = 0.05
    margin, _ = calc_safety_margin(total_mm, "自动", "", "mm", True)
    available = total_mm - margin
    face_a = ["平面度"]
    face_b = ["平面度"]
    relation = ["平行度"]
    ratio = base_geo_ratio_two_face(face_a, face_b, relation, "间隙", "标准", True)
    geo_total = available * ratio
    dim_total = available - geo_total
    allocations = allocate_geos_grouped([("面 A", face_a, 1.0), ("面 B", face_b, 1.0), ("关联", relation, 1.15)], geo_total)
    total_check = dim_total + sum(a.value_mm for a in allocations) + margin
    return f"self_test: dim={dim_total:.6f}, geo={geo_total:.6f}, margin={margin:.6f}, check={total_check:.6f}"


if __name__ == "__main__":
    # 若需要命令行快速验证，可取消下一行注释
    # print(self_test())
    app = ToleranceApp()
    app.mainloop()
