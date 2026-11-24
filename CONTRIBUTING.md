# Contributing

1. `cd dsh-reader && pnpm install`
2. 改动后必须保持以下命令全绿：

```bash
pnpm test
pnpm eval
pnpm build
```

3. 涉及 UI 的改动请补 `eval/visual.mjs` 的场景或断言；视觉基线用 `VISUAL_UPDATE=1 pnpm eval:visual` 更新（需要 DSH GUI 与 Chrome）。
4. 涉及数据结构的改动必须保持 v1→v2 迁移与 `.dsh-reader/backups/` 恢复可用。
5. 提交信息建议使用 Conventional Commits（`feat(reader): ...` / `fix(reader): ...`）。
6. 发布与市场索引维护是维护者流程，见 [docs/RELEASING.md](docs/RELEASING.md)；日常贡献不需要 npm 权限。

## 本地环境

- Node.js 22+
- DSH 桌面版（`pnpm eval:visual` / `pnpm release:check` 需要）
- Chrome（视觉门禁）
