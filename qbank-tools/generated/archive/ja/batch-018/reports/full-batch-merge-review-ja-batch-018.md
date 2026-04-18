# Full-Batch Dry-Run Merge Review: ja batch-018

- Dataset: `2023-test1`
- Auto-matched items: 9
- Reviewed items: 39
- Equivalent overlaps: 0
- Final total: 48
- Ready for merge: 47
- Blockers: 1
- Safe to merge next step: no
- Full preview: `qbank-tools/generated/staging/translations.ja.batch-018.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ja.batch-018.full.merge-dry-run.json`

## Blockers

- `q0958` [reviewed]: answerKeyDecisionConsistent, answerKeyReady

## Diff Summary

### q0365

```diff
+ qid: q0365
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このような交差点を通過する場合、正しい操作はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.41 1.png
+ localeOptionOrder:
+   A: A 左側の車線によってUターンする (A. Make a U-turn from the left lane)
+   B: B この交差点でUターンできない (B. Cannot make a U-turn at this intersection)
+   C: C 中央部の車線からUターンする (C. Make a U-turn from the center lane)
+   D: D 交差点内でUターンする (D. Make a U-turn inside the intersection)
+ options:
+   q0365_o1: A 左側の車線によってUターンする
+   q0365_o2: B この交差点でUターンできない
+   q0365_o3: C 中央部の車線からUターンする
+   q0365_o4: D 交差点内でUターンする
```

### q0509

```diff
+ qid: q0509
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 道端に寄って自動車を停車させる場合、どのようにライトを使用するのが適切か。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.41.png
+ localeOptionOrder:
+   A: A ハイビームとロービームヘッドランプを交互に使用する (A Use the high beam and low beam headlights alternately)
+   B: B ランプをつけない (B Do not turn on any lights)
+   C: C ハザードランプをつける (C Turn on the hazard lights)
+   D: D 早めに右ウィンカーを出す (D Signal right early)
+ options:
+   q0509_o1: C ハザードランプをつける
+   q0509_o2: D 早めに右ウィンカーを出す
+   q0509_o3: A ハイビームとロービームヘッドランプを交互に使用する
+   q0509_o4: B ランプをつけない
```

### q0052

```diff
+ qid: q0052
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 雨での走行は路面が滑りやすいため制動距離が長くなる。走行するさいは、できるだけ急ブレーキをかけ速度を落とすべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.43.png
```

### q0958

```diff
+ qid: q0958
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.44 1.png
+ localeOptionOrder:
+   A: A 工事区間 (A. Construction zone)
+   B: B 事故多発区間 (B. Frequent accident area)
+   C: C 減速徐行区間 (C. Slow down zone)
+   D: D 渋滞区間 (D. Congestion zone)
+ options:
+   q0958_o1: C 減速徐行区間
+   q0958_o2: A 工事区間
+   q0958_o3: B 事故多発区間
+   q0958_o4: D 渋滞区間
```

### q0579

```diff
+ qid: q0579
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: アンチロック・ブレーキシステム（ABS）は、どのような状況においてブレーキの制動効果を最大限に発揮できるか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.44.png
+ localeOptionOrder:
+   A: A 断続的にブレーキをかける (A. Apply the brakes intermittently)
+   B: B 持続的にブレーキをかける (B. Apply the brakes continuously)
+   C: C ブレーキペダルをゆっくりと踏む (C. Press the brake pedal slowly)
+   D: D 急ブレーキをかける (D. Apply the brakes suddenly)
+ options:
+   q0579_o1: A 断続的にブレーキをかける
+   q0579_o2: B 持続的にブレーキをかける
+   q0579_o3: D 急ブレーキをかける
+   q0579_o4: C ブレーキペダルをゆっくりと踏む
```

### q0583

```diff
+ qid: q0583
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車のインパネのこの点灯は、何を示しているか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.45.png
+ localeOptionOrder:
+   A: A ハイビームヘッドランプの点灯 (A. High beam headlamp on)
+   B: B フロントフォグランプの点灯 (B. Front fog lamp on)
+   C: C リアフォグランプの点灯 (C. Rear fog lamp on)
+   D: D ロービームヘッドランプの点灯 (D. Low beam headlamp on)
+ options:
+   q0583_o1: B フロントフォグランプの点灯
+   q0583_o2: D ロービームヘッドランプの点灯
+   q0583_o3: A ハイビームヘッドランプの点灯
+   q0583_o4: C リアフォグランプの点灯
```

