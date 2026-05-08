# Decision Memory Report

Generated: 2026-05-05T08:29:49.338Z

## Summary

- Memory records created: 79
- Memory records updated: 149
- Memory records unchanged: 0
- Total memory records: 18102
- Image replacement records: 79

## Image Replacement Outcomes

| Outcome | Count |
| --- | --- |
| applied | 52 |
| approved | 2 |
| disregarded | 11 |
| failed | 2 |
| needsManualSearch | 2 |
| proposed | 10 |

## Image Replacement Operations

| Operation | Count |
| --- | --- |
| extract-enhance-from-approved-source | 49 |
| failed | 2 |
| manual-search | 1 |
| reuse-existing-qid-image | 5 |
| review | 5 |
| skip | 17 |

## Sources

- qbank-tools/generated/staging/image-replacement-decisions-2023-test1.json: 71 imported
- qbank-tools/generated/staging/image-replacement-second-pass-decisions.json: 15 imported
- qbank-tools/generated/staging/image-replacement-decisions.merged.json: 71 imported
- qbank-tools/generated/reports/image-replacement-apply-report.json: 71 imported

## Recommended Integration Points

- generate-image-replacement-workbench should downrank previously rejected candidates.
- generate-image-replacement-second-pass-workbench should boost previously approved similar candidates.
- duplicate detection should use referencedQid and reuse-existing-qid-image entries as reuse signals.
- future localization matching should use previous final decisions as high-confidence labels.
- objectTags and reviewer notes should become reusable search and ranking signals.

