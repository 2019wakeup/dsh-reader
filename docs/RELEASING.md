# 发布与分发

维护者文档。用户安装方式见 [README](../README.md#安装)。

## 原则

- 发布只从 CI 进行：npm 凭据只存在 GitHub 仓库 secret，本机和仓库不保存长期 token。
- 发布前必须门禁全绿：`pnpm test` / `pnpm eval` / `pnpm release:check`。
- 每次发布都带 provenance：npm 包页面显示「由 GitHub Actions 构建并签名」，来源可验证。

## 一次性准备

1. npmjs.com → Access Tokens → **Granular Access Token**：
   - Permissions：Read and write (publish and stage)
   - Packages and scopes：只选 `@2019wakeup`
   - 勾选 **Bypass two-factor authentication (2FA)**
   - Expiration：30 天
2. 仓库 → Settings → Secrets and variables → Actions → New repository secret，名称 `NPM_TOKEN`，值为上一步的 token。
3. 发版完成后在 npm 后台 revoke 该 token；下次发版重新建。

## 发版

1. 改 `dsh-reader/package.json` 的 `version`，同步 README 里的测试计数，并跑：

   ```bash
   cd dsh-reader
   pnpm build && pnpm test && pnpm eval && pnpm release:check
   ```

2. 提交后打 tag 并推送：

   ```bash
   git tag v0.13.1 && git push origin v0.13.1
   ```

   也可以手动触发：Actions → **Release to npm** → Run workflow。

3. 工作流会安装依赖、构建、跑测试与 eval、校验 tag 与 `package.json` 版本一致，然后 `npm publish --access public --provenance`。
4. 确认发布结果：

   ```bash
   npm view @2019wakeup/dsh-reader version
   ```

## 发布后更新市场索引

```bash
cd dsh-reader
node scripts/build-market-index.mjs --out ../plugin-market.json   # npm 上已有该版本时自动切到 npm 源
node scripts/verify-market-index.mjs ../plugin-market.json         # 用 DSH 安装版自带校验器复验
```

提交并推送 `plugin-market.json`。用户索引地址：
`https://raw.githubusercontent.com/2019wakeup/dsh-reader/main/plugin-market.json`

索引要点：

- `format` 固定为 1，版本按 SemVer 降序；
- Git 源必须钉 40 位 commit，并写相对 `path`；
- icon 用绝对 URL 或 ≤32 KiB 的 `data:` URL；
- 分类、标签、排序键必须先在该索引的 `metadata` 里声明。

## 切换到 Trusted Publishing（推荐，发布过一次以后）

npm 包设置 → Trusted Publishing → 添加 GitHub Actions：

- Owner / Repository：`2019wakeup` / `dsh-reader`
- Workflow：`release.yml`

之后删除 `NPM_TOKEN` secret。npm CLI 在 `id-token: write` 的 Actions 里会通过 OIDC 发布，仓库不再保存任何长期凭据。

npm 已宣布从 2027 年 1 月起限制绕过 2FA token 的直接发布，新增自动化发布应尽快切到 Trusted Publishing 或 staged publishing。

## 撤销与回滚

- 发错版本且尚未有人安装：`npm unpublish @2019wakeup/dsh-reader@<version>`（24 小时内、且该版本是唯一/最新才允许）。
- 已有人安装：不要 unpublish，使用 `npm deprecate @2019wakeup/dsh-reader@<version> "<原因>"`，并发布修复版本。
- 市场索引回滚：把 `plugin-market.json` 的版本列表改回上一版并提交；索引的 Git 源可以直接指向旧 commit。
