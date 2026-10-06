# Octafuse 供应商公共 UI

供应商列表、搜索、新建和编辑、状态切换、密钥复制、删除确认及模板导入采用公共 tokens 0.1.2 / UI React 0.1.5。PageHeader、Toolbar、按钮、字段、Input、Textarea、Switch、Checkbox、Badge、Dialog 和状态反馈统一明暗主题、焦点和减少动效。应用继续维护 en/zh/ja/ko 文案；每种语言新增 19 个反馈键，原有文案值保持。布局在 1440/1024/820/390/320px 验证，主操作至少 44px，窄屏列表和弹窗按内容滚动。

## 行为与请求契约

列表、模板目录、写入和密钥读取分别拥有请求生命周期，复用根布局的 useShellRequest。20 秒预算覆盖完整响应 body；替换和卸载取消对应请求，写入 ref 防止同帧重复提交。实际 HTTP、解析和网络错误显示明确状态与主动读取入口；401 使用已有根会话失效事件。服务器已经接收的写入可能在完整确认前生效，界面保留草稿并提示核对，用户可以读取实际列表。

供应商、模板、导入结果和密钥响应经过运行时校验。列表读取失败显示错误；只有真实成功的零条结果显示空态。非法存储 endpoints 显示 INVALID_RESPONSE。现有供应商路由的缺表 HTTP500 返回 success/message，界面显示 HTTP_ERROR 与状态码；该响应没有 requestId。

编辑留空 API Key 保留原密钥；复制供应商预填协议并清空密钥，建议可用的新 ID。OpenAI、Anthropic、Gemini 的 base 和 capability overrides 保持原有接口。覆盖地址区域由用户的展开状态控制；清空最后一个覆盖值时继续展开并保持输入焦点。完成编辑或删除后，焦点返回稳定的新建按钮；切换状态刷新后返回对应 Switch。嵌套删除确认支持焦点陷阱、Escape 和返回。

复制密钥使用实际 Clipboard API，列表和页面正文保留脱敏值；权限拒绝显示失败。复制状态计时器在替换和卸载时释放。模板导入按需加载，支持搜索、选择和部分成功；结果分别列出实际新增数与失败模板 ID。服务端失败详情可能含数据库 SQL，页面使用本地化提示。专业供应商图标、静态模板、认证和计费接口保持既有实现。

列表行按实际稳定依赖复用组件。真实 V8 调用计数中，40 行列表、编辑输入 6 字符，起点卡片调用 240 次，候选 0 次。编辑器随页面加载，模板导入单独加载。新增依赖 0，manifest、锁文件和 vendor 字节与本批起点一致。

## 真实验收与性能

证据目录：`/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-providers-ui`。

受影响 ESLint、Next webpack 生产构建、standalone 存在性和类型检查通过。独立 PostgreSQL、真实 Next 服务、透明 loopback HTTP 代理与 Chromium 153 通过 23 项流程及五视口。涵盖实际 CRUD/SQL、三协议覆盖、密钥保留、Clipboard 成功与权限拒绝、重复 ID 和引用删除的 409、缺表 500、非法 endpoints、目录请求取消、已提交 POST 的部分响应体 20 秒超时/单次写入/主动读取、四语言、深色/减少动效和撤销会话 401。pageerror 为 0；两次 409、一次 500 和一次 401 是对应错误流程的实际控制台记录。

独立部分导入验收使用真实 PostgreSQL trigger 拒绝一个模板：选择两个、新增一条、失败一条，数据库与界面一致。五视口 Checkbox 均为 18×18px；Space 切换、深色 Portal 和焦点通过。列表桌面/320px、390px 深色编辑与导入截图已查看。

性能比较起点为同一认证与导航候选 `bc2637046c2ced0d2bcbb80179c778f1ea3defb4`。公共认证与导航的自身成本单独记录于 public-auth-navigation-ui.md。相同 40 条供应商、Asia/Shanghai、真实会话、1440×600、Chromium 153 新上下文、禁用缓存、GC 后堆内存，16 组 ABBA/BAAB 共 64 正式样本及 4 预热。

