# Ziinc Tool Box

个人信息与工程计算工具箱，当前为单文件静态网页，可直接通过 GitHub Pages 部署。

## 功能

- 个人资料、头像、常用信息和简历本地编辑
- 配置导出 / 导入，便于多电脑迁移
- 单位转换
- Hertz 接触计算
- 球-V槽刚度计算
- 稳定性计算：读取 Excel / CSV 数据并计算最大值、最小值、PV、平均值、3sigma
- 面型分析：读取 x、y、z1、z2、timestamp 点云数据，进行 3-Sigma 残差滤波、平面拟合、RMS、Rx、Ry、TTV 和 2D/3D 可视化

## GitHub Pages

将仓库根目录作为 Pages 发布源即可，入口文件为 `index.html`。

个人配置文件 `ziinc-tool-box-config-*.json` 包含个人资料，已在 `.gitignore` 中排除，不建议提交到公开仓库。
