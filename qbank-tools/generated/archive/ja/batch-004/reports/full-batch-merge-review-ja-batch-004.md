# Full-Batch Dry-Run Merge Review: ja batch-004

- Dataset: `2023-test1`
- Auto-matched items: 3
- Reviewed items: 17
- Equivalent overlaps: 0
- Final total: 20
- Ready for merge: 20
- Blockers: 0
- Safe to merge next step: yes
- Full preview: `qbank-tools/generated/staging/translations.ja.batch-004.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ja.batch-004.full.merge-dry-run.json`

## Diff Summary

### q0784

```diff
+ qid: q0784
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/100.png
+ localeOptionOrder:
+   A: 工事区間迂回せよ (Detour through construction area)
+   B: 二方向通行 (Two-way traffic)
+   C: 危険に注意 (Caution: Danger)
+   D: 左右へ迂回せよ (Detour to the left or right)
+ options:
+   q0784_o1: 工事区間迂回せよ
+   q0784_o2: 二方向通行
+   q0784_o3: 左右へ迂回せよ
+   q0784_o4: 危険に注意
```

### q0806

```diff
+ qid: q0806
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この交通警察の手信号は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.50.56.png
+ localeOptionOrder:
+   A: A 右折 (A Turn right)
+   B: B 減速徐行 (B Slow down and proceed with caution)
+   C: C 左折車は待機 (C Left-turning vehicles must wait)
+   D: D 道端に停車せよ (D Stop at the roadside)
+ options:
+   q0806_o1: C 左折車は待機
+   q0806_o2: D 道端に停車せよ
+   q0806_o3: A 右折
+   q0806_o4: B 減速徐行
```

### q0064

```diff
+ qid: q0064
+ sourceBucket: reviewed
+ type: ROW
+ prompt: アイスバーン上水雪路での走行は自動車の安定性を低下させるため、アクセルを急に踏むと車輪が空転し横滑りを起こしやすい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.50.57 1.png
```

### q0426

```diff
+ qid: q0426
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 信号がない交差点ではどのように通行するのが適切か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.50.57.png
+ localeOptionOrder:
+   A: A 速度を落として徐行する (A: Slow down and go slowly)
+   B: B 速度を上げて走行する (B: Speed up and go)
+   C: C 大型車両が優先通行する (C: Large vehicles have priority)
+   D: D 左側にある車両が優先通行する (D: Vehicles on the left have priority)
+ options:
+   q0426_o1: A 速度を落として徐行する
+   q0426_o2: B 速度を上げて走行する
+   q0426_o3: C 大型車両が優先通行する
+   q0426_o4: D 左側にある車両が優先通行する
```

### q0600

```diff
+ qid: q0600
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このメーターは何か。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.50.59.png
+ localeOptionOrder:
+   A: A 電流計 (A Ammeter)
+   B: B 圧力計 (B Pressure gauge)
+   C: C 水温計 (C Water temperature gauge)
+   D: D 燃料計 (D Fuel gauge)
+ options:
+   q0600_o1: B 圧力計
+   q0600_o2: A 電流計
+   q0600_o3: C 水温計
+   q0600_o4: D 燃料計
```

### q0673

```diff
+ qid: q0673
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.00.png
+ localeOptionOrder:
+   A: A 高速道路の次の出口の予告 (A Notice of the next exit on the expressway)
+   B: B 高速道路の右側出口の予告 (B Notice of a right-side exit on the expressway)
+   C: C 高速道路の目的地の予告 (C Notice of the destination on the expressway)
+   D: D 高速道路の左側出口の予告 (D Notice of a left-side exit on the expressway)
+ options:
+   q0673_o1: D 高速道路の左側出口の予告
+   q0673_o2: C 高速道路の目的地の予告
+   q0673_o3: B 高速道路の右側出口の予告
+   q0673_o4: A 高速道路の次の出口の予告
```

### q0889

```diff
+ qid: q0889
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.02 1.png
+ localeOptionOrder:
+   A: A 長時間クラクションを鳴らすことを禁ず (A. Not prohibited to honk the horn for a long time)
+   B: B 断続的にクラクションを鳴らせ (B. Honk the horn intermittently)
+   C: C クラクション禁止 (C. Horn prohibited)
+   D: D 速度を落としクラクションを鳴らせ (D. Slow down and honk the horn)
+ options:
+   q0889_o1: A 長時間クラクションを鳴らすことを禁ず
+   q0889_o2: B 断続的にクラクションを鳴らせ
+   q0889_o3: D 速度を落としクラクションを鳴らせ
+   q0889_o4: C クラクション禁止
```

### q0092

```diff
+ qid: q0092
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 交通状況が複雑な交差点では、「三分停まっても、一秒を争わない」ことが大切である。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.02.png
```

### q0853