### q0021

```diff
+ qid: q0021
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 高速道路で分流交通管制があっても、高速道路から降りずに路肩に寄って停車し、管制が終わってから運転を続けてもよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.46 1.png
```

### q0472

```diff
+ qid: q0472
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: つぎの状況のなかで、交通警察が運転者の免許証を押収することができるのはどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.46.png
+ localeOptionOrder:
+   A: A 飲酒運転 (A: Drunk driving)
+   B: B 規定速度を10%上回る (B: Exceeding the speed limit by 10%)
+   C: C 疲労運転 (C: Driving while fatigued)
+   D: D 運転中、シートベルト非着用を締めていない (D: Not wearing a seatbelt while driving)
+ options:
+   q0472_o1: B 規定速度を10%上回る
+   q0472_o2: C 疲労運転
+   q0472_o3: D 運転中、シートベルト非着用を締めていない
+   q0472_o4: A 飲酒運転
```

### q0818

```diff
+ qid: q0818
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.47.png
+ localeOptionOrder:
+   A: A 右側に寄って走行せよ (A: Keep to the right)
+   B: B 直進禁止 (B: No going straight)
+   C: C 直進一方通行 (C: One-way straight traffic)
+   D: D 直進車は対向Uターン車へ道をゆずれ (D: Vehicles going straight must yield to oncoming U-turn vehicles)
+ options:
+   q0818_o1: A 右側に寄って走行せよ
+   q0818_o2: B 直進禁止
+   q0818_o3: C 直進一方通行
+   q0818_o4: D 直進車は対向Uターン車へ道をゆずれ
```

### q0620

```diff
+ qid: q0620
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車のインパネのこの点灯は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.49 1.png
+ localeOptionOrder:
+   A: A ハザードランプの点滅 (A Hazard lights flashing)
+   B: B ヘッドランプの点灯 (B Headlights on)
+   C: C サイドランプの点灯 (C Sidelights on)
+   D: D フロント・リアフォグランプの点灯 (D Front/rear fog lights on)
+ options:
+   q0620_o1: C サイドランプの点灯
+   q0620_o2: D フロント・リアフォグランプの点灯
+   q0620_o3: B ヘッドランプの点灯
+   q0620_o4: A ハザードランプの点滅
```

### q0728

```diff
+ qid: q0728
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この信号が点滅している場合、自動車はどう走行すべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.49.png
+ localeOptionOrder:
+   A: A 加速して通過する (A. Accelerate and pass through)
+   B: B 道端に停車して待つ (B. Stop and wait at the roadside)
+   C: C 目視で安全確認して通過する (C. Check for safety visually and pass through)
+   D: D 通行禁止 (D. Passage prohibited)
+ options:
+   q0728_o1: A 加速して通過する
+   q0728_o2: B 道端に停車して待つ
+   q0728_o3: C 目視で安全確認して通過する
+   q0728_o4: D 通行禁止
```

### q0193

```diff
+ qid: q0193
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 道端に停止している自動車には違法行為がない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.52.png
```

### q0248

```diff
+ qid: q0248
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 法律に基づき交通警察は、他車の自動車保険マークを使用した疑いのある車両を拘置できる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.55 1.png
```

### q0646

```diff
+ qid: q0646
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車は緑の矢印が点灯する車線を走行すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.55.png
```

### q0683

```diff
+ qid: q0683
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.56.png
+ localeOptionOrder:
+   A: A 直進・左折禁止 (A: No going straight or turning left)
+   B: B 直進禁止・左へ車線変更禁止 (B: No going straight, no changing lanes to the left)
+   C: C 直進・左折可 (C: Going straight or turning left is allowed)
+   D: D 直進・右折禁止 (D: No going straight or turning right)
+ options:
+   q0683_o1: B 直進禁止・左へ車線変更禁止
+   q0683_o2: A 直進・左折禁止
+   q0683_o3: C 直進・左折可
+   q0683_o4: D 直進・右折禁止
```

### q0850

