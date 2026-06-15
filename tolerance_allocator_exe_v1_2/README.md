# 公差分配助手 V1.2

这是一个基于 Python + tkinter 的公差分配辅助程序，支持：

1. 单尺寸 + 多形位公差分配；
2. 两面 Z 向公差分配；
3. 多个形位公差自由添加、删除、清空；
4. 两个面的长宽尺寸输入，用于判断平面度、平行度、垂直度等形位公差是否合理；
5. 安全余量输入接口：自动、手动百分比、手动固定值；
6. 材料规则库：AL7075、SUS304、45钢、钛合金、塑料、陶瓷、其他；
7. 加工方式限制：不限、CNC、磨削、研磨；
8. 输出推荐尺寸公差、形位公差、IT 等级近似、加工方式、检测建议和风险提示。

## 文件说明

```text
tolerance_allocator_gui.py      主程序
run_windows.bat                 Windows 下直接运行源码
build_exe_windows.bat           Windows 下一键打包 EXE
tolerance_allocator.spec        PyInstaller 打包配置
README.md                       使用说明
```

## 直接运行

Windows 安装 Python 3.10 或更高版本后，双击：

```text
run_windows.bat
```

## 打包 EXE

双击：

```text
build_exe_windows.bat
```

成功后生成：

```text
dist\公差分配助手.exe
```

## 两面 Z 向模式的计算关系

程序按极值叠加思路进行初步分配：

```text
T_total = T_dim + ΣT_geo_A + ΣT_geo_B + ΣT_geo_relation + T_margin
```

其中：

```text
T_dim：两个面之间的距离尺寸总公差
ΣT_geo_A：面 A 自身形位公差合计
ΣT_geo_B：面 B 自身形位公差合计
ΣT_geo_relation：两个面之间的关联形位公差合计
T_margin：安全余量
```

## 安全余量

安全余量支持三种模式：

```text
自动：普通尺寸默认 5%，关键装配尺寸默认 10%
手动百分比：例如输入 8 表示 8%
手动固定值：例如输入 5 μm 或 0.005 mm
```

## 重要说明

本程序是工程预估工具，不是正式标准查表软件，不能替代：

- GB/T 1800 系列标准查表；
- GB/T 1184 等形位公差标准查表；
- 企业供应商工艺能力评审；
- 正式尺寸链、公差链、装配链校核；
- 检具设计和测量不确定度分析。

正式出 2D 图纸前，建议将程序输出作为初版分配结果，再结合基准体系、装配功能、加工路线和检测条件进行复核。
