# Full-Batch Dry-Run Merge Review: ja batch-009

- Dataset: `2023-test1`
- Auto-matched items: 9
- Reviewed items: 41
- Equivalent overlaps: 0
- Final total: 50
- Ready for merge: 50
- Blockers: 0
- Safe to merge next step: yes
- Full preview: `qbank-tools/generated/staging/translations.ja.batch-009.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ja.batch-009.full.merge-dry-run.json`

## Diff Summary

### q0211

```diff
+ qid: q0211
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 路上で走行している、動車に車検合格マークが標示されていない場合、交通警察は法律に基づき車両を拘置できる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/350.png
```

### q0548

```diff
+ qid: q0548
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車のインパネのの点灯は、エンジンルームが開いていることを示す。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.04.png
```

### q0438

```diff
+ qid: q0438
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この公道を走行する場合の最高速度はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.05.png
+ localeOptionOrder:
+   A: A 30km/h (A 30km/h)
+   B: B 40km/h (B 40km/h)
+   C: C 50km/h (C 50km/h)
+   D: D 70km/h (D 70km/h)
+ options:
+   q0438_o1: A 30km/h
+   q0438_o2: B 40km/h
+   q0438_o3: C 50km/h
+   q0438_o4: D 70km/h
```

### q0235

```diff
+ qid: q0235
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような場合、右側のバス車線を利用して追い越してか。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.06 1.png
```

### q0094

```diff
+ qid: q0094
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 濃霧での走行は視界が悪いが、ハイビームヘッドランプをつけることで視野を良くすることができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.06.png
```

### q0145

```diff
+ qid: q0145
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 豪雨での走行時、ワイパーが利かない場合どうすべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.08 1.png
+ localeOptionOrder:
+   A: A 減速して走行する (A. Drive at reduced speed)
+   B: B 注意を払い運転する (B. Drive with extra caution)
+   C: C ただちに減速し道端に寄り停車する (C. Immediately slow down and pull over to the roadside)
+   D: D 通常速度で走行する (D. Drive at normal speed)
+ options:
+   q0145_o1: B 注意を払い運転する
+   q0145_o2: C ただちに減速し道端に寄り停車する
+   q0145_o3: D 通常速度で走行する
+   q0145_o4: A 減速して走行する
```

### q0709

```diff
+ qid: q0709
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 縁石の黄色い実線は、なにを示すか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.08.png
+ localeOptionOrder:
+   A: A 乗客の乗降のみ可 (A. Only passenger boarding and alighting allowed)
+   B: B 貨物の積み下ろしのみ可 (B. Only loading and unloading of cargo allowed)
+   C: C 長時間停車の禁止 (C. Prohibition of long-term stopping)
+   D: D 駐車禁止 (D. No parking)
+ options:
+   q0709_o1: A 乗客の乗降のみ可
+   q0709_o2: B 貨物の積み下ろしのみ可
+   q0709_o3: C 長時間停車の禁止
+   q0709_o4: D 駐車禁止
```

### q0352

```diff
+ qid: q0352
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 小型自動車で急勾配を降りる場合、ギアをニュートラルにして走行することができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.09.png
```

### q0147

```diff
+ qid: q0147
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 走行中、前方に交通事故が発生し救助が必要な場合どうすべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.14.png
+ localeOptionOrder:
+   A: A 回り道して逃避する (A. Detour and escape)
+   B: B すぐに警察を呼び、停車し様子を見る (B. Call the police immediately, stop and observe the situation)
+   C: C 現場維持に協力し、すぐに警察を呼ぶ (C. Assist in preserving the scene and call the police immediately)
+   D: D 無視して、速度を上げ通過する (D. Ignore it and pass through at higher speed)
+ options:
+   q0147_o1: A 回り道して逃避する
+   q0147_o2: B すぐに警察を呼び、停車し様子を見る
+   q0147_o3: C 現場維持に協力し、すぐに警察を呼ぶ
+   q0147_o4: D 無視して、速度を上げ通過する
```

### q0483

