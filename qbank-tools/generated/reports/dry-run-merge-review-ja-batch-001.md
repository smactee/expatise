# Dry-Run Merge Review: ja batch-001

- Dataset: `2023-test1`
- Scope: `preview-only`
- Preview qids: 12
- Ready for merge: 12
- Blockers: 0
- Safe to merge next step: yes
- Dry-run artifact: `qbank-tools/generated/staging/translations.ja.batch-001.merge-dry-run.json`

## Diff Summary

### q0871

```diff
+ qid: q0871
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.24.png
+ localeOptionOrder:
+   A: A 非動車車線 (A. Lane for non-motor vehicles)
+   B: B 自転車通行止め (B. Bicycles prohibited)
+   C: C 自転車専用車線 (C. Exclusive bicycle lane)
+   D: D 自転車を駐輪できる区間 (D. Area where bicycles can be parked)
+ options:
+   q0871_o1: B 自転車通行止め
+   q0871_o2: A 非動車車線
+   q0871_o3: C 自転車専用車線
+   q0871_o4: D 自転車を駐輪できる区間
```

### q0810

```diff
+ qid: q0810
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.45.png
+ localeOptionOrder:
+   A: A 両側車線数減少 (A Decrease in the number of lanes on both sides)
+   B: B 右側車線数減少 (B Decrease in the number of lanes on the right side)
+   C: C 左側車線数減少 (C Decrease in the number of lanes on the left side)
+   D: D 幅員減少 (D Road narrows)
+ options:
+   q0810_o1: A 両側車線数減少
+   q0810_o2: B 右側車線数減少
+   q0810_o3: C 左側車線数減少
+   q0810_o4: D 幅員減少
```

### q0164

```diff
+ qid: q0164
+ type: MCQ
+ prompt: 一般道路をバックして走行しているさい、こちらに向かってくる車両がいることに気づいた場合
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.47 1.png
+ localeOptionOrder:
+   A: A バックし続ける (A. Continue backing up)
+   B: B クラクションを鳴らし合図をする (B. Sound the horn to signal)
+   C: C 停止して道をゆずる (C. Stop and yield the way)
+   D: D 速度をあげてバックする (D. Increase speed while backing up)
+ options:
+   q0164_o1: B クラクションを鳴らし合図をする
+   q0164_o2: C 停止して道をゆずる
+   q0164_o3: D 速度をあげてバックする
+   q0164_o4: A バックし続ける
```

### q0071

```diff
+ qid: q0071
+ type: ROW
+ prompt: 霧での走行では、クラクションを多用し相手の注意を喚起する。他車のクラクションを聞いたら、クラクションで応じるべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.47.png
```

### q0781

```diff
+ qid: q0781
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.49.png
+ localeOptionOrder:
+   A: A 大型牧場あり (A. Large ranch ahead)
+   B: B 野生動物保護区あり (B. Wildlife protection area ahead)
+   C: C 野生動物が飛び出すおそれあり (C. Wild animals may dart out)
+   D: D 家畜が飛び出すおそれあり (D. Livestock may dart out)
+ options:
+   q0781_o1: C 野生動物が飛び出すおそれあり
+   q0781_o2: B 野生動物保護区あり
+   q0781_o3: D 家畜が飛び出すおそれあり
+   q0781_o4: A 大型牧場あり
```

### q0126

```diff
+ qid: q0126
+ type: MCQ
+ prompt: 夜間の運転では、どのような現象が生じるか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.51.png
+ localeOptionOrder:
+   A: A 視界が悪く、道路状況を把握しにくい (A. Visibility is poor, making it difficult to grasp road conditions)
+   B: B 路面状況が複雑で変化しやすい (B. Road surface conditions become complicated and change easily)
+   C: C 運転者の体力を低下させる (C. The driver's physical strength decreases)
+   D: D 運転者に衝動や幻覚が起こりやすくなる (D. Drivers are more likely to experience impulses or hallucinations)
+ options:
+   q0126_o1: A 視界が悪く、道路状況を把握しにくい
+   q0126_o2: B 路面状況が複雑で変化しやすい
+   q0126_o3: C 運転者の体力を低下させる
+   q0126_o4: D 運転者に衝動や幻覚が起こりやすくなる
```

