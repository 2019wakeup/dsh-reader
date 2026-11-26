# Translation judge rubric v1

Score each candidate 1–5 on four dimensions:

| Dimension | 5 | 4 | 3 | 2 | 1 |
| --- | --- | --- | --- | --- | --- |
| adequacy | meaning complete, no addition/omission | minor nuance loss | understandable but noticeable loss | key meaning lost | wrong/irrelevant |
| fluency | native | minor awkwardness | understandable | hard to read | unreadable |
| terminology | all glossary terms exact and consistent | one minor issue | several but usable | many errors | unusable |
| structure | numbers/code/URLs/placeholders all intact | — | — | — | any break |

Pass = adequacy ≥4, fluency ≥3, terminology ≥4, structure = pass.

The judge returns strict JSON only. It sees source, reference, candidate and glossary; references are used for adequacy only.