```diff
+ qid: q0850
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このような場合、どう走行すべきか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.58 1.png
+ localeOptionOrder:
+   A: A 両側の車線を通行してはいけない (A. Do not drive across both lanes)
+   B: B 速度を落として両側の車線に入る (B. Reduce speed and move into both lanes)
+   C: C 右側の車線に進入して走行する (C. Enter and drive in the right lane)
+   D: D 加速して両側の車線に進入し走行する (D. Accelerate and enter and drive in both lanes)
+ options:
+   q0850_o1: D 加速して両側の車線に進入し走行する
+   q0850_o2: C 右側の車線に進入して走行する
+   q0850_o3: B 速度を落として両側の車線に入る
+   q0850_o4: A 両側の車線を通行してはいけない
```

### q0841

```diff
+ qid: q0841
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.58.png
+ localeOptionOrder:
+   A: A 高さ制限3.5メートル (A Height limit 3.5 meters)
+   B: B 幅制限3.5メートル (B Width limit 3.5 meters)
+   C: C 高さ制限3.5メートル解除 (C Height limit 3.5 meters lifted)
+   D: D 最小車間距離3.5メートル (D Minimum vehicle distance 3.5 meters)
+ options:
+   q0841_o1: B 幅制限3.5メートル
+   q0841_o2: C 高さ制限3.5メートル解除
+   q0841_o3: D 最小車間距離3.5メートル
+   q0841_o4: A 高さ制限3.5メートル
```

### q0758

```diff
+ qid: q0758
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.59.png
+ localeOptionOrder:
+   A: A 目的地までの距離 (A Distance to the destination)
+   B: B 車線 (B Lane)
+   C: C 進行方向 (C Direction of travel)
+   D: D 目的地の地名 (D Name of the destination)
+ options:
+   q0758_o1: A 目的地までの距離
+   q0758_o2: B 車線
+   q0758_o3: D 目的地の地名
+   q0758_o4: C 進行方向
```

### q0327

```diff
+ qid: q0327
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 減点が満点12点に達した運転者が練習や試験への参加を拒否した場合、免許は使用停止となる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.00.png
```

### q0187

```diff
+ qid: q0187
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 交通運輸管理法を違反し重大な交通事故を起こし重傷者を出した場合、運転者は3年以下の懲役または拘留を受ける可能性がある。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.01 1.png
```

### q0294

```diff
+ qid: q0294
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 法律に基づき交通警察は、他車のナンバープレートや車両走行許可証通行証を使用した疑いのある車両を拘置できる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.01.png
```

### q0611

```diff
+ qid: q0611
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: エンジンが起動したあとの点灯は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.03.png
+ localeOptionOrder:
+   A: A 油圧が高すぎる (A. Oil pressure is too high)
+   B: B オイルホースが詰まっている (B. Oil hose is clogged)
+   C: C 油圧が低すぎる (C. Oil pressure is too low)
+   D: D クランクケースがエア漏れ (D. Crankcase has an air leak)
+ options:
+   q0611_o1: B オイルホースが詰まっている
+   q0611_o2: C 油圧が低すぎる
+   q0611_o3: D クランクケースがエア漏れ
+   q0611_o4: A 油圧が高すぎる
```

### q0311

```diff
+ qid: q0311
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 運転席のフロントウインドおよびバックウインドとの間のスペースに、運転者の視野を妨げる物品を置いたり掛けたりしてはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.06 1.png
```

### q0839

```diff
+ qid: q0839
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.07.png
+ localeOptionOrder:
+   A: A 車線の一時占用禁止 (A Temporary lane occupation prohibited)
+   B: B 車線変更禁止 (B Lane change prohibited)
+   C: C 追い越し禁止 (C Overtaking prohibited)
+   D: D Uターン禁止 (D U-turn prohibited)
+ options:
+   q0839_o1: A 車線の一時占用禁止
+   q0839_o2: B 車線変更禁止
+   q0839_o3: C 追い越し禁止
+   q0839_o4: D Uターン禁止
```

### q0585

```diff
+ qid: q0585
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: これは何のペダルか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.08.png
+ localeOptionOrder:
+   A: A アクセル (A Accelerator)
+   B: B クラッチ・ペダル (B Clutch pedal)
+   C: C ブレーキペダル (C Brake pedal)
+   D: D パーキングブレーキ (D Parking brake)
+ options:
+   q0585_o1: B クラッチ・ペダル
+   q0585_o2: A アクセル
+   q0585_o3: C ブレーキペダル
+   q0585_o4: D パーキングブレーキ
```

### q0087

```diff
+ qid: q0087
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 車両はぬかるんだ道を走行する場合、停止して路面状況を観察し平らでできるだけ堅い部位を選び低速で通過すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.09 1.png
```

