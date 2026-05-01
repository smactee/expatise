# RU Discrepancy Blockers Review

Generated at: 2026-05-01T12:56:00.028Z

## Summary

- Unique blocker items: 26
- High-risk items: 6
- Invalid answer-key items: 0
- Staged-only Right/Wrong create-new items: 20
- Missing-production qids: 2

## Blockers

| item | batch | action | qid | key | blocker | workbench link | next action |
|---|---|---|---|---|---|---|---|
| missing-production-qid:batch-08:44:q0176 | batch-08 | approve | q0176 | B | high-risk, missing-production-qid | [Fix](./ru-discrepancy-review-workbench.html#item-missing-production-qid-batch-08-44-q0176-1nxg7jg) | Rebuild/re-apply batch-08 staging from the current batch-08 workbench decisions, then rerun the RU discrepancy apply dry run. Do not manually patch translations.ru.json until a staging/full preview contains this qid. |
| missing-production-qid:batch-08:9:q0245 | batch-08 | approve | q0245 | Right | high-risk, missing-production-qid | [Fix](./ru-discrepancy-review-workbench.html#item-missing-production-qid-batch-08-9-q0245-08watea) | Rebuild/re-apply batch-08 staging from the current batch-08 workbench decisions, then rerun the RU discrepancy apply dry run. Do not manually patch translations.ru.json until a staging/full preview contains this qid. |
| unresolved:batch-001:14:Screenshot 2026-04-19 at 18.46.34.png | batch-001 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-unresolved-batch-001-14-screenshot-2026-04-19-at-18-46-34-png-12nsz37) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-03:1:screenshots/150.png | batch-03 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-03-1-screenshots-150-png-0t98dik) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| unresolved:batch-03:27:screenshots/Screenshot 2026-04-19 at 18.48.34.png | batch-03 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-unresolved-batch-03-27-screenshots-screenshot-2026-04-19-at-18-48-34-png-17c1s4l) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-05:50:screenshots/Screenshot 2026-04-19 at 18.50.01.png | batch-05 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-05-50-screenshots-screenshot-2026-04-19-at-18-50-01-png-1x24lwi) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-07:41:screenshots/350.png | batch-07 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-07-41-screenshots-350-png-02dndse) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-07:47:screenshots/Screenshot 2026-04-19 at 18.52.16.png | batch-07 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-07-47-screenshots-screenshot-2026-04-19-at-18-52-16-png-1slyzmm) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-08:33:screenshots/Screenshot 2026-04-19 at 18.53.08.png | batch-08 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-08-33-screenshots-screenshot-2026-04-19-at-18-53-08-png-0wxa480) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| unresolved:batch-09:45:screenshots/Screenshot 2026-04-19 at 18.53.34.png | batch-09 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-unresolved-batch-09-45-screenshots-screenshot-2026-04-19-at-18-53-34-png-1nhosvr) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-10:20:screenshots/Screenshot 2026-04-19 at 18.54.28 1.png | batch-10 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-10-20-screenshots-screenshot-2026-04-19-at-18-54-28-1-p-0t3l3lx) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-12:22:screenshots/Screenshot 2026-04-19 at 18.56.11.png | batch-12 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-12-22-screenshots-screenshot-2026-04-19-at-18-56-11-png-0jsftb0) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-12:31:screenshots/Screenshot 2026-04-19 at 18.56.21 1.png | batch-12 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-12-31-screenshots-screenshot-2026-04-19-at-18-56-21-1-p-15op2l4) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-12:35:screenshots/Screenshot 2026-04-19 at 18.56.24.png | batch-12 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-12-35-screenshots-screenshot-2026-04-19-at-18-56-24-png-08p4d5c) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-12:43:screenshots/Screenshot 2026-04-19 at 18.56.00.png | batch-12 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-12-43-screenshots-screenshot-2026-04-19-at-18-56-00-png-1gelcff) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-12:44:screenshots/Screenshot 2026-04-19 at 18.56.03.png | batch-12 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-12-44-screenshots-screenshot-2026-04-19-at-18-56-03-png-1p4el2f) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-12:47:screenshots/Screenshot 2026-04-19 at 18.56.15.png | batch-12 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-12-47-screenshots-screenshot-2026-04-19-at-18-56-15-png-0toqvqd) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-12:50:screenshots/Screenshot 2026-04-19 at 18.56.30.png | batch-12 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-12-50-screenshots-screenshot-2026-04-19-at-18-56-30-png-17uji60) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-13:45:screenshots/Screenshot 2026-04-19 at 18.56.51.png | batch-13 | new |  | Wrong | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-13-45-screenshots-screenshot-2026-04-19-at-18-56-51-png-13t932m) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| deleted:batch-14:19:screenshots/Screenshot 2026-04-19 at 18.57.40.png | batch-14 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-deleted-batch-14-19-screenshots-screenshot-2026-04-19-at-18-57-40-png-13fhk9j) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| create-new:batch-18:18:screenshots/Screenshot 2026-04-19 at 19.00.40.png | batch-18 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-18-18-screenshots-screenshot-2026-04-19-at-19-00-40-png-1filkdr) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| unresolved:batch-18:12:screenshots/Screenshot 2026-04-19 at 19.00.35.png | batch-18 | new |  | Right | staged-only-create-new-row | [Fix](./ru-discrepancy-review-workbench.html#item-unresolved-batch-18-12-screenshots-screenshot-2026-04-19-at-19-00-35-png-0b552tl) | Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly. |
| unresolved:batch-03:7:screenshots/Screenshot 2026-04-19 at 18.48.21.png | batch-03 | approve | q0801 | B | high-risk | [Fix](./ru-discrepancy-review-workbench.html#item-unresolved-batch-03-7-screenshots-screenshot-2026-04-19-at-18-48-21-png-0k2y2zx) | Review and consider approving q0801. |
| unresolved:batch-12:38:screenshots/Screenshot 2026-04-19 at 18.56.27 1.png | batch-12 | delete |  | UNKNOWN | high-risk | [Fix](./ru-discrepancy-review-workbench.html#item-unresolved-batch-12-38-screenshots-screenshot-2026-04-19-at-18-56-27-1-p-18m3akd) | Review and consider approving q0719. |
| deleted:batch-15:14:screenshots/Screenshot 2026-04-19 at 18.58.20.png | batch-15 | delete |  | UNKNOWN | high-risk | [Fix](./ru-discrepancy-review-workbench.html#item-deleted-batch-15-14-screenshots-screenshot-2026-04-19-at-18-58-20-png-1qxjtms) | Verify whether deletion was intentional; if not, approve q0592 or move to unresolved. |
| create-new:batch-17:1:screenshots/Screenshot 2026-04-19 at 18.59.49.png | batch-17 | new |  | A | high-risk | [Fix](./ru-discrepancy-review-workbench.html#item-create-new-batch-17-1-screenshots-screenshot-2026-04-19-at-18-59-49-png-1e4umai) | Compare source against q0981; if it matches, change the decision to approve that qid instead of creating a new question. |

## Missing Production QID Audit

### q0176

- Source: batch-08 / `screenshots/Screenshot 2026-04-19 at 18.53.17.png`
- Master qid exists: yes (mcq)
- Current production translation exists: no
- Current workbench approves qid: yes
- Review decisions contain qid: no
- Unresolved decisions contain qid: yes
- Any staging/archive preview contains qid: no
- Production merge report contains qid: no
- Conclusion: Current workbench approves this qid, but the derived staging route is stale/misclassified: apply-unresolved reported unresolved-source-item-not-found, no preview contains the qid, and the production merge report did not merge it.
- Recommended repair: Re-apply/rebuild batch-08 from the current workbench decisions so q0176 routes through review-needed decisions, not the stale unresolved path. Do not manually patch translations.ru.json unless a rebuilt full preview still cannot include it.
- Unresolved issue evidence: [{"itemId":"screenshots/Screenshot 2026-04-19 at 18.53.17.png","sourceImage":"screenshots/Screenshot 2026-04-19 at 18.53.17.png","reason":"unresolved-source-item-not-found"}]

### q0245

- Source: batch-08 / `screenshots/Screenshot 2026-04-19 at 18.52.47.png`
- Master qid exists: yes (row)
- Current production translation exists: no
- Current workbench approves qid: yes
- Review decisions contain qid: no
- Unresolved decisions contain qid: no
- Any staging/archive preview contains qid: no
- Production merge report contains qid: no
- Conclusion: Current workbench approves this qid, but derived review decisions/full preview/production merge outputs do not contain it. Batch-08 staging is stale or was not rebuilt from the current workbench decision.
- Recommended repair: Re-run batch-08 workbench apply/staging from current decisions, then rerun the discrepancy dry run. Manual production patch is not recommended because no preview currently contains q0245.

## Recommended Next Command

After manual edits in the discrepancy workbench, rerun:

```sh
npm run apply-ru-discrepancy-review-decisions
```

For q0245/q0176 specifically, after the discrepancy decisions are applied to batch-08 staging decisions, rebuild batch-08 staging before any production merge:

```sh
npm run apply-batch-workbench-decisions -- --lang ru --batch batch-08
```