```diff
+ qid: q0853
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.13.png
+ localeOptionOrder:
+   A: A 立体交差に注意 (A. Beware of grade-separated crossing)
+   B: B 分離式道路に注意 (B. Beware of divided road)
+   C: C 平面交差あり (C. Flat intersection ahead)
+   D: D ロータリーあり (D. There is a rotary)
+ options:
+   q0853_o1: C 平面交差あり
+   q0853_o2: B 分離式道路に注意
+   q0853_o3: D ロータリーあり
+   q0853_o4: A 立体交差に注意
```

### q0512

```diff
+ qid: q0512
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 中央線のない狭い山道を運転している場合、どのように対向車とすれ違うのが適切か。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.14.png
+ localeOptionOrder:
+   A: A 速度が遅い自動車が先に走行する (A vehicle moving at a slower speed should go first.)
+   B: B 貨物満載車が空車に道を譲って先に走行させる (A fully-loaded cargo vehicle should yield to an empty vehicle and let it go first.)
+   C: C 山体から近い側の自動車が先に走行する (The vehicle on the side closer to the mountain should go first.)
+   D: D 山体から遠い側の自動車が先に走行する (The vehicle on the side farther from the mountain should go first.)
+ options:
+   q0512_o1: D 山体から遠い側の自動車が先に走行する
+   q0512_o2: C 山体から近い側の自動車が先に走行する
+   q0512_o3: B 貨物満載車が空車に道を譲って先に走行させる
+   q0512_o4: A 速度が遅い自動車が先に走行する
```

### q0664

```diff
+ qid: q0664
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.15.png
+ localeOptionOrder:
+   A: A 路面突出 (A: Road surface protrusion)
+   B: B 山なりの橋 (B: Hump bridge)
+   C: C 路面に凹凸あり (C: Uneven road surface)
+   D: D 路面し凹みあり (D: Road surface depression)
+ options:
+   q0664_o1: C 路面に凹凸あり
+   q0664_o2: A 路面突出
+   q0664_o3: D 路面し凹みあり
+   q0664_o4: B 山なりの橋
```

### q0259

```diff
+ qid: q0259
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 高速道路を降りる場合、図の位置から直接ランプに入ることができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.17.png
```

### q0530

```diff
+ qid: q0530
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このスイッチを上下に引くと、フロントガラスのワイパーが作動する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.50.54.png
```

### q0492

```diff
+ qid: q0492
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 前車が停車し列を作って待っているあるいは徐行している場合、どう対応するのが適切か。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.50.55.png
+ localeOptionOrder:
+   A: A 他の車線を利用して追い越す (A. Overtake using another lane)
+   B: B 対向車線を利用する (B. Use the oncoming lane)
+   C: C 待っている車両のすき間に割り込む (C. Cut into the gap between the waiting cars)
+   D: D 順番に走行する (D. Proceed in order)
+ options:
+   q0492_o1: A 他の車線を利用して追い越す
+   q0492_o2: B 対向車線を利用する
+   q0492_o3: D 順番に走行する
+   q0492_o4: C 待っている車両のすき間に割り込む
```

### q0370

```diff
+ qid: q0370
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 運転者がに12点減点されるがつくのは、どの違法行為か。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.50.58.png
+ localeOptionOrder:
+   A: A 交通信号に違反する (A. Violating a traffic signal)
+   B: B 偽造されたナンバープレートを使用する (B. Using a forged license plate)
+   C: C 禁止標識の指示に違反する (C. Violating a prohibited sign)
+   D: D 電話をかける、または電話に出る (D. Making or answering a phone call)
+ options:
+   q0370_o1: A 交通信号に違反する
+   q0370_o2: B 偽造されたナンバープレートを使用する
+   q0370_o3: D 電話をかける、または電話に出る
+   q0370_o4: C 禁止標識の指示に違反する
```

### q0251

```diff
+ qid: q0251
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 道路交通安全達法による累積点数の制限は、一計算周期につき12点である。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.01.png
```

### q0629

```diff
+ qid: q0629
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車のインパネのの点灯は、何を示しているか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.16.png
+ localeOptionOrder:
+   A: A ブレーキ液の不足 (A. Low brake fluid)
+   B: B 洗浄剤の不足 (B. Low washer fluid)
+   C: C 冷却システムの故障 (C. Cooling system failure)
+   D: D 冷却液の不足 (D. Low coolant)
+ options:
+   q0629_o1: B 洗浄剤の不足
+   q0629_o2: A ブレーキ液の不足
+   q0629_o3: C 冷却システムの故障
+   q0629_o4: D 冷却液の不足
```

### q0078

```diff
+ qid: q0078
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 坂を下る場合、適度に速度を控えエンジンを十分し利用し制動する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.12.png
```

### q0284

```diff
+ qid: q0284
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 交差点のこの位置にいる場合、速度を上げて通過できる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.16 1.png
```

### q0195

```diff
+ qid: q0195
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 自動車で坂を登る場合、頂上に達しようとするさいに速度を上げクラクションを鳴らす。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.51.18.png
```

