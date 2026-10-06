# 用户列表与创建公共 UI

候选从 `7c1d55863f29dc38553b33cba2b0116220e3ee47` 接入现有 tokens 0.1.2 / UI React 0.1.5。`/gateway/users` 的标题、四项筛选、五列排序、20 条分页、创建窗口和 metadata 预览使用公共 PageHeader、Field、Input/Textarea、Select、ControlButton、Table、Badge、Dialog 和状态反馈。用户邮箱使用 Next Link 进入已有详情页，支持键盘和浏览器链接操作；关闭窗口恢复操作焦点。明暗主题沿用公共 tokens，长表单和宽表格各有明确滚动区域。

## 行为与边界

列表查询由一个 query 状态和所属请求控制。每次替换或离页取消旧读取，20 秒预算覆盖完整响应 body；列表响应经过运行时校验。读取失败显示错误并提供主动重读，当前查询成功后才显示其结果。401 通知根会话所有者。创建写入使用同步标记防止同帧重复提交；未确认写入时保留草稿、阻止再次创建和关闭窗口。主动回读失败继续保留保护，成功回读后才解除保护。服务端明确的 400 拒绝保留输入并允许修正。

已实测的业务契约：

- 邮箱必填；外部系统和外部用户 ID 同时填写或同时留空。重复外部身份对返回已有用户，已有邮箱和预算保持。
- max 留空发送 null；base 省略且 max 为 null 时服务端创建零 base。零 max、daily / weekly / monthly 周期和预算重置由真实服务处理。
- 创建 metadata 接受 JSON 对象或序列化 JSON 字符串；数组由真实服务以 400 拒绝。预览支持现有存储 JSON，非法存储 JSON 明确显示原文。
- `users` 保存唯一预算状态，列表只统计 active API keys；创建审计来源维持 `gateway_user_provision`。
- 更换排序列首次为降序；再点同列切换升降序，沿用 `nextListSortStateWithAscToggle`。

`UserTable` 使用稳定排序和 metadata 回调，真实 V8 证明创建邮箱输入六个字符产生零次表格 render，排序操作产生一次。metadata Dialog 首次打开时才挂载，关闭后清除用户对象并保留 Root 的焦点恢复生命周期。

新增依赖为 0；package、lock 和 vendor 六项文件长度与 SHA256 保持。en / zh / ja / ko 起点各 1488 个文案值保持，各新增八个 `users.feedback` 键。用户详情页的源码字节保持，预算调整、用户密钥、日志及审计控件分别在后续批次迁移。

## 实际验证

证据根目录：`/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-users-ui`。

Browser 插件在会话中缺席，复用现有 Playwright Core 和 Chromium 153.0.8010.12。验证使用独立本机 PostgreSQL、真实 Next 生产服务、真实 Chromium 和透明 loopback HTTP 转发。端口由系统分配，账号、数据库、运行目录及进程按阶段隔离。

最终统一入口：

```bash
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-users-ui/run.mjs validation-v2 revalidation.mjs --wait-slot
```

`run.mjs` 先记录资源 status 与 changed / 起点计划；控制器对该仓库返回 `RESOURCE_SCOPE_UNKNOWN` 时采用已保存的明确 Admin validation adapter，再经统一单 dev 构建槽执行。六阶段依次进行 lint / build / standalone / types、浏览器流程、生命周期、V8、性能和实际绘制检查；九项依赖脚本冻结并回读。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 受影响 ESLint、Next webpack 生产构建、standalone、TypeScript | 四项通过 | `validation-v2-build-checks.json` |
| 身份、非空页面、框架错误覆盖层、真实操作与控制台 | 20 项通过，pageerror 0 | `validation-v2-basic-browser.json` |
| 替换 / 离页取消、完整 body 超时、非法响应、不确定写入回读、socket、401 | 八项通过，pageerror 0 | `validation-v2-lifecycle-lifecycle.json` |
| 表格 V8 调用 | 六字符输入 0，排序 1 | `validation-v2-render-coverage.json` |
| 1440 / 1024 / 820 / 390 / 320px，明暗主题 | 十组列表与创建窗口通过 | `validation-v2-basic-browser.json` |
| 四语言 320px、实际 Dialog 入场完成 | 通过 | `validation-v2-visual-visual.json` |
| 源码 / 依赖 / 文案保持与运行清理 | 通过 | preservation 与各阶段 cleanup 报告 |

真实操作覆盖筛选、五列双向排序、分页、预算与 active keys 数、对象 / 非法 metadata、内部与外部创建、幂等身份匹配、实际 SQL 和 audit 回读、键盘详情跳转、实际 500 后主动恢复。生命周期用真实已提交 POST 的不完整响应证明单次写入和 20 秒期限，失败回读继续锁定。控制台 HTTP 400 / 500 对应明确故障场景，未出现其他页面运行错误。桌面浅色创建和 320px 中文暗色创建截图已人工查看。

