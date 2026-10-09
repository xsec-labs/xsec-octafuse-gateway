# 请求日志公共 UI

本页保存该批候选阶段的实现、测量和验收档案。当前产品的 24 批公共 UI 已于 2026-10-10 本地合入 `master`（`90c8f942be5389ec3686011888dbfd2bda5e7248`）；成本决定、主仓复验与资源清理以[公共 UI 集成记录](public-ui-integration.md)及其证据收据为准。


请求日志页使用 `@xsec/ui-react` 的标题、字段、输入、选择、按钮、表格、抽屉及弹层。滚动和日历快捷、业务时区起止输入、七类筛选、50 条分页与 URL 深链继续由日志页面维护。详情按身份和路由、上游编号、时序、计费审计及三份报文分组；窄屏下报文面板纵向排列。

## 读取和失败行为

日志、模型目录、供应商目录、路由目录及币种配置分别拥有可取消的读取。页面离开和读取替换会取消所属请求；20 秒总预算覆盖响应头及完整正文。错误显示对应边界和错误码，重新读取由用户操作触发。日志失败时隐藏原有行；总数仅在成功确认列表后显示，读取中和失败时暂停统计。目录失败时暂停对应选择控件；币种读取失败或配置非法时暂停金额展示。成功读取且没有币种配置项时使用网关声明的 USD 默认值。

首轮日志读取在 URL 筛选初始化后执行。应用筛选和分页会同步 URL；空起止值表示全部时间。时间输入按已确认的业务时区转换为 UTC，并在发出请求前检查有效性及先后顺序。响应的分页元数据、行身份、时间、文本、使用量和费用都在边界校验；PostgreSQL 十进制文本转为有限数字后才展示。

详情抽屉和时序说明使用公共弹层的键盘与焦点契约。复制控件独立拥有状态、异步结果与反馈计时器。记录的 JSON 解析失败时显示错误说明及原始文本，复制内容与显示的文本一致。

宽表格在自己的滚动容器内横向浏览。OpenAI 品牌图标为绝对定位的读屏标签提供相对定位的外层，使标签跟随图标所在的滚动与裁剪范围；供应商和路由页面共用该图标契约。320px 实际布局探针验证了外层定位前后页面滚动宽度的变化。

## PostgreSQL UTC 范围

日志 API 约定无偏移的 `YYYY-MM-DD HH:mm:ss` 为 UTC。PostgreSQL 的 TIMESTAMPTZ 比较会按连接时区解释无偏移文本，因此仓储先为这种格式标明 UTC；ISO 格式及显式偏移保留其时间含义。起止比较仍为包含边界。

真实数据库回归位于 `packages/core/src/db/postgres/request-log-utc-range.integration.test.ts`，使用 UTC、Asia/Shanghai 和 America/Los_Angeles 三种连接时区，并覆盖 SQL 格式、ISO 格式、显式偏移及开放结束边界。向已迁移的隔离 PostgreSQL 设置 `DATABASE_URL` 后，从仓库根目录运行：

```sh
rtk npx --no-install tsx --test packages/core/src/db/postgres/request-log-utc-range.integration.test.ts
```

## 验收记录

生产构建、受影响 ESLint、standalone 布局与 TypeScript 检查通过。真实 Next、PostgreSQL、Chromium 153 与 Clipboard 已完成 17 项页面流程和 5 项读取生命周期检查，包含 401、500、传输未完成、非法费用和非法币种。320、390、768、1024、1440px 的明暗布局及四语言 320px 共 14 组检查通过；320px 使用真实横向滚轮确认表格滚动范围。标识卡片和利润文字的明暗对比度分别至少为 5.39:1 和 5.87:1。四语言原有各 1511 项翻译保持，分别新增 6 项；新增依赖为零，包依赖及锁文件保持。

性能使用同一隔离 PostgreSQL 的 61 条记录、首屏 50 条、相同显式 ISO 范围、1440×900 视口与真实会话。禁用缓存，堆采样前执行 GC；4 次预热和 32 次正式 ABBA/BAAB 样本的中位数为：

| 指标 | 基线 | 候选 | 变化 |
| --- | ---: | ---: | ---: |
| 列表就绪 | 137.70ms | 139.00ms | +0.94% |
| 列表 JS 堆 | 6373554 bytes | 6902020 bytes | +8.29% |
| 冷详情打开 | 47.20ms | 42.65ms | −9.64% |
| 详情 JS 堆 | 7313474 bytes | 7999998 bytes | +9.39% |
| 关闭后 JS 堆 | 7341254 bytes | 8038468 bytes | +9.50% |
| 滚动 P95 | 16.70ms | 16.70ms | 0% |
| 实际首屏 gzip | 236810 bytes | 242140 bytes | +2.25% |
| 全 Admin 静态 gzip | 706292 bytes | 710297 bytes | +0.57% |

八项指标均在方案 10% 调查线内。列表就绪和详情打开包含自动化定位器观测；关闭堆在抽屉 portal 消失后采样，结果限定 Apple Silicon macOS/Chromium 桌面。一次后续性能复核在基线金额显示等待处超时，独立页面与 HTTP 探针读回双方金额及币种均成功，该超时未复现；保留原始失败，补充失败样本诊断后显式复核通过。

证据目录为 `/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-request-logs-ui`。统一入口为 `rtk node <证据目录>/run.mjs <阶段> <脚本> --wait-slot`；最终构建为 `candidate-build-v9 candidate-build.mjs`，页面和生命周期为 `final-v3 final-validation.mjs`，最终视觉为 `visual-perf-v1 visual-performance.mjs` 的视觉报告，最终性能为 `perf-v2 performance.mjs`。各阶段保留资源状态、changed/base 计划、源码指纹及清理结果。

最终构建耗时 17.049s、峰值 RSS 2953461760 bytes、卷级增量 462848 bytes；流程/生命周期/初轮视觉与性能耗时 92.382s、峰值 RSS 1004912640 bytes；最终性能 42.596s、峰值 RSS 1004765184 bytes、卷级增量 1196032 bytes。上述运行 swap 为 0→0，源码指纹保持。复用现有 Node 依赖、Chromium、webpack 与共享构建缓存；卷级增量可能包含其他进程写入。隔离数据库、运行进程及阶段租约按报告清理。

本批 UI 的性能检查通过，候选本地集成依赖认证/导航、供应商、API 密钥、用户列表和详情各自的成本决定。PostgreSQL UTC 修复已独立本地集成，OpenAI 图标定位修复独立提交。UI 回滚撤销本批 UI 提交并重建；已存日志、用户与审计数据按数据库处理。日期修复和图标修复按其独立提交回滚。

Cloudflare D1、MySQL、Docker、Windows/Linux/Intel macOS、Safari/Firefox、读屏、触屏、IME、缩放、移动性能与云部署尚未执行本批运行验收。共享图标的供应商和路由消费者已核对源码；其完整流程仍使用各批验收范围。