```diff
+ qid: q0483
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 中央線のない道で後車が追い越しをしようとしている時、条件が許される場合どう運転するのが適当か。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.15 1.png
+ localeOptionOrder:
+   A: A 元本の状態に保保ったまま運転する (Drive while maintaining the original condition (speed, position))
+   B: B 加速運転する (Accelerate)
+   C: C 急停止して後車に道を譲る (Stop suddenly and give way to the vehicle behind)
+   D: D 減速し、右側に寄りかかって道を譲る (Slow down and move to the right to give way)
+ options:
+   q0483_o1: A 元本の状態に保保ったまま運転する
+   q0483_o2: B 加速運転する
+   q0483_o3: D 減速し、右側に寄りかかって道を譲る
+   q0483_o4: C 急停止して後車に道を譲る
```

### q0042

```diff
+ qid: q0042
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 平坦な高速道路での小型旅客車の運転中、急に揺れるようになった感覚があった場合、タイヤがパンクする恐れがあるため、すみやかに速度を落とすべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.15.png
```

### q0177

```diff
+ qid: q0177
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 他車に追い越されるさい、どう対応するのが適切か。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.16.png
+ localeOptionOrder:
+   A: A 加速し走行を続ける (A: Continue driving while accelerating)
+   B: B 減速し右側に寄り走行する (B: Slow down and move to the right side)
+   C: C 道路中央部に寄り走行する (C: Move to the center of the road and drive)
+   D: D 加速して道をゆずる (D: Accelerate and yield the road)
+ options:
+   q0177_o1: C 道路中央部に寄り走行する
+   q0177_o2: D 加速して道をゆずる
+   q0177_o3: A 加速し走行を続ける
+   q0177_o4: B 減速し右側に寄り走行する
```

### q0037

```diff
+ qid: q0037
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 坂を下る場合、ギアをニュートラルにして滑走するとよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.17.png
```

### q0440

```diff
+ qid: q0440
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 同じ車線を走行している前車がどの車両である場合、追い越してはいけないか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.19 1.png
+ localeOptionOrder:
+   A: A. 過積載の大型貨物車 (A. Overloaded large cargo truck)
+   B: B. 任務中の消防車 (B. Fire engine on duty)
+   C: C. 大型旅客車 (C. Large passenger vehicle)
+   D: D. 中型旅客車 (D. Medium-sized passenger vehicle)
+ options:
+   q0440_o1: A. 過積載の大型貨物車
+   q0440_o2: B. 任務中の消防車
+   q0440_o3: C. 大型旅客車
+   q0440_o4: D. 中型旅客車
```

### q0197

```diff
+ qid: q0197
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車を路上で運転し道路通行規定に違反した場合、相応の処罰を受けることになる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.19.png
```

### q0805

```diff
+ qid: q0805
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 路面の黄色い標記が示すのはどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.20.png
+ localeOptionOrder:
+   A: A 左右折禁止 (A. No left or right turn)
+   B: B Uターン禁止 (B. No U-turn)
+   C: C Uターン可 (C. U-turn allowed)
+   D: D 直進禁止 (D. No going straight)
+ options:
+   q0805_o1: D 直進禁止
+   q0805_o2: C Uターン可
+   q0805_o3: B Uターン禁止
+   q0805_o4: A 左右折禁止
```

### q0515

```diff
+ qid: q0515
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 交通運輸管理法を違反し重大な交通事故を起こして逃走した場合、運転者が受ける懲役期間はどれか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.22 1.png
+ localeOptionOrder:
+   A: A 7年以上 (A: 7 years or more)
+   B: B 3年以下 (B: 3 years or less)
+   C: C 3年以上7年以下 (C: 3 years or more but less than 7 years)
+   D: D 10年以上 (D: 10 years or more)
+ options:
+   q0515_o1: A 7年以上
+   q0515_o2: B 3年以下
+   q0515_o3: C 3年以上7年以下
+   q0515_o4: D 10年以上
```

### q0680

```diff
+ qid: q0680
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.22.png
+ localeOptionOrder:
+   A: A 両側車線数減少 (A Both sides number of lanes decrease)
+   B: B 右側車線数減少 (B Right side number of lanes decreases)
+   C: C 左側車線数減少 (C Left side number of lanes decreases)
+   D: D 幅員減少 (D Road narrows)
+ options:
+   q0680_o1: A 両側車線数減少
+   q0680_o2: B 右側車線数減少
+   q0680_o3: C 左側車線数減少
+   q0680_o4: D 幅員減少
```

