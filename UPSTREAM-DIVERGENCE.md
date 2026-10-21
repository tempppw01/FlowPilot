# 上游差异对照表（UPSTREAM-DIVERGENCE）

> 本文件是 FlowPilot fork 与上游 `QLHazyCoder/FlowPilot` 之间的**同步基准**。
> 每次同步上游前，先拉取上游提交列表，再逐条对照本文三张表判定「要不要移植」，**不要直接 merge 上游 master**。

---

## 1. 文档目的与使用方法

### 为什么需要这份文档

本 fork 不是上游的镜像。它在 OpenAI 注册流程、Grok 链路、SMSBower 手机验证、侧边栏 UI 上有大量自主改造，且这些改造**刻意不与上游一致**。上游的每一次同步都会带来三类提交：

| 类别 | 含义 | 处理方式 |
|---|---|---|
| **A 已移植** | 上游的改动，fork 已有等价实现（可能是逐字搬运，也可能是按 fork 架构重写） | 已完成，**不重复移植**；同步时只需确认上游是否又改了同一处 |
| **B 已在 fork / 无需移植** | 上游改动的内容在 fork 中已经存在（逐字一致），或属于纯版本号、纯 merge 提交 | **不重复移植** |
| **C 刻意不移植** | 移植会破坏 fork 的核心功能 | **明确拒绝**，并记录拒绝理由 |

没有这份文档，每次同步都要重新逆向推导上游提交意图，重复劳动且容易误移植 C 类提交，直接导致 SMSBower 全链路、步骤 5 资料页、Grok 自研发布器等功能被冲掉。

### 每次同步上游的标准流程（SOP）

```bash
# 1. 获取上游最新提交
git fetch upstream --prune

# 2. 列出尚未处理的上游提交
git log --oneline --date=short --pretty=format:"%h|%ad|%s" upstream/master ^master

# 3. 逐条对照本文 表A / 表B / 表C 判定
#    - 命中表 A/B → 跳过，确认 fork 侧无遗漏即可
#    - 命中表 C   → 跳过，并在本文表 C 追加一行说明「上游又改了，但仍然不移植」
#    - 表中无记录 → 新提交，需人工判定后补进本文三张表之一

# 4. 移植时只搬运「意图」，不搬运原始 patch
#    上游 patch 面向上游的架构，直接 apply 会覆盖 fork 改造。
#    正确做法：读懂上游改了什么 → 在 fork 的对应文件里手写等价实现

# 5. 跑回归测试
node --test tests/*.test.js

# 6. 提交并推送，同时更新本文的基线信息表
git add -A && git commit -m "..." && git push origin master
```

### 三条硬性纪律

1. **禁止 `git merge upstream/master`** —— 会把 C 类改动和被上游重写的 fork 功能一起带进来。
2. **移植只搬意图，不搬 patch** —— 每个新提交都要落到 fork 自己的文件结构里。
3. **每完成一次同步，必须更新本文** —— 判定结论写回表 A/B/C，否则下次同步又要重新推导。

---

## 2. 基线信息

| 项目 | 值 |
|---|---|
| 仓库 | `https://github.com/tempppw01/FlowPilot.git`（fork，remote 名 `origin`） |
| 上游 | `https://github.com/QLHazyCoder/FlowPilot.git`（remote 名 `upstream`） |
| 当前 fork HEAD | `f2780f4` — `test(openai): 固化 fork 注册流程差异化行为` |
| 上游基线 HEAD | `2696510` — `chore(release): bump version to FlowPilot3.2` |
| 版本号 | `manifest.json` → `version: "3.2"` / `version_name: "FlowPilot3.2"` |
| 上游领先提交数 | 48（`git log upstream/master ^master`） |
| fork 领先上游提交数 | 94 |
| 测试基线 | `node --test tests/*.test.js` → **1498 tests / 1480 pass / 0 fail / 18 skipped** |
| 同步工作分支 | `codex/port-upstream-grok-and-oauth-fixes`（内容与 `master` 相同） |
| 回滚点分支 | `codex/before-upstream-3.2-integration`（`82d724a`，3.2 整合前的状态） |

> 本文档对应的同步批次：上游 `2696510`（FlowPilot3.2），同步完成于 2026-10-21。

