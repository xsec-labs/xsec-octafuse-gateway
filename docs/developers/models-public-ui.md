# Octafuse 模型管理公共 UI

本页保存该批候选阶段的实现、测量和验收档案。当前产品的 24 批公共 UI 已于 2026-10-10 本地合入 `master`（`90c8f942be5389ec3686011888dbfd2bda5e7248`）；成本决定、主仓复验与资源清理以[公共 UI 集成记录](public-ui-integration.md)及其证据收据为准。


模型列表、类别与供应商筛选、搜索、新建和编辑、删除确认、模板导入、metadata 预览和价格编辑采用公共 tokens 0.1.2 / UI React 0.1.5。PageHeader、Toolbar、按钮、RadioGroup、Badge、Dialog、Field、Input、Textarea、Select、Checkbox、Tooltip、表格和状态反馈统一主题、焦点及减少动效。专业模型图标、多模态标记和成熟定价 serializer 继续承担业务展示及数据转换。en/zh/ja/ko 各新增24个反馈键，每种语言原有1440个文案值保持。

## 行为与状态契约

真实基线中，模型表不可用产生HTTP500，旧页面仍显示空模型列表；原因是读取失败没有独立状态。现在列表、目录、详情和币种明确区分 loading/error/ready，只有成功读取的零条结果显示空态。非法持久化 modalities、pricing_profile、目录、计数或币种响应明确失败。合法未配置的计费币种沿用既有USD业务含义。

URL的kind/vendor是筛选状态的权威来源，搜索只派生显示结果。Models和Routes使用同一模型编辑controller；详情读取成功后才开放可保存表单。列表、详情、目录、币种和写入分别复用useShellRequest，20秒预算覆盖完整响应body；替换、关闭和离页取消所属读取，同帧写入保护限制重复提交。401通知根会话失效。服务器已接收的写入可能在完整确认前生效，界面保留草稿并提示核对，用户主动读取实际状态。

LLM的阶梯/token/cache、Image的token/per-image、Audio的token/per-second计费以及USD/CNY目录保持既有业务接口。Token上限使用正安全整数校验；Image和Audio清空不适用的context/max_tokens。新建草稿独立初始化Image模式和Image/Audio价格，切换类别保持对应的有效默认值。metadata非法JSON保留输入和数据库原值；定价JSON使用实际Clipboard API，权限拒绝显示错误，复制所有者在替换与卸载时失效。

导入摘要说明已有模型保留，确认弹窗列出当前数量和实际币种。完整业务说明可以展开；模板目录按需加载，结果分别显示created/skipped/failed/currency，失败项仅列模板ID，服务端SQL详情保持在诊断边界。已有ID禁选，重复导入保持已存字段。删除取消保留模型、路由和标签；成功删除的级联结果从真实数据库回读。

嵌套弹窗支持焦点陷阱和Escape；取消删除返回删除按钮，成功保存或删除返回稳定页面入口。模型名称使用可聚焦按钮。1440/1024/820/390/320px布局、窄屏弹窗滚动、底部操作及390px明暗主题/减少动效经过真实验证。共享ReadOnlyImagePricing在Routes的实际模型消费者中验证价格和主题；完整Routes页面列为后续迁移。

## 真实验收与性能

证据目录：`/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-models-ui`。

受影响ESLint、Next webpack生产构建、standalone存在性和类型检查通过。独立PostgreSQL、真实Next、透明loopback HTTP代理与Chromium153通过37项流程及五视口。覆盖三种模型/五种计费、实际CRUD/SQL、URL深链、metadata、Clipboard成功与实际权限拒绝、缺表500、非法币种与modalities、缺详情404、撤销会话401、目录/详情取消、焦点、同帧双提交、已提交POST部分body的20秒预算、socket失败和离页取消。pageerror为0；500/404/401分别属于实测故障流程。导入使用真实PostgreSQL trigger拒绝两个模板中的一个，selected2/created1/failed1与界面、数据库一致。