### q0043

```diff
+ qid: q0043
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 山道の坂を上る場合、適時・確・すみやかにギアを落とし、ギアが高すぎることによるエンジンの動力不足を避けるべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.24 1.png
```

### q0357

```diff
+ qid: q0357
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 運転者は有効期間が過ぎた免許であっても、1年以内間ならば運転することができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.24.png
```

### q0226

```diff
+ qid: q0226
+ sourceBucket: reviewed
+ type: ROW
+ prompt: この道路は最高制限規制最高速度が50km/hである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.25.png
```

### q0522

```diff
+ qid: q0522
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車のインパネのこの点灯は、ブレーキシステムが故障している可能性があることを示している。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.26.png
```

### q0479

```diff
+ qid: q0479
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 路上で自動車を運転しており左へ車線を変更する場合、どのようにライトを使用するのが正しいか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.28 1.png
+ localeOptionOrder:
+   A: A ウインカーを出さない (A. Do not use the turn signal)
+   B: B 早めに右ウインカーを出す (B. Use the right turn signal early)
+   C: C 早めに左ウインカーを出す (C. Use the left turn signal early)
+   D: D 早めにヘッドランプを下向きにつける (D. Turn the headlights to low beam early)
+ options:
+   q0479_o1: B 早めに右ウインカーを出す
+   q0479_o2: A ウインカーを出さない
+   q0479_o3: C 早めに左ウインカーを出す
+   q0479_o4: D 早めにヘッドランプを下向きにつける
```

### q0070

```diff
+ qid: q0070
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 坂を上る場合、あらかじめ道路の状況や坂の長さを確認し、適時にギアを下げ車に十分な原動力を保たせるべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.31.png
```

### q0700

```diff
+ qid: q0700
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標へは何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.32 1.png
+ localeOptionOrder:
+   A: A ロータリーあり (A: There is a rotary (roundabout))
+   B: B 十形道路交差点あり (B: There is a cross-shaped intersection)
+   C: C 立体交差あり (C: There is a grade separation (overpass/underpass))
+   D: D Y形道路交差点あり (D: There is a Y-shaped intersection)
+ options:
+   q0700_o1: B 十形道路交差点あり
+   q0700_o2: A ロータリーあり
+   q0700_o3: D Y形道路交差点あり
+   q0700_o4: C 立体交差あり
```

### q0407

```diff
+ qid: q0407
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 市街地で自動車を運転するさい、追い越しをしてはいけないのはどこか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.34.png
+ localeOptionOrder:
+   A: A メインストリート (A Main street)
+   B: B 一方通行の道路 (B One-way street)
+   C: C 二車線の一方通行道路 (C Two-lane one-way street)
+   D: D 交通量が多い道路 (D Road with heavy traffic)
+ options:
+   q0407_o1: A メインストリート
+   q0407_o2: B 一方通行の道路
+   q0407_o3: D 交通量が多い道路
+   q0407_o4: C 二車線の一方通行道路
```

### q0734

```diff
+ qid: q0734
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.35.png
+ localeOptionOrder:
+   A: A 排水路 (A Drainage ditch)
+   B: B 用水路 (B Irrigation canal)
+   C: C 橋 (C Bridge)
+   D: D トンネル (D Tunnel)
+ options:
+   q0734_o1: A 排水路
+   q0734_o2: C 橋
+   q0734_o3: D トンネル
+   q0734_o4: B 用水路
```

### q0744

```diff
+ qid: q0744
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この路面の標示はなにを示すか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.38.png
+ localeOptionOrder:
+   A: A 最低速度は80km/hである (A. The minimum speed is 80 km/h)
+   B: B 平均速度は80km/hである (B. The average speed is 80 km/h)
+   C: C 80km/hの速度制限を解除する (C. The 80 km/h speed limit is canceled)
+   D: D 最高速度は80km/hである (D. The maximum speed is 80 km/h)
+ options:
+   q0744_o1: A 最低速度は80km/hである
+   q0744_o2: B 平均速度は80km/hである
+   q0744_o3: D 最高速度は80km/hである
+   q0744_o4: C 80km/hの速度制限を解除する
```

### q0783