---

## 3. 表 A —— 已移植（fork 已有对应实现，不要重复移植）

| 上游提交 | 日期 | 上游标题 | fork 对应提交 | 移植说明 |
|---|---|---|---|---|
| `94f05b6` | 07-09 | 接入 ChatGPT2API 来源和 Duck Token 直连生成 | `841bd3f` | 逐字移植 |
| `35f8ae9` | 07-10 | fix: stop auto-run on Duck daily limit | `93dcb26` | 逐字移植 |
| `bd09334` | 07-10 | chore: disable Plus and migrate retired payment settings | `89c3ead` | 逐字移植 |
| `487ac88` | 07-10 | refactor: remove retired GPC and Plus Auto channels | `cb36115` | 逐字移植 |
| `7a0c3e4` | 07-10 | docs: remove retired Plus channel guidance | `7066a5e` | 逐字移植 |
| `db228df` | 07-15 | feat: add Grok SUB2API import target | `93b945a` + `8c2428f` | 按 fork 侧边栏结构重写（设置面板独立） |
| `33707cf` | 07-21 | feat(grok): add grok2api and sub2api oauth targets | `80a4a98` / `a739d5d` / `93b945a` | 拆成设备授权流 + OAuth 目标两组实现 |
| `af1eb18` | 07-21 | fix(grok): wait longer for human verification | `9b403f6` | **参数被 fork 改过**：5min / 330s / 60s 日志，而非上游原值 |
| `1812432` | 07-22 | fix(openai): target signup modal continue button | `3308bf3` | 按 fork 的 modal 作用域实现 |
| `d50df38` | 07-30 | fix(grok): decouple registration skips from publishing | `eec382c` | 逐字移植 |
| `69c8e9d` | 08-13 | feat: 增加 SUB2API 连接测试和分组同步 | `8c2428f` | fork 已有 `testSub2ApiConnection` / `getGroupsByPlatform` |
| `eb1a807` | 08-16 | feat(sub2api): validate connectivity and synchronize account groups | `8c2428f` | 与 `69c8e9d` 同内容，重复提交 |
| `bf6049f` | 08-25 | docs: add IPWO sponsorship section | `8c3f941` | 逐字移植 |
| `cf9c8ac` | 08-25 | docs: box sponsorship ads in README | `8c3f941` | 同上 |
| `517dbd0` | 09-09 | fix(openai): stabilize signup registration flow | `eb529a1`（主体）+ **刻意保留入口页探测链** | 见 表 C 分行说明 |
| `56ffca6` | 09-09 | fix: correct signup entry state priority | `00836eb`（核心顺序）+ `f2780f4`（分歧钉住） | 核心顺序已移植；被上游删掉的部分刻意保留，见 表 C |
| `5ba614d` | 09-09 | fix(ui): adjust luckmail and icloud item layout | `b8f325d` | 逐字移植（`sidepanel/sidepanel.css`） |
| `816e19c` | 09-09 | feat(phone): remove max limit for phone number replacement count | `306ab62` | 逐字移植 |
| `729ac79` | 09-09 | feat(ui): add collapse/expand toggle for email pool list | `3c96a47` | 逐字移植 |

---

## 4. 表 B —— 已在 fork / 无需移植

| 上游提交 | 日期 | 上游标题 | 判定依据 |
|---|---|---|---|
| `204cccd` | 07-21 | fix(grok): wait for oauth authorization page readiness | 仅改 `flows/grok/background/sub2api-oauth-runner.js` 与 `flows/grok/content/sub2api-oauth-page.js`，**fork 与上游逐字一致**（`git diff --stat` 为空） |
| `872a4c1` | 07-22 | fix(grok): prioritize oauth consent and add diagnostics | 同上两个文件逐字一致；`flows/grok/index.js` 中的 `accounts.x.ai` hostnames fork 已包含 |
| `4880e11` | 07-30 | fix(grok): validate sub2api oauth consent flow | 同上两个文件逐字一致 |
| `f5e4311` | 07-22 | chore(release): bump version to FlowPilot2.9 | 版本号提交：fork 直接推进到 3.2（`315a743`） |
| `73acdf8` | 07-25 | chore(release): bump version to FlowPilot3.0 | 同上 |
| `046a63b` | 08-16 | chore(release): bump version to FlowPilot3.1 | 同上 |
| `2696510` | 10-09 | chore(release): bump version to FlowPilot3.2 | 同上，fork 已是 3.2 |
| `5761bae` | 07-22 | merge: sync remote master before FlowPilot2.9 release | merge 提交，无独立代码语义 |
| `6c1e5fd` | 07-23 | merge: 同步本地 master 的 Grok 修复 | merge 提交，内容已在表 B/A 覆盖 |
| `7b83926` | 08-16 | Merge branch 'dev' ... | merge 提交，无独立代码语义 |
| `d395111` | 08-16 | merge(release): include current dev in FlowPilot3.1 | merge 提交，无独立代码语义 |

