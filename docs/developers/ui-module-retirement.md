# Octafuse 旧 UI 模块退役

本页保存该批候选阶段的实现、测量和验收档案。当前产品的 24 批公共 UI 已于 2026-10-10 本地合入 `master`（`90c8f942be5389ec3686011888dbfd2bda5e7248`）；成本决定、主仓复验与资源清理以[公共 UI 集成记录](public-ui-integration.md)及其证据收据为准。


本批基线为 `2fca60029dffaa1a3a229e02c4cbe6a850718d53`，移除五个已退出页面渲染链路的模块：

- `app/gateway/components/filter-nav.tsx`
- `app/gateway/routes/components/route-list-item.tsx`
- `app/gateway/routes/components/route-model-card.tsx`
- `app/gateway/routes/components/route-protocol-section.tsx`
- `app/gateway/routes/components/route-workspace-header.tsx`

Typescript AST 核查 526 个源码文件与 2455 条模块边，退役模块只有两条组内引用，外部消费者为零。Admin 是 private 应用包，未声明 package exports 或 main；五模块均不是 Next 页面/布局/API 入口。动态模块与配置入口已核查；语言模板导入固定在 `@/messages/${locale}.json`。共享结构备忘改为当前公共控件。

本批清理 550 行旧源码。当前路由页面继续使用 RouteFilterSidebar、RouteFlowOverview、RouteVendorGroup、RouteModal 与 RoutePolicyDialog，模型页继续使用 ModelFilterSidebar。业务组件、路由/定价/策略规则、持久化格式、HTTP/认证接口、四语言文案、依赖清单、锁文件和 vendor 制品均沿用基线。

## 产物与行为检查

生产 Next/standalone 构建、TypeScript、五项真实路由算法契约检查通过。真实隔离 PostgreSQL、Next 与 Chromium 153 验证七项流程，包括 LLM/图像/音频分类、路由优先级与权重保存、价格计划与自定义参数保持、策略保存、真实表不可用的 HTTP 500 展示及用户恢复。列表覆盖 1440、1024、820、390、320px，复核桌面列表、320px 列表与 390px 深色编辑器样张。浏览器 pageerror 为零；所属浏览器、服务及临时数据库均已清理。

Tailwind 扫描的全局 CSS 从 136090 降到 131010 bytes（减少 5080 bytes，-3.73%），移除 49 条规则，新增规则为零。当前 Admin TS/JS 源码中这些类名的字符串引用为零；编译 JS 中剩余的 `ease-out` 字符串属于图表库的缓动分派、校验和诊断。检查没有证明任意动态构造类名的行为。

19 个页面/布局 JS 产物的原始字节与哈希有差异。Webpack 模块表核对显示入口 wrapper 编号变化；Routes/Simulator 两个模块还出现压缩局部绑定重命名。比较使用真实作用域的声明和引用归一化，保留字面量、属性与操作顺序；其余共用模块字节保持。运行流程覆盖当前路由页，不能据此宣称所有页面和环境均已回归。

父候选冻结的 319 个运行文件逐一核对 SHA-256，均保持。依赖以 736 条链接复用，下载为零；共享 webpack 缓存继续使用，core JS 使用小份独立拷贝保护父运行。

## 验证入口与资源

资源入口为 `rtk node <证据目录>/run.mjs <阶段> <worker> --wait-slot`，执行前读取 status 与 changed plan，档位 dev，预算 4 GiB。生产检查实际命令是 `rtk npx --no-install next build --webpack`、`rtk npm run typecheck`、`rtk npx --no-install tsx --test app/gateway/routes/route-utils.test.ts`，core/standalone 通过既有 esbuild 和链接脚本生成。

| 阶段 | 资源报告 | 耗时 | 峰值采样 RSS | 卷空间净增量 |
| --- | --- | --- | --- | --- |
| build-v1 | eeac14c3-78cd-4d0a-ab62-f7e08cb18e3f | 24.037s | 3218915328 bytes | 44929024 bytes |
| validation-v1 | 6ae089ff-1bb1-4342-a1c0-4dac6e2bd25d | 3.845s | 678674432 bytes | 5922816 bytes |

两阶段 swap 均保持 262144 bytes，源码指纹前后一致。卷读数包含同机活动，峰值按控制器采样。共享缓存位于 `/Users/xiaosong/dev/xsec-labs/.worktree-cache/build-resources/targets/b27abc052fc82fd663abf2de544f62647354f97863b0f2e84f2f7411b472e557`。

## 失败与边界

初次模块核查对所有模板 import 做了过强断言，发现现有 locale 消息导入后，按其固定目录/后缀核验并显式执行第二版通过。首次资源 plan 使用非 baseline 阶段而源码尚无变更，得到 RESOURCE_EMPTY_SCOPE；改用只读 baseline 阶段通过。产物核对初次将三个完整缓动字面量误当作全部原始子串，图表库另有两个诊断字符串；五处上下文已读取，第二版按实际边界核对。原失败记录保留在证据目录。

产品主分支尚待祖先候选的独立成本决定，因此本批保留为已验收候选。Simulator 请求/响应与路由成本已分别接受；这些决定仅覆盖各自批次。集成后清理本任务隔离工作树及租约，继续保留受引用的父运行与共享缓存。

回滚方式为撤销本批提交并重建生产产物；业务数据与设置格式没有变化。真实供应商执行、其他数据库/浏览器/平台、读屏、系统中文输入法和部署没有在本批验证。

证据目录：`/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-ui-retirement`，关键记录为 retirement-audit.json、asset-comparison.json、module-comparison.json、artifact-verification.json、validation-v1-browser.json 及阶段资源报告。
