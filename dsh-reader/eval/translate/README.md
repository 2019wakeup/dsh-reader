# Translation eval (L1)

Offline contract eval for the reader translation pipeline. It does not call a model.

```bash
node eval/translate.mjs --offline
```

- `corpus/v1/segments.jsonl`: 60 quality segments (en/zh/ja/fr/auto → zh)
- `corpus/v1/references.jsonl`: reference translations; never sent to the model
- `corpus/v1/documents.json`: 12 document descriptors for the later live/visual suite
- `contract.mjs`: 40 deterministic contract cases (prompt, parse, cache, glossary, units, render, failure)
- `last-report.json`: generated report

L2 live eval and the judge land in #18.

## Live (L2)

Requires a DSH instance with a model and `DSH_READER_EVAL=1`:

```bash
DSH_READER_EVAL=1 DSH_SESSION_ID=... node eval/translate.mjs --live --split=holdout --gate
```

It writes `live-report.json` / `.md` and does not fake a pass when the judge
route or model is unavailable. `baseline.json` is updated only after human
review.