---

## 5. 表 C —— 刻意不移植（会破坏 fork 功能）

| 上游提交 | 日期 | 上游标题 | 不移植原因 | 影响面 / 判定依据 |
|---|---|---|---|---|
| `5c53ccc` | 07-22 | docs: 设计 OpenAI 账号交付架构升级 | 纯设计文档，描述上游自有交付链路 | `docs/superpowers/` 文档，无运行时代码 |
| `aeba2dc` | 07-22 | docs: 设计 OpenAI 账号交付架构升级 | 同上（内容重复） | 同上 |
| `be7906c` | 07-22 | docs: 补充 OpenAI 账号交付实施计划 | 纯文档 | 同上 |
| `a0af6f2` | 07-23 | docs: 完成 OpenAI 账号交付验收 | 纯文档 | 同上 |
| `64893a5` | 07-23 | docs: 记录 SUB2API 双交付设计 | 纯文档 | 同上 |
| `236ad9e` | 07-23 | docs: 规划 OpenAI SUB2API 双交付实现 | 纯文档 | 同上 |
| `feaf6ad` | 07-22 | feat: 建立 OpenAI 账号交付能力模型 | 3.0 账号投放架构，fork 走自有交付链路 | 新增 `flows/openai/account-delivery.js`、改 `flow-capabilities.js` / `sidepanel` |
| `ec3065a` | 07-22 | refactor: 统一 OpenAI 会话读取协议 | 同属交付架构重构 | 重写 `session-reader.js` 与两个 session-import 步骤 |
| `35df8c9` | 07-22 | feat: 实现 SUB2API Agent Identity 交付 | fork 无 `agent-identity` 概念，也无该文件 | 新增 `flows/openai/background/agent-identity.js` |
| `85dc21e` | 07-23 | refactor: 切换 OpenAI 账号交付组合工作流 | 交付架构，会重写 fork 的 workflow | 大幅改动 `flows/openai/workflow.js`（净删约 2387 行量级） |
| `02f8e22` | 07-23 | feat: 开放按目标配置的账号交付方式 | 交付架构 + 侧边栏大改 | 新增 `sidepanel/account-delivery-control.js`，`sidepanel.js` 改动 833 行 |
| `c883e78` | 07-23 | docs: 更新 OpenAI 账号交付链路说明 | 文档 + README，但描述的是上游交付链路 | fork 无对应交付概念，文档会误导 |
| `ddd16ff` | 07-23 | fix: 统一 SUB2API 账号导入并发为 1 | 属于 Agent Identity 交付链的前置条件，fork 无该链 | 改 `background/sub2api-api.js` |
| `768d424` | 07-23 | fix: 重试 SUB2API Agent 导入临时错误 | 同上，改的是 fork 不存在的 `sub2api-agent-identity-import.js` | 该文件 fork 不存在 |
| `c2cf40f` | 08-16 | fix(phone): release activations with latest runtime state | 上游手机验证链路；fork 已有 SMSBower 专属链路，语义不同 | 改 `background/phone-verification-flow.js`，与 fork 的 SMSBower 状态机冲突 |
| `94901cc` | 08-16 | fix(phone): recover auth page and release current SMS activation safely | 同上（内容重复） | 同上 |
| `56fa837` | 09-09 | refactor(email-pool): unify customMailProviderPool and customEmailPool into single pool | 会合并掉 fork 的**双结构**邮箱池（fork 目前 `customMailProviderPool` 与 `customEmailPool` 并存，各有独立 UI 与持久化） | 改 `background.js` / `auto-run-controller.js` / `sidepanel` |
| `465b2ba` | 10-09 | 重构邮箱注册接码与 OAuth 恢复流程 | 与 fork 的手机验证改造直接冲突，会覆盖 SMSBower 链路 | 同时改 `background.js`、`auto-run-controller.js`、`phone-verification-flow.js`、`flow-capabilities.js` 等 15+ 文件 |
| `56ffca6`（部分） | 09-09 | fix: correct signup entry state priority | 上游删除了 `profile_page` 状态，fork 依赖它实现**步骤 5 资料页**与**注册成功等待页** | 只移植核心顺序（`00836eb`），删除部分不移植 |
| `517dbd0`（部分） | 09-09 | fix(openai): stabilize signup registration flow | 上游删除了 `ensureSignupEntryPageReady` 链（6 处），fork 靠入口页探测实现 SMSBower 免清 cookie、已登录态重试 | 只移植注册成功等待页识别与传输异常重试（`eb529a1`），删除链不移植 |