40模型、编辑输入6字符的真实V8调用计数中，起点卡片调用240次，候选0次。ModelCard按实际稳定model与callback依赖复用。新增依赖0，manifest、锁文件和vendor字节保持；737个浅层依赖链接、workspace源码入口和共享core编译JavaScript沿用既有缓存。基线465个运行文件SHA256与长度回读一致。

性能比较起点为供应商候选`745a5449a9d2cf9fb9dbb2710c205b38cab918c3`。相同40条单档LLM、Asia/Shanghai、真实会话、1440×600、Chromium153新上下文、禁用缓存、GC后heap，16组ABBA/BAAB共64正式样本及4预热。认证/导航和供应商自身成本分别记录。

| 指标 | 起点 | 候选 | 变化 |
| --- | ---: | ---: | ---: |
| 列表就绪 | 127.50ms | 128.05ms | +0.43% |
| 列表GC后JS heap | 6,541,792bytes | 6,811,848bytes | +4.13% |
| 滚动帧间隔P95 | 16.70ms | 16.75ms | +0.30% |
| 冷打开编辑 | 75.55ms | 78.25ms | +3.57% |
| 编辑弹窗JS heap | 7,911,344bytes | 7,951,522bytes | +0.51% |
| 输入耗时 | 13.65ms | 9.40ms | −31.14% |
| 关闭后JS heap | 8,071,364bytes | 8,122,882bytes | +0.64% |
| 首屏JS/CSS gzip | 246,271bytes | 255,490bytes | +3.74% |
| 完整Admin JS/CSS gzip | 682,983bytes | 697,855bytes | +2.18% |

以上指标均在方案10%调查线内。首屏资产在列表确认就绪、滚动和编辑之前记录；完整资产包含全部Admin路由静态JS/CSS。ready和编辑时延包含真实浏览器locator观察；关闭后heap可包含已加载模块和动画状态。JS heap与OS进程RSS使用不同口径。结论限定本机、记录的数据及桌面视口。

## 命令、资源与候选状态

入口先保存status和changed/base计划，Admin范围使用明确validation adapter，再经统一dev单构建槽执行：

```sh
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-models-ui/run.mjs candidate-build-final-v2 candidate-build.mjs --wait-slot
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-models-ui/run.mjs candidate-final-v3 final-ui-checks.mjs --wait-slot
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-models-ui/run.mjs perf-final-v4 performance.mjs --wait-slot
```

| 阶段 | runId | 用时 | 峰值进程树RSS | 卷级磁盘增量 |
| --- | --- | ---: | ---: | ---: |
| 构建 | c57f657d-0f8e-4423-9b0a-d4749666126b | 18.576s | 2,773,254,144bytes | +6,287,360bytes |
| 浏览器与生命周期 | 11ae4af8-3146-4b14-b02b-6c5581ef23b4 | 37.787s | 1,127,825,408bytes | +3,145,728bytes |
| 性能 | cc88d12b-ba76-4f95-bc81-ea2c155b9853 | 127.203s | 1,006,190,592bytes | −1,372,160bytes |

三阶段swap均0→0，源码指纹前后一致；卷级变化可能包含其他进程写入。控制器使用dev target `b27abc052fc82fd663abf2de544f62647354f97863b0f2e84f2f7411b472e557`，实际Next输出在任务工作树packages/admin/.next，webpack缓存复用供应商工作树。每次真实运行的隔离数据库和进程清理通过。Browser插件不可用，使用已有Playwright及Chromium。

本批保存为独立候选，依赖公共认证/导航和供应商批次的两项成本决定。产品master仍为认证契约提交`34e643f12d557a774a86c14bd9602bbef0b264b5`。成本决定完成后执行主仓集成验证、源码和运行资产回读，再回收产品任务工作树；当前保留候选及共享缓存。最终状态见证据目录candidate-acceptance-state.json。

## 回滚与未验证范围

回滚本批模型UI提交并重建恢复起点页面，父批与服务端契约维持各自版本。已发生的模型、路由、标签及会话写入以数据库实际状态为准；Git回滚不撤销业务记录。Docker、Windows/Linux/Intel macOS、Safari/Firefox、读屏/触屏/IME、移动性能、实际供应商执行、云OpenNext与生产部署分别验收。