### q0253

```diff
+ qid: q0253
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 規定に反しスクールバスに道を譲らない運転者には6点が減点されるつく。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.09.png
```

### q0020

```diff
+ qid: q0020
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 歩行者が急に道路を横切った場合、運転者は迅速に速度を落とし、道を譲るべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.10.png
```

### q0442

```diff
+ qid: q0442
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この交差点は、どう右折するのが適当か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.11.png
+ localeOptionOrder:
+   A: A 対向車に先に優先権を譲って左折させる (A. Yield the right of way to the oncoming car and let it turn left first)
+   B: B 直接右折する (B. Turn right directly)
+   C: C 対向車に先駆けて右折する (C. Make the right turn ahead of the oncoming car)
+   D: D クラクションを鳴らして律使する (D. Sound the horn and proceed)
+ options:
+   q0442_o1: B 直接右折する
+   q0442_o2: C 対向車に先駆けて右折する
+   q0442_o3: D クラクションを鳴らして律使する
+   q0442_o4: A 対向車に先に優先権を譲って左折させる
```

### q0823

```diff
+ qid: q0823
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識はA・を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.12 1.png
+ localeOptionOrder:
+   A: A 右へ車線変更 (A Lane change to the right)
+   B: B 分流交差点あり (B Diverging intersection)
+   C: C 車線数増加 (C Increase in the number of lanes)
+   D: D 幅員増加 (D Road width increase)
+ options:
+   q0823_o1: A 右へ車線変更
+   q0823_o2: B 分流交差点あり
+   q0823_o3: D 幅員増加
+   q0823_o4: C 車線数増加
```

### q0564

```diff
+ qid: q0564
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車のインパネの点灯は、エンジンがバッテリーを充電していることを示している。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.12.png
```

### q0199

```diff
+ qid: q0199
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 中央線のない公道を運転する場合、自動車の最高速度は70km/hを超過してはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.13.png
```

### q0431

```diff
+ qid: q0431
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 運転者がどの証明証を携帯せずに道路を運転していた場合、警察は法律に基づき車両を拘置できるか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.14 1.png
+ localeOptionOrder:
+   A: A 運転免許証 (A. Driver's license)
+   B: B 身分証明書 (B. ID card)
+   C: C 就職資格証明書 (C. Employment qualification certificate)
+   D: D 自動車通行証 (D. Automobile pass)
+ options:
+   q0431_o1: A 運転免許証
+   q0431_o2: B 身分証明書
+   q0431_o3: D 自動車通行証
+   q0431_o4: C 就職資格証明書
```

### q0163

```diff
+ qid: q0163
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 渋滞道路を低速走行しているさい、他車が無理に割り込んできた場合どうすべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.14.png
+ localeOptionOrder:
+   A: A クラクションを鳴らし注意し割り込ませない (A. Sound your horn and do not let them cut in)
+   B: B 加速し前車にぴったりつけ割り込ませない (B. Accelerate and keep close to the car in front so they cannot cut in)
+   C: C 道をゆずり、安全走行を確保する (C. Yield and ensure safe driving)
+   D: D 割り込もうとする車両を押しのける (D. Push away the vehicle that is trying to cut in)
+ options:
+   q0163_o1: A クラクションを鳴らし注意し割り込ませない
+   q0163_o2: B 加速し前車にぴったりつけ割り込ませない
+   q0163_o3: D 割り込もうとする車両を押しのける
+   q0163_o4: C 道をゆずり、安全走行を確保する
```

### q0105

```diff
+ qid: q0105
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 運転中、非自動車に追い越しされる場合、どう対応するのが適切か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.16.png
+ localeOptionOrder:
+   A: A クラクションを鳴らして注意する (A. Sound the horn to alert them)
+   B: B 加速して通過する (B. Accelerate and pass through)
+   C: C 減速して道を譲る (C. Slow down and yield the road)
+   D: D 非自動車が近づいたら、急加速する (D. When the non-motor vehicle approaches, accelerate rapidly)
+ options:
+   q0105_o1: A クラクションを鳴らして注意する
+   q0105_o2: B 加速して通過する
+   q0105_o3: C 減速して道を譲る
+   q0105_o4: D 非自動車が近づいたら、急加速する
```

### q0232

```diff
+ qid: q0232
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 交通運輸管理法規に違反して重大交通事故を起こしたあと、逃走または他の大変重要な行為を犯した運転者は、7年間の懲役に処される。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.54.png
```