---

## 6. Fork 差异化能力清单（不可被上游覆盖）

以下能力**只存在于 fork**，上游没有或上游试图删除。任何同步动作都必须确保它们存活。

### 6.1 OpenAI 注册流程差异化

| 能力 | 位置 | 说明 |
|---|---|---|
| 步骤 5 资料页（`profile_page`） | `background/signup-flow-helpers.js`、`flows/openai/content/openai-auth.js` | 上游已删除该状态；fork 保留，并接到 `flows/openai/background/steps/fill-profile.js` |
| 注册成功等待页（`registration_success_page`） | `flows/openai/content/openai-auth.js`、`background/message-router.js` | 阶段 7 移植自上游 3.2，但 fork 的落地点（`profile_page`）依赖自身实现 |
| 已登录态（`logged_in_home`） | `flows/openai/content/openai-auth.js` | 上游没有此状态 |
| `google_login_page` | `background/signup-flow-helpers.js` | 上游完全没有的状态识别（Google 登录入口页） |
| 步骤 3 跳过密码页白名单 | `flows/openai/content/openai-auth.js` | fork 白名单额外含 `profile_page` / `logged_in_home` / `registration_success_page` |
| 步骤 1 入口页探测（`ENSURE_SIGNUP_ENTRY_READY`） | `background/signup-flow-helpers.js` | 上游 `517dbd0` 删掉了 `ensureSignupEntryPageReady` 链，fork 保留 |

### 6.2 SMSBower 手机验证全链路

fork 有数十个提交专门改造 SMSBower，上游没有对应实现。移植上游任何 `background/phone-verification-flow.js` 的改动前，**必须**先跑 SMSBower 相关测试：

- 国家模式（固定国家 / 随机国家）、低优先级国家排序、价格信息展示
- 线路权重选择（按历史成功率加权）、失败后轮换线路、线路超时重试
- **免清 cookie**（依赖步骤 1 入口页探测）
- 失败统计：所有换号原因都记失败，不只是超时
- SMSBower 邮件注册链路（与 IMAP 验证联动）

### 6.3 Grok 自研链路

`git diff --stat upstream/master master -- flows/grok/` 显示 fork 侧 7 个文件与上游有实质差异：

| 文件 | 差异量 | 约束 |
|---|---|---|
| `flows/grok/background/publisher-grok2api.js` | 净 ±700 行量级 | **绝对不要碰**。fork 自己重写的版本，逻辑与上游不同 |
| `flows/grok/background/register-runner.js` | 净 ±349 行量级 | 相对上游大幅分化 |
| `flows/grok/content/register-page.js` | 净 ±362 行量级 | 相对上游大幅分化 |
| `flows/grok/background/state.js` | 净 ±75 行量级 | 相对上游大幅分化 |
| `flows/grok/workflow.js` | 净 ±342 行量级 | 相对上游大幅分化 |
| `flows/grok/index.js` | 净 ±38 行量级 | 有分化，注意不要整file覆盖 |
| `flows/grok/background/publisher-webchat2api.js` | 净删 3 行 | fork 侧有删减 |
| `flows/grok/background/sub2api-oauth-runner.js` | 0 | **可以覆盖**：当前与上游逐字一致 |
| `flows/grok/content/sub2api-oauth-page.js` | 0 | **可以覆盖**：当前与上游逐字一致 |

