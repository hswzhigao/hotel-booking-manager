# V9/V10 设计 — 联系方式分字段 / 卡片类型字典 / 拼音搜索

状态：**Implemented**（2026-09-27）

## V9：闲鱼号/微信号拆分 + 卡片类型字典

1. **联系方式分字段**：customers 与 benefit_holders 的 `wechat` 字段拆为
   - `xianyu_id`（闲鱼号）——迁移时旧数据保留在此（用户自行把微信的挪走）
   - `wechat_id`（微信号）——新字段，默认空
   - 搜索同时匹配两个字段
2. **卡片类型入字典**：benefit_holders.card_type 仍为逗号分隔存储；选项来自
   option_dict（category='card_type'，种子：经典白/大白金/普通白金/金葵花/中信银行/浦发AE白）
   - 前端改为多选下拉（allow-create，可自定义新值）；列表展示为 el-tag
   - 基础配置页新增「卡片类型」分区

## V10：拼音/首字母搜索

- customers 与 benefit_holders 新增 `search_key VARCHAR(200)`：
  全拼无调 + 空格 + 首字母（张三 → `zhangsan zs`），由 pinyin-pro 在 POST/PUT 时生成，迁移时存量回填
- 列表 search 匹配：姓名 / search_key / 闲鱼号 / 微信号 / 电话（预订人另含权益/卡类型）
- 前端搜索框无需变化，直接输汉字/全拼/首字母

## 附：趋势图缩放控件（V6 增强）

- 图表右上角按钮组：◀ ▶ 平移（步长 25% 窗口）、− ＋ 缩放（0.7/1.4 倍）、满屏复位
- 与鼠标拖拽/滚轮并存；echarts dispatchAction dataZoom 驱动，同轴双 dataZoom（inside+slider）同参