### q0273

```diff
+ qid: q0273
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 事故発生後、負傷者を救うため現場を保存できない場合、位置が分かるように印をつけるべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.05.png
```

### q0324

```diff
+ qid: q0324
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 路上でg動車を運転する前に車両の安全性を検査しなくてはならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.15.png
```

### q0053

```diff
+ qid: q0053
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 走行中にバーストし速度を落としていない状況では、無理にブレーキをかけてはならない。このような状況で急ブレーキをかけると横転を起こす危険性が高く、さらに重大な事故を招く可能性がある。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.17.png
```

### q0102

```diff
+ qid: q0102
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: アイスバーン上や雪路で急ブレーキをかけると横滑りを起こしやすいため低速で走行すべきである。またエンジンブレーキを利用し速度を落とすとよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/800.png
```

### q0690

```diff
+ qid: q0690
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: 図が示す円中の二本の白い破線は、なにを示す路面標示か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.42.png
+ localeOptionOrder:
+   A: A 小型自動車用左右折線 (A: Right and left turn lines for small vehicles)
+   B: B :Uターンを導く路面標示 (B: Road markings guiding U-turns)
+   C: C 左折を待つエリア (C: Area for waiting to turn left)
+   D: D 交差道路の停車線 (D: Stop line for crossing roads)
+ options:
+   q0690_o1: D 交差道路の停車線
+   q0690_o2: C 左折を待つエリア
+   q0690_o3: B :Uターンを導く路面標示
+   q0690_o4: A 小型自動車用左右折線
```

### q0416

```diff
+ qid: q0416
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: 赤い車のある車線は何車線か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.48.png
+ localeOptionOrder:
+   A: A 高速車線 (A: Fast lane)
+   B: B 低速車線 (B: Slow lane)
+   C: C 専用車線 (C: Dedicated lane)
+   D: D 緊急車線 (D: Emergency lane)
+ options:
+   q0416_o1: A 高速車線
+   q0416_o2: B 低速車線
+   q0416_o3: D 緊急車線
+   q0416_o4: C 専用車線
```

### q0241

```diff
+ qid: q0241
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 路上で運転する場合、前席乗員はシートベルトを着用する必要がない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.50.png
```

### q0733

```diff
+ qid: q0733
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.51 1.png
+ localeOptionOrder:
+   A: A 急カーブ (A. Sharp curve)
+   B: B 滑りやすい (B. Slippery)
+   C: C 試運転区間 (C. Test driving section)
+   D: D カーブ区間 (D. Curve section)
+ options:
+   q0733_o1: B 滑りやすい
+   q0733_o2: A 急カーブ
+   q0733_o3: C 試運転区間
+   q0733_o4: D カーブ区間
```

### q0602

```diff
+ qid: q0602
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: 自動車のインパネのこの点灯は、何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.26.53.png
+ localeOptionOrder:
+   A: A 両側のドアが開いている (A. Both side doors are open)
+   B: B ラゲージルームが開いている (B. The luggage compartment is open)
+   C: C エンジンルームが開いている (C. The engine compartment is open)
+   D: D 燃料タンクの蓋が開いている (D. The fuel tank cap is open)
+ options:
+   q0602_o1: C エンジンルームが開いている
+   q0602_o2: D 燃料タンクの蓋が開いている
+   q0602_o3: A 両側のドアが開いている
+   q0602_o4: B ラゲージルームが開いている
```

### q0815

```diff
+ qid: q0815
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.02.png
+ localeOptionOrder:
+   A: A 危険回避車線 (A: Escape lane (runaway vehicle lane))
+   B: B 緊急車線 (B: Emergency lane)
+   C: C 路肩 (C: Shoulder)
+   D: D 急カーブ (D: Sharp curve)
+ options:
+   q0815_o1: A 危険回避車線
+   q0815_o2: B 緊急車線
+   q0815_o3: C 路肩
+   q0815_o4: D 急カーブ
```

### q0058

```diff
+ qid: q0058
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 交差点で青信号になったが非自動車に割り込まれた場合、運道を譲らなくてもよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.04.png
```

### q0062

```diff
+ qid: q0062
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 後輪がバーストし斜め滑りが起きた場合、両手でハンドルをしっかり握り、直進を維持し減速して停車すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.27.06.png
```