> 最后两个文件是当前唯一可安全用上游 patch 覆盖的 Grok 文件。若将来 fork 在这两个文件上产生新改动，须同步更新本表。

### 6.4 侧边栏（sidepanel）约束

| 约束 | 说明 |
|---|---|
| 不得出现 `btn-contribution-mode` / `贡献` 模式按钮 | fork 已删除 contribution-mode 机制；`contribution-mode.js`、`contribution-content-update-service.js` 在 fork 中**不存在**，不要从上游拉回 |
| 不得出现 `auto-run-ad-bar`、贡献模式更新浮层 | 同上；上游 `sidepanel-contribution-mode.js` 及其 644 行测试在 fork 中已删除 |
| 必须保留 `usage-cost-bar` | fork 的使用成本条（`sidepanel/sidepanel.html` 第 66 行 / `sidepanel/sidepanel.css` 第 719 行） |
| `renderPortalUpdateHint()` 5 个调用点必须写成条件调用 | `sidepanel/sidepanel.js` 第 13795 / 14809 / 16926 / 21653 / 22496 行，统一写法：`if (typeof renderPortalUpdateHint === 'function') renderPortalUpdateHint();` |
| fork 自有「使用教程」门户按钮 | `sidepanel/sidepanel.html` 第 37 行的 `btn-portal-tutorial`；事件绑定在 `sidepanel.js` 第 17707 行，提示文案在第 14907 行。它是 fork 的自有实现，**不是**上游 contribution-mode 的复刻，不要混淆也不要删除 |
| 注意 fork 用的是 `sidepanel/portal-content-update-service.js` | 这是 fork 自有文件，**不要**因为名字相近而拉入上游的 `contribution-content-update-service.js` |

### 6.5 版本号

`manifest.json` 第 4–5 行必须保持 `"version": "3.2"` / `"version_name": "FlowPilot3.2"`，与上游基线一致。上游后续发版时，在同步该批次的同时更新。

---

## 7. 回归测试索引

移植或拒绝任何提交后，**必须**确认下表对应的测试仍然通过。测试全绿是「fork 差异化能力未被破坏」的最低保证。

| 测试文件 | 钉住的差异 | 保护的能力 |
|---|---|---|
| `tests/signup-fork-divergence.test.js` | fork 专有，4 个用例 | `profile_page` 落地页识别、`profile_page` 入口状态、步骤 3 遇到 `registration_success_page` / `logged_in_home` 时跳过密码页 |
| `tests/signup-entry-state-priority.test.js` | 与上游**逐字一致**（fork `00836eb` 自带） | 入口状态判定优先级，上游改动此逻辑时会直接冲突暴露 |
| `tests/background-signup-step2-branching.test.js` | fork 版（含 google_login_page、入口页 settling 用例） | 步骤 2 分支走向 |
| `tests/retired-plus-channels.test.js` | 钉住 Plus / GPC 渠道下线 | 已下线的渠道不得复活 |
| `tests/signup-continue-button-scope.test.js` | 钉住 modal 作用域的继续按钮 | 上游 `1812432` 的 fork 实现不被冲掉 |
| `tests/smsbower-provider.test.js`、`tests/smsbower-mail-provider.test.js`、`tests/smsbower-mail-utils.test.js` | fork 专有 | SMSBower 线路 / 邮件 / 工具链 |
| `tests/step7-smsbower-restart.test.js`、`tests/step7-phone-login-entry.test.js`、`tests/step8-restart-step7-error.test.js` | fork 专有 | SMSBower 重启与步骤 7/8 恢复 |
| `tests/step5-direct-complete.test.js`、`tests/step5-age-consent.test.js` | fork 专有 | 步骤 5 资料页与年龄同意 |
| `tests/sidepanel-imap-smsbower-settings.test.js`、`tests/sidepanel-smsbower-mail-settings.test.js` | fork 专有 | 侧边栏 SMSBower 设置 |
| `tests/sidepanel-contribution-button.test.js` | fork 专有 | 钉住 contribution-mode 入口已移除、`usage-cost-bar` 存在；上游把 contribution 模式改回来时该测试会直接失败 |