```diff
+ qid: q0783
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.09 1.png
+ localeOptionOrder:
+   A: A 番をする人がいる踏切まで150メートル (A: 150 meters to a level crossing with an attendant)
+   B: B 番をする人がいない踏切まで150メートル (B: 150 meters to a level crossing without an attendant)
+   C: C 番をする人がいない踏切まで100メートル (C: 100 meters to a level crossing without an attendant)
+   D: D 番をする人がいる踏切まで100メートル (D: 100 meters to a level crossing with an attendant)
+ options:
+   q0783_o1: B 番をする人がいない踏切まで150メートル
+   q0783_o2: C 番をする人がいない踏切まで100メートル
+   q0783_o3: D 番をする人がいる踏切まで100メートル
+   q0783_o4: A 番をする人がいる踏切まで150メートル
```

### q0066

```diff
+ qid: q0066
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車を発進させる前に、周囲の交通状況を観察して安全を確認しなければならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.10.png
```

### q0711

```diff
+ qid: q0711
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.11 1.png
+ localeOptionOrder:
+   A: A 下り左急勾配あり (A. Steep downhill to the left)
+   B: B 上より右急勾配あり (B. Steep uphill to the right)
+   C: C 左側通行 (C. Keep left)
+   D: D つづら折りあり (D. Hairpin curve ahead)
+ options:
+   q0711_o1: A 下り左急勾配あり
+   q0711_o2: D つづら折りあり
+   q0711_o3: C 左側通行
+   q0711_o4: B 上より右急勾配あり
```

### q0872

```diff
+ qid: q0872
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.11.png
+ localeOptionOrder:
+   A: A 左側通行 (A: Keep left)
+   B: B 右側通行 (B: Keep right)
+   C: C 両側通行 (C: Keep to both sides)
+   D: D 通行止め (D: No entry)
+ options:
+   q0872_o1: C 両側通行
+   q0872_o2: D 通行止め
+   q0872_o3: A 左側通行
+   q0872_o4: B 右側通行
```

### q0326

```diff
+ qid: q0326
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 運転者は免許を遺失しても3ヶ月以内ならば自動車を運転することができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.13 1.png
```

### q0280

```diff
+ qid: q0280
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 走行速度が規定時速の50％超過した運転者には3点が減点されるつく。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.13.png
```

### q0859

```diff
+ qid: q0859
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 図が示す円中の鋸の歯型をした白い実線は、なにを示す路面標示か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.21.png
+ localeOptionOrder:
+   A: A 方向を導く標示 (A. Direction guidance marking)
+   B: B 左折を待つエリア (B. Area to wait for left turn)
+   C: C 車線変更が可能な方向を導く標示 (C. Direction guidance marking for possible lane change)
+   D: D 一方通行標示 (D. One-way street marking)
+ options:
+   q0859_o1: B 左折を待つエリア
+   q0859_o2: A 方向を導く標示
+   q0859_o3: C 車線変更が可能な方向を導く標示
+   q0859_o4: D 一方通行標示
```

### q0809

```diff
+ qid: q0809
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.26 1.png
+ localeOptionOrder:
+   A: A N形カーブあり (A: N-shaped curve ahead)
+   B: B 急勾配あり (B: Steep slope ahead)
+   C: C 背向屈折あり (C: Reverse bend ahead)
+   D: D つづら折りあり (D: Switchback (zigzag) ahead)
+ options:
+   q0809_o1: B 急勾配あり
+   q0809_o2: A N形カーブあり
+   q0809_o3: C 背向屈折あり
+   q0809_o4: D つづら折りあり
```

### q0882

```diff
+ qid: q0882
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.27.png
+ localeOptionOrder:
+   A: A 国道番号 (A National highway number)
+   B: B 省道番号 (B Provincial road number)
+   C: C 県道番号 (C Prefectural road number)
+   D: D 郷道番号 (D Village road number)
+ options:
+   q0882_o1: B 省道番号
+   q0882_o2: A 国道番号
+   q0882_o3: D 郷道番号
+   q0882_o4: C 県道番号
```

### q0738

```diff
+ qid: q0738
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.28.png
+ localeOptionOrder:
+   A: A 国道番号 (A National road number)
+   B: B 省道番号 (B Provincial road number)
+   C: C 県道番号 (C Prefectural road number)
+   D: D 郷道番号 (D Local road number)
+ options:
+   q0738_o1: C 県道番号
+   q0738_o2: D 郷道番号
+   q0738_o3: B 省道番号
+   q0738_o4: A 国道番号
```