## 性能与资源

与父批用户页冻结运行资产比较，两个预热 / 变体及 16 组 ABBA / BAAB 共 64 正式样本。相同 20 用户、预算、对象 metadata、已签发会话、Asia/Shanghai、1440×900、新 Chromium context、禁缓存，并在 heap 采样前执行真实 GC。时间包括浏览器 locator 观察；gzip 为实际请求的 JS / CSS 单文件压缩累计。结论限定该实测环境。

| 指标 | 起点 | 候选 | 差异 |
| --- | ---: | ---: | ---: |
| 列表就绪 | 104.30 ms | 104.70 ms | +0.38% |
| 列表 JS heap | 5,162,296 bytes | 5,663,734 bytes | +9.71% |
| 滚动 P95 | 16.75 ms | 16.80 ms | +0.30% |
| 冷创建窗口 | 60.10 ms | 65.15 ms | +8.40% |
| 创建窗口 JS heap | 5,541,884 bytes | 6,364,518 bytes | +14.84%，调查 |
| 输入 | 9.70 ms | 9.00 ms | −7.22% |
| 关闭后 JS heap | 5,746,094 bytes | 6,618,578 bytes | +15.18%，调查 |
| 首屏 gzip | 225,290 bytes | 229,609 bytes | +1.92% |
| 全 Admin 静态 gzip | 701,944 bytes | 702,446 bytes | +0.07% |

初轮列表 heap 超过 10% 调查线；延迟挂载 metadata 窗口后上述列表与冷创建指标通过调查线。创建与关闭 heap 的增量仍单独记录为调查状态。两变体各连续 48 次创建 / 输入 / 关闭并观察动画和 Portal 卸载后，候选 DOM 节点保持 947、监听器保持 554，普通 object 自有字节增量 3,624 bytes、closure 数减少一项；新增 code 类节点自有字节为 1,192,072 bytes。旧界面相应 code 增量为 503,576 bytes。增长主要位于 V8 的 code 类，尚不能将其细分为产品代码优化与浏览器自动化编译成本；该观察未显示按周期累积的窗口 DOM / 监听器，也不证明所有对象均不存在泄漏。只保存聚合计数，原始 heap 快照未落盘，见 `heap-attribution-v1-heap-attribution.json`。用户批次成本决定与认证 / 导航、供应商和 API Key 的待决成本分别处理。

聚合调查统一运行 `a15c936c-bde5-490f-9458-cc17f7b76de5` 为 33.713 秒，峰值 RSS 1,320,321,024 bytes，swap 0→0，卷级增量 1,761,280 bytes，源码指纹前后一致。12 次周期观察报告 `heap-lifecycle-v2` 为 18.620 秒 / RSS 967,393,280 bytes；48 次初次观察 `heap-lifecycle-v3` 因过程中新增本说明文档触发 `RESOURCE_SOURCE_CHANGED`，未作为被接纳的验证结果。完成文件固定后，聚合调查显式重验通过。

最终统一运行 `176887ed-cc40-4be9-a925-6e6451fa4524` 为 182.209 秒，采样峰值进程树 RSS 2,951,004,160 bytes，swap 0→0，物理卷增量 6,422,528 bytes，源码指纹前后一致。RSS 与页面 JS heap 为不同口径；卷级变化可能包含其他进程写入。复用 738 个浅层依赖链接、现有 core 编译 JavaScript 和共享 webpack 缓存；下载 0。缓存位于 `/Users/xiaosong/dev/xsec-labs/.worktree-cache`，资源报告记录实际 target。内盘资源满足本批构建，1T 外置盘保留为需要时的构建位置。

原始失败与调查保留：排序脚本早期首次方向假设、状态文案大小写、重载后筛选假设、重复 Close locator、透明入场帧截图以及旧界面的焦点恢复断言均按真实证据修正后显式执行新阶段。最终性能与周期检查各自保存采样及报告。

## 集成、回滚与验收范围

该批为已验证的独立候选。产品 master 起点为 `34e643f12d557a774a86c14bd9602bbef0b264b5`；本地集成需完成相关成本决定，然后回读主仓源码与运行资产并验证集成结果。待决候选及父批工作树 / 共享缓存保留供集成，阶段数据库、临时运行目录、进程和租约在检查后清理。

回滚本 UI 提交并重建即可恢复父批页面；实际已创建的用户、预算和审计记录需要按数据库处理，Git 回滚不回滚业务数据。Docker、Windows / Linux / Intel macOS、Safari / Firefox、读屏 / 触屏 / IME / 缩放、移动性能、Cloud OpenNext 与生产部署需对应验收。此批的页面验收不代表全工作区迁移完成。