---

## 8. 风险与注意事项

1. **`flows/grok/background/publisher-grok2api.js` 是禁区。** 它是 fork 重写的 Grok 发布器，覆盖后 Grok 账号发布会走上游逻辑，直接坏掉。
2. **不要把上游 `sidepanel/contribution-mode.js` 拉回来。** 它依赖 fork 不存在的 `contribution-content-update-service.js`，且会复活上游的贡献模式 UI。
3. **`renderPortalUpdateHint` 是可选函数。** 侧边栏 5 个调用点必须带 `typeof` 判断，否则在裁剪过该函数的构建里会抛 `ReferenceError`。
4. **上游删除 `profile_page` / `ensureSignupEntryPageReady` 是有意的**，不是 bug。上游认为这些状态冗余，fork 认为它们是 SMSBower 与步骤 5 的前提。这条分歧必须长期保留，不要在上游反复提交同类改动时动摇。
5. **移植 `background/phone-verification-flow.js` 之前先跑 SMSBower 测试。** 上游该文件的改动是针对上游自有手机验证实现的，直接搬运会破坏 fork 的免清 cookie 与状态机。
6. **上游的 `56fa837`（邮箱池合一）会一次性改掉 2600+ 行文档与核心邮箱池逻辑**，属于高风险提交。如果将来 fork 也决定合一邮箱池，需要单独立项重做，不能直接套 patch。
7. **同步完成 ≠ 提交完成。** 必须同时更新本文的表 A/B/C 与基线信息表，否则文档会在下一次同步时失效。

---

## 9. 附录：上游 48 个提交完整对照表

按上游提交时间正序。`—` 表示该提交属于表 B 或 C，无需 fork 侧对应提交。

