# Octafuse 路由管理公共 UI

模型路由列表、顶栏筛选、新建/编辑、复制草稿、启停、删除确认、路由池和模型策略、倍率与每日时段采用tokens0.1.2/UI React0.1.5。PageHeader、ControlButton、RadioGroup、Select、Dialog、Field、Input、Textarea、Badge、Spinner和状态反馈统一主题、焦点及减少动效。专业协议图标、模型价格展示和计费serializer继续承担业务职责。en/zh/ja/ko各新增12个反馈键，起点每种语言1464个值保持。

## 行为与数据契约

真实起点读取失败会显示空态，暗色编辑窗口仍使用白色背景，Priority/Weight标签未关联。现在routes/models/providers/config为一次原子页面读取，共用覆盖完整JSON body的20秒预算；任一失败取消同次其他读取，页面显示明确错误并禁用写入。真实成功的零条结果才显示空态。响应校验路由及关联实体、协议/操作、priority/weight、策略、surfaces、JSON参数、倍率、币种和时段。策略与时段使用core公开校验规则；真实PostgreSQL中的零时长、24:00起点及非法策略键在修复前被候选接受、修复后明确失败。

URL是kind/vendor/provider_id/route_group/status的筛选权威，保留无关参数，支持reload和Back/Forward。读取替换及离页取消所属请求。写入使用共享useShellRequest和同步busy所有者，同帧重复动作只发送一次；失败保留编辑窗口，部分已提交写入提示主动核对。401通知根会话失效。Clipboard使用真实平台API，反馈计时器在替换和卸载时清理。

保留OpenAI/Anthropic/Gemini、Image/Audio协议限制、优先级/权重、两个倍率、两个时段、custom_params和实际路由surface。当前上游能力支持chat/images/audio及既有Anthropic/Gemini操作；此批沿用服务端能力清单。复制创建inactive路由并保留原目标，删除取消恢复焦点，确认只删除目标。路由池策略实际PATCH并回读；历史模型策略支持协议及capability覆盖，保留另一协议规则。历史provider_factor仍用于缺少metered_factor时的既有计费含义。Models共享编辑成功后刷新Routes。

拓扑按卡片容器宽度组织：920px以上横向，窄容器纵向。320px标题栏操作允许换行；长路由组在窄屏完整换行，宽屏收在带完整名称提示的徽标中。弹窗可滚动、底部操作可见，busy期间保持编辑窗口。公共语义tokens负责明暗背景和文字，计费/策略状态颜色保留领域含义。

## 真实验收与性能

证据目录：`/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-routes-ui`。Browser插件不可用，复用现有Playwright与Chromium153。真实隔离PostgreSQL、Next生产运行和loopback转发代理验证，供应商endpoint为本机port9，流程未执行供应商请求。

最终ESLint、Next webpack生产构建、standalone检查和类型检查通过。基本7项、扩展16项、生命周期5项、数据契约3项、四语言/历史兼容3项，共34项脚本检查通过，pageerror为0。覆盖实际CRUD/SQL、URL、Clipboard、协议及计费、嵌套删除焦点、策略保存、共享模型编辑、真实500/404/401、body超时、已提交POST部分响应、socket关闭和离页取消。1440/1024/820/390/320px与两种主题的10组列表/编辑检查、四语言×明暗的8组320px策略窗口、长名称320/1440px检查通过。控制台的500/404/401属于对应真实故障流程；各轮数据库和进程清理通过。

初轮64样本的冷编辑+19.49%、dialog heap+12.76%、输入+29.34%、关闭heap+10.82%触发调查。真实V8精确调用计数表明40张卡片/6字符输入触发240次无关render，筛选栏触发6次。稳定模型编辑callback，并按真实稳定props复用RouteVendorGroup与RouteFilterSidebar后，两项调用计数均为0；主题、语言、URL、状态及数据变化继续触发对应更新。第二轮保留冷打开+10.68%的调查结果，最终结果如下。