| 指标 | 起点 | 候选 | 变化 |
| --- | ---: | ---: | ---: |
| 列表就绪 | 120.90ms | 122.40ms | +1.24% |
| 列表 GC 后 JS heap | 5,271,908bytes | 5,914,100bytes | +12.18% |
| 滚动帧间隔 P95 | 16.70ms | 16.80ms | +0.60% |
| 冷打开编辑 | 56.50ms | 61.65ms | +9.12% |
| 编辑弹窗 JS heap | 5,855,490bytes | 6,342,704bytes | +8.32% |
| 输入耗时 | 8.65ms | 6.05ms | −30.06% |
| 关闭后 JS heap | 5,971,946bytes | 6,454,656bytes | +8.08% |
| 首屏 JS/CSS gzip | 235,273bytes | 235,346bytes | +0.03% |
| 完整 Admin JS/CSS gzip | 675,041bytes | 682,983bytes | +1.18% |

列表 heap 超过方案 10% 调查线，当前报告保持 INVESTIGATE，等待本批成本决定。列表增加 642,192bytes，约 0.61MiB。首屏资产在列表确认就绪、滚动和编辑之前记录；完整资产为全部 Admin 路由构建的静态 JS/CSS。ready 和编辑时延包含真实浏览器 locator 观察；关闭后 heap 可包含已经加载的模块和动画状态。JS heap 与 OS 进程 RSS 使用不同口径。结论限定本机、记录的数据和桌面视口。

## 命令、资源与候选状态

以下入口均先保存 status 和 changed/base 计划，再由统一单构建槽执行：

```sh
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-providers-ui/run.mjs candidate-build-v12 candidate-build.mjs --wait-slot
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-providers-ui/run.mjs candidate-final-v3 final-ui-checks.mjs --wait-slot
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-providers-ui/run.mjs perf-final-v3 performance.mjs --wait-slot
```

| 阶段 | runId | 用时 | 峰值进程树 RSS | 卷级磁盘增量 |
| --- | --- | ---: | ---: | ---: |
| 构建 | 11b263ad-18d3-4922-9b32-7ab75e5ed171 | 20.921s | 3,056,353,280bytes | −10,956,800bytes |
| 浏览器与部分导入 | 96a9c811-9c33-42fd-93b0-a027b4af0ad5 | 28.553s | 1,004,421,120bytes | +20,615,168bytes |
| 性能 | 636c2099-eb07-48bc-834f-e48300af235e | 124.533s | 1,003,634,688bytes | −4,120,576bytes |

三阶段 swap 均 0→0，源码指纹前后一致；卷级变化可含其他进程写入。控制器使用 dev target `b27abc052fc82fd663abf2de544f62647354f97863b0f2e84f2f7411b472e557`，实际 Next 输出和缓存在任务工作树 packages/admin/.next。复用已有依赖链接和公共包缓存；基线运行文件以硬链接保存于证据目录 before，280 项 SHA256/长度回读一致。每次真实运行的隔离数据库和进程清理通过。

当前候选依赖公共认证与导航批次，两批成本决定分别保留。主仓 master 保持认证契约提交 `34e643f12d557a774a86c14bd9602bbef0b264b5`；本地集成后补充主仓构建、真实流程、源码/运行资产回读及任务工作树回收记录。源码、运行资产与候选元数据在证据目录冻结保存。

## 回滚与未验证范围

回滚本批供应商提交并重建恢复起点页面，认证与导航公共包、服务端会话契约维持各自版本。已经发生的业务写入及会话事件以数据库实际状态为准；Git 回滚不撤销这些记录。Windows/Linux/Intel macOS、Safari/Firefox、读屏/触屏/IME、移动性能、实际供应商请求执行、Docker 镜像运行、云 OpenNext 和生产部署分别验收。