| # | 上游提交 | 日期 | 标题 | 分类 | fork 对应 |
|---|---|---|---|---|---|
| 1 | `94f05b6` | 07-09 | 接入 ChatGPT2API 来源和 Duck Token 直连生成 | A | `841bd3f` |
| 2 | `35f8ae9` | 07-10 | fix: stop auto-run on Duck daily limit | A | `93dcb26` |
| 3 | `bd09334` | 07-10 | chore: disable Plus and migrate retired payment settings | A | `89c3ead` |
| 4 | `487ac88` | 07-10 | refactor: remove retired GPC and Plus Auto channels | A | `cb36115` |
| 5 | `7a0c3e4` | 07-10 | docs: remove retired Plus channel guidance | A | `7066a5e` |
| 6 | `db228df` | 07-15 | feat: add Grok SUB2API import target | A | `93b945a` + `8c2428f` |
| 7 | `33707cf` | 07-21 | feat(grok): add grok2api and sub2api oauth targets | A | `80a4a98` / `a739d5d` / `93b945a` |
| 8 | `af1eb18` | 07-21 | fix(grok): wait longer for human verification | A | `9b403f6`（fork 改了等待参数） |
| 9 | `204cccd` | 07-21 | fix(grok): wait for oauth authorization page readiness | B | — |
| 10 | `1812432` | 07-22 | fix(openai): target signup modal continue button | A | `3308bf3` |
| 11 | `5c53ccc` | 07-22 | docs: 设计 OpenAI 账号交付架构升级 | C | — |
| 12 | `872a4c1` | 07-22 | fix(grok): prioritize oauth consent and add diagnostics | B | — |
| 13 | `5761bae` | 07-22 | merge: sync remote master before FlowPilot2.9 release | B | — |
| 14 | `f5e4311` | 07-22 | chore(release): bump version to FlowPilot2.9 | B | — |
| 15 | `aeba2dc` | 07-22 | docs: 设计 OpenAI 账号交付架构升级 | C | — |
| 16 | `feaf6ad` | 07-22 | feat: 建立 OpenAI 账号交付能力模型 | C | — |
| 17 | `be7906c` | 07-22 | docs: 补充 OpenAI 账号交付实施计划 | C | — |
| 18 | `ec3065a` | 07-22 | refactor: 统一 OpenAI 会话读取协议 | C | — |
| 19 | `35df8c9` | 07-22 | feat: 实现 SUB2API Agent Identity 交付 | C | — |
| 20 | `85dc21e` | 07-23 | refactor: 切换 OpenAI 账号交付组合工作流 | C | — |
| 21 | `02f8e22` | 07-23 | feat: 开放按目标配置的账号交付方式 | C | — |
| 22 | `c883e78` | 07-23 | docs: 更新 OpenAI 账号交付链路说明 | C | — |
| 23 | `6c1e5fd` | 07-23 | merge: 同步本地 master 的 Grok 修复 | B | — |
| 24 | `64893a5` | 07-23 | docs: 记录 SUB2API 双交付设计 | C | — |
| 25 | `a0af6f2` | 07-23 | docs: 完成 OpenAI 账号交付验收 | C | — |
| 26 | `236ad9e` | 07-23 | docs: 规划 OpenAI SUB2API 双交付实现 | C | — |
| 27 | `ddd16ff` | 07-23 | fix: 统一 SUB2API 账号导入并发为 1 | C | — |
| 28 | `768d424` | 07-23 | fix: 重试 SUB2API Agent 导入临时错误 | C | — |
| 29 | `73acdf8` | 07-25 | chore(release): bump version to FlowPilot3.0 | B | — |
| 30 | `d50df38` | 07-30 | fix(grok): decouple registration skips from publishing | A | `eec382c` |
| 31 | `4880e11` | 07-30 | fix(grok): validate sub2api oauth consent flow | B | — |
| 32 | `69c8e9d` | 08-13 | feat: 增加 SUB2API 连接测试和分组同步 | A | `8c2428f` |
| 33 | `c2cf40f` | 08-16 | fix(phone): release activations with latest runtime state | C | — |
| 34 | `94901cc` | 08-16 | fix(phone): recover auth page and release current SMS activation safely | C | — |
| 35 | `eb1a807` | 08-16 | feat(sub2api): validate connectivity and synchronize account groups | A | `8c2428f` |
| 36 | `7b83926` | 08-16 | Merge branch 'dev' of ... into dev | B | — |
| 37 | `046a63b` | 08-16 | chore(release): bump version to FlowPilot3.1 | B | — |
| 38 | `d395111` | 08-16 | merge(release): include current dev in FlowPilot3.1 | B | — |
| 39 | `bf6049f` | 08-25 | docs: add IPWO sponsorship section | A | `8c3f941` |
| 40 | `cf9c8ac` | 08-25 | docs: box sponsorship ads in README | A | `8c3f941` |
| 41 | `517dbd0` | 09-09 | fix(openai): stabilize signup registration flow | A（部分） | `eb529a1`；删除链见 表 C |
| 42 | `56ffca6` | 09-09 | fix: correct signup entry state priority | A（部分） | `00836eb` + `f2780f4`；`profile_page` 删除见 表 C |
| 43 | `5ba614d` | 09-09 | fix(ui): adjust luckmail and icloud item layout | A | `b8f325d` |
| 44 | `816e19c` | 09-09 | feat(phone): remove max limit for phone number replacement count | A | `306ab62` |
| 45 | `729ac79` | 09-09 | feat(ui): add collapse/expand toggle for email pool list | A | `3c96a47` |
| 46 | `56fa837` | 09-09 | refactor(email-pool): unify customMailProviderPool and customEmailPool | C | — |
| 47 | `465b2ba` | 10-09 | 重构邮箱注册接码与 OAuth 恢复流程 | C | — |
| 48 | `2696510` | 10-09 | chore(release): bump version to FlowPilot3.2 | B | — |

**统计**：A 类 19（其中 `517dbd0`、`56ffca6` 为部分移植）、B 类 11、C 类 18，合计 48，与 `git log upstream/master ^master` 的提交总数一致。

> 说明：表 C 中的 `56ffca6（部分）` 与 `517dbd0（部分）` 两行描述的是这两个上游提交中**被刻意拒绝的片段**，它们在附录里仍归入 A 类（因为主体已移植），所以不重复计入 48 的总数。

---

## 10. 变更记录

| 日期 | 同步批次 | 结果 | 说明 |
|---|---|---|---|
| 2026-10-21 | 上游 `2696510`（FlowPilot3.2） | 全部 48 个提交完成分类 | 19 条已移植（含 2 条部分移植）、11 条已在 fork、18 条刻意不移植；新增本对照文档 |