相同40条单档LLM/40路由、实际会话和Asia/Shanghai、1440×600、Chromium153新上下文、禁用缓存/GC、16组ABBA/BAAB，共64正式样本与4预热。起点为模型候选`b69b35cb10f882f9a083ff124128255acffc79bc`，认证/导航与供应商自身成本分别记录。

| 指标 | 起点 | 候选 | 变化 | 结果 |
| --- | ---: | ---: | ---: | --- |
| 列表就绪 | 131.20ms | 132.90ms | +1.30% | PASS |
| 列表GC后JS heap | 7832700bytes | 8151992bytes | +4.08% | PASS |
| 滚动帧间隔P95 | 16.70ms | 16.70ms | +0.00% | PASS |
| 冷打开编辑 | 72.55ms | 78.70ms | +8.48% | PASS |
| 编辑弹窗JS heap | 9454006bytes | 9275378bytes | -1.89% | PASS |
| 输入耗时 | 28.05ms | 20.60ms | -26.56% | PASS |
| 关闭后JS heap | 9635722bytes | 9220344bytes | -4.31% | PASS |
| 首屏JS/CSS gzip | 276663bytes | 278341bytes | +0.61% | PASS |
| 完整Admin JS/CSS gzip | 697855bytes | 699015bytes | +0.17% | PASS |

本批比较指标均在方案10%调查线内。首屏在确认40路由就绪、滚动及编辑前记录，完整资产包含全部Admin路由静态JS/CSS。ready和编辑时间包含真实locator观察；关闭后heap可包含已加载模块及动画状态。JS heap与OS进程RSS分别记录，结论限定本机桌面和当前输入。

## 命令、资源与候选状态

入口保存status及changed/base计划，Admin通过明确validation adapter进入统一dev单构建槽：

```sh
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-routes-ui/run.mjs candidate-build-v7 candidate-build.mjs --wait-slot
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-routes-ui/run.mjs candidate-final-v3 final-ui-checks.mjs --wait-slot
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-routes-ui/run.mjs perf-v3 performance.mjs --wait-slot
```

| 阶段 | runId | 用时 | 峰值进程树RSS | 卷级磁盘增量 | swap |
| --- | --- | ---: | ---: | ---: | ---: |
| candidate-build-v7 | 5a61f739-5833-4e55-a229-ae133b0131c1 | 17.608s | 2949709824bytes | +1818624bytes | 0→0bytes |
| candidate-final-v3 | 4b959847-c5cc-4b40-9ed7-26fcc16f039a | 60.746s | 1013596160bytes | +6447104bytes | 0→0bytes |
| perf-v3 | 90dbe255-bdf6-404e-bbaa-83039d535e82 | 128.441s | 1044660224bytes | +5943296bytes | 0→0bytes |

各阶段源码指纹前后一致；卷级变化可包含其他本机进程写入。新增依赖0，manifest、锁文件及vendor六项字节保持，737个浅层依赖链接和共享webpack/core缓存复用，下载0。257个起点运行文件SHA256与长度回读一致；最终验收冻结11项脚本依赖并逐项回读。dev共享target为b27abc052fc82fd663abf2de544f62647354f97863b0f2e84f2f7411b472e557，实际Next运行资产在任务工作树packages/admin/.next。

本批保存为可审查候选，产品master仍为会话契约提交34e643f12d557a774a86c14bd9602bbef0b264b5。认证/导航和供应商两项独立成本决定完成后执行产品主仓集成、验收与源码/运行资产回读，再回收产品工作树。最终候选、覆盖台账及清理状态见证据目录candidate-acceptance-state.json。

## 回滚与未验证范围

回滚本批路由UI提交并重建恢复起点页面，父批与服务端契约保持各自版本。代码回滚不撤销实际路由、模型、策略和会话记录，业务数据按数据库状态处理。Docker、Windows/Linux/Intel macOS、Safari/Firefox、读屏/触屏/IME/缩放、移动性能、真实供应商执行、云OpenNext及生产部署分别验收。其他Octafuse业务页与全工作区覆盖继续迁移。
