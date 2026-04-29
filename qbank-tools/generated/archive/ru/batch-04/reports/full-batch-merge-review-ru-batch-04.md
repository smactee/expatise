# Full-Batch Dry-Run Merge Review: ru batch-04

- Dataset: `2023-test1`
- Auto-matched items: 4
- Reviewed items: 0
- Equivalent overlaps: 0
- Final total: 4
- Ready for merge: 3
- Blockers: 1
- Safe to merge next step: no
- Full preview: `qbank-tools/generated/staging/translations.ru.batch-04.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ru.batch-04.full.merge-dry-run.json`

## Blockers

- `q0121` [auto-matched]: answerKeyDecisionConsistent, answerKeyReady

## Diff Summary

### q0383

```diff
+ qid: q0383
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: Как часто водители в возрасте старше 60 лет обязаны предоставлять справку медицинского осмотра?
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/200.png
+ localeOptionOrder:
+   A: A Каждые 3 года (Every 3 years)
+   B: B Каждые 2 года (Every 2 years)
+   C: C Каждый год (Every year)
+   D: D Каждые 6 месяцев (Every 6 months)
+ options:
+   q0383_o1: A Каждые 3 года
+   q0383_o2: B Каждые 2 года
+   q0383_o3: D Каждые 6 месяцев
+   q0383_o4: C Каждый год
```

### q0143

```diff
+ qid: q0143
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: По какой полосе разрешена скорость выше 110 км/ч на 4 полосной автомагистрали?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.49.14.png
+ localeOptionOrder:
+   A: A По крайней левой полосе (In the far left lane)
+   B: B По второй полосе (In the second lane)
+   C: C По третьей полосе (In the third lane)
+   D: D По крайней правой полосе (In the far right lane)
+ options:
+   q0143_o1: A По крайней левой полосе
+   q0143_o2: B По второй полосе
+   q0143_o3: D По крайней правой полосе
+   q0143_o4: C По третьей полосе
```

### q0981

```diff
+ qid: q0981
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: За несоблюдение знаков светофора, водителю начисляется:
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.49.26.png
+ localeOptionOrder:
+   A: A 2 балла (2 points)
+   B: B 3 балла (3 points)
+   C: C 6 баллов (6 points)
+   D: D 12 баллов (12 points)
+ options:
+   q0981_o1: D 12 баллов
+   q0981_o2: C 6 баллов
+   q0981_o3: B 3 балла
+   q0981_o4: A 2 балла
```

### q0121

```diff
+ qid: q0121
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: При движении по автомагистрали, при несвоевременном выезде из нее, водителю следует:
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.49.40 1.png
+ localeOptionOrder:
+   A: A) Двигаться в заднем направлении (Drive in reverse)
+   B: B) Продолжить движение, искать следующий выход (Continue driving, look for the next exit)
+   C: C) Остановиться немедленно (Stop immediately)
+   D: D) Развернуться на месте (Make a U-turn on the spot)
+ options:
+   q0121_o1: A) Двигаться в заднем направлении
+   q0121_o2: B) Продолжить движение, искать следующий выход
+   q0121_o3: C) Остановиться немедленно
+   q0121_o4: D) Развернуться на месте
```