### q0591

```diff
+ qid: q0591
+ type: MCQ
+ prompt: 自動車のインパネにが点灯し続けているのは、何を示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.53 1.png
+ localeOptionOrder:
+   A: A アンチロックブレーキシステムの故障 (A. Malfunction of anti-lock braking system)
+   B: B エアバッグの故障 (B. Airbag malfunction)
+   C: C エアバッグが作動している (C. Airbag is operating)
+   D: D シートベルトの未着用 (D. Seatbelt not fastened)
+ options:
+   q0591_o1: C エアバッグが作動している
+   q0591_o2: D シートベルトの未着用
+   q0591_o3: A アンチロックブレーキシステムの故障
+   q0591_o4: B エアバッグの故障
```

### q0110

```diff
+ qid: q0110
+ type: MCQ
+ prompt: 雨で滑りやすい路面の走行時に急ブレーキを踏むと、どのようなことが起こりやすいか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.54.png
+ localeOptionOrder:
+   A: A エンストを起こしやすい (A. The engine is likely to stall)
+   B: B ほかの車両の運転者が気づきにくい (B. It's hard for other drivers to notice)
+   C: C 視線がぼやけるため衝突事故を起こしやすい (C. Your vision may blur, making collisions likely)
+   D: D 横滑りし、事故を起こしやすい (D. You may skid sideways, making an accident likely)
+ options:
+   q0110_o1: D 横滑りし、事故を起こしやすい
+   q0110_o2: C 視線がぼやけるため衝突事故を起こしやすい
+   q0110_o3: B ほかの車両の運転者が気づきにくい
+   q0110_o4: A エンストを起こしやすい
```

### q0237

```diff
+ qid: q0237
+ type: ROW
+ prompt: 道路で自動車を運転する場合、制限速度標識に示される最高時速をオーバーしてはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.55.png
```

### q0780

```diff
+ qid: q0780
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.56.png
+ localeOptionOrder:
+   A: A 狭い道 (A. Narrow road)
+   B: B 右側車線数減少 (B. Fewer lanes on the right side)
+   C: C 左側車線数減少 (C. Fewer lanes on the left side)
+   D: D 狭い橋 (D. Narrow bridge)
+ options:
+   q0780_o1: C 左側車線数減少
+   q0780_o2: D 狭い橋
+   q0780_o3: A 狭い道
+   q0780_o4: B 右側車線数減少
```

### q0694

```diff
+ qid: q0694
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.49.59.png
+ localeOptionOrder:
+   A: A 路面に凹凸あり (A Uneven road surface)
+   B: B 山なりの橋 (B Humpback bridge)
+   C: C 路面突出 (C Road surface protrusion)
+   D: D 路面に凹みあり (D Depression in the road surface)
+ options:
+   q0694_o1: B 山なりの橋
+   q0694_o2: D 路面に凹みあり
+   q0694_o3: C 路面突出
+   q0694_o4: A 路面に凹凸あり
```

### q0606

```diff
+ qid: q0606
+ type: MCQ
+ prompt: 自動車のインパネの点灯は、何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 17.50.00.png
+ localeOptionOrder:
+   A: A 片側のドアが開いている (A: One side door is open)
+   B: B ラゲージルームが開いている (B: The luggage compartment is open)
+   C: C エンジンルームが開いている (C: The engine compartment is open)
+   D: D 燃料タンクの蓋が開いている (D: The fuel tank lid is open)
+ options:
+   q0606_o1: B ラゲージルームが開いている
+   q0606_o2: C エンジンルームが開いている
+   q0606_o3: D 燃料タンクの蓋が開いている
+   q0606_o4: A 片側のドアが開いている
```