### q0449

```diff
+ qid: q0449
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 偽造・変造されたナンバープレートを使用した場合、何点減点されるかがつくか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.29.png
+ localeOptionOrder:
+   A: A 2点 (A. 2 points)
+   B: B 3点 (B. 3 points)
+   C: C 6点 (C. 6 points)
+   D: D 12点 (D. 12 points)
+ options:
+   q0449_o1: A 2点
+   q0449_o2: B 3点
+   q0449_o3: D 12点
+   q0449_o4: C 6点
```

### q0223

```diff
+ qid: q0223
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 運転者が交通事故を起こしたあと逃走した場合、免許証が取消しとなり、生涯再取得不可能となる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.36.png
```

### q0842

```diff
+ qid: q0842
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.37 1.png
+ localeOptionOrder:
+   A: A ここから40メートル減速区間 (A: Deceleration section from here for 40 meters)
+   B: B 最低時速40キロメートル (B: Minimum speed 40 kilometers per hour)
+   C: C 時速制限40キロメートルの解除 (C: End of 40 km/h speed limit)
+   D: D 最高時速40キロメートル (D: Maximum speed 40 kilometers per hour)
+ options:
+   q0842_o1: A ここから40メートル減速区間
+   q0842_o2: B 最低時速40キロメートル
+   q0842_o3: D 最高時速40キロメートル
+   q0842_o4: C 時速制限40キロメートルの解除
```

### q0669

```diff
+ qid: q0669
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識は作を示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.07.png
+ localeOptionOrder:
+   A: A 直進禁止 (A. No going straight)
+   B: B Uターン禁止 (B. No U-turn)
+   C: C 車線変更禁止 (C. No lane changing)
+   D: D 左折禁止 (D. No left turn)
+ options:
+   q0669_o1: C 車線変更禁止
+   q0669_o2: D 左折禁止
+   q0669_o3: A 直進禁止
+   q0669_o4: B Uターン禁止
```

### q0054

```diff
+ qid: q0054
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 路上を運転するさいは、規定の速度を守り安全運転すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.12.png
```

### q0141

```diff
+ qid: q0141
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: 運転中、バス停に停まるバスに近づくさい、バスの急発進や通行人がバスの前に飛び出すことを防ぐため、どう対応するのが適切か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.17 1.png
+ localeOptionOrder:
+   A: A 減速して十分な車間距離をとり、いつでも停車できるよう準備する (A: Slow down, keep a safe distance, and be prepared to stop at any time.)
+   B: B 通常速度で運転する (B: Drive at normal speed.)
+   C: C いつでもブレーキをかけられるよう準備する (C: Be prepared to brake at any time.)
+   D: D クラクションを鳴らし注意をしながら、加速して通過する (D: Sound the horn for caution and pass while accelerating.)
+ options:
+   q0141_o1: A 減速して十分な車間距離をとり、いつでも停車できるよう準備する
+   q0141_o2: B 通常速度で運転する
+   q0141_o3: D クラクションを鳴らし注意をしながら、加速して通過する
+   q0141_o4: C いつでもブレーキをかけられるよう準備する
```

### q0631

```diff
+ qid: q0631
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: この位置に自動車が走行している場合、前輪が停車ラインを超えていれば走行し続けてもよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.18.png
```

### q0334

```diff
+ qid: q0334
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: この道路ではクラクションを鳴らす頻度を減らさ下げなくてはならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.23.png
```

### q0269

```diff
+ qid: q0269
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 夜間に狭い道や狭い橋で対向車とすれ違う場合、ハイビームランプをつける。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.30.png
```

### q0550

```diff
+ qid: q0550
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: エンジンキーがONの位置にいる場合、車用電気を使ってはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.32.png
```

### q0050

```diff
+ qid: q0050
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 夜間の走行では追い越しをできるだけ避け、必要があればライトの上下切り換えで前車に合図をしてもよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.34 1.png
```

### q0086

```diff
+ qid: q0086
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 山道で坂を下る場合、追い越しをしてはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.06.37.png
```

