# Full-Batch Dry-Run Merge Review: ja batch-012

- Dataset: `2023-test1`
- Auto-matched items: 10
- Reviewed items: 39
- Equivalent overlaps: 0
- Final total: 49
- Ready for merge: 49
- Blockers: 0
- Safe to merge next step: yes
- Full preview: `qbank-tools/generated/staging/translations.ja.batch-012.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ja.batch-012.full.merge-dry-run.json`

## Diff Summary

### q0388

```diff
+ qid: q0388
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 急カーブを通る場合の自動車の最高速度はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.04.png
+ localeOptionOrder:
+   A: A 20km/h (A 20 km/h)
+   B: B 30km/h (B 30 km/h)
+   C: C 40km/h (C 40 km/h)
+   D: D 50km/h (D 50 km/h)
+ options:
+   q0388_o1: A 20km/h
+   q0388_o2: B 30km/h
+   q0388_o3: C 40km/h
+   q0388_o4: D 50km/h
```

### q0272

```diff
+ qid: q0272
+ sourceBucket: reviewed
+ type: ROW
+ prompt: この区間では、非自動車専用車線車線に一時駐車ができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.06.png
```

### q0120

```diff
+ qid: q0120
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 運転中、非自動車が停車中の自動車を避けようとしている場合、どう対応するのが適切か。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.07.png
+ localeOptionOrder:
+   A: A クラクションを鳴らし、道を譲らせる (A. Honk the horn and make them yield the road)
+   B: B 走行優先権を非自動車に譲る (B. Yield the right of way to the non-motor vehicle)
+   C: C 加速して非自動車を避ける (C. Accelerate and avoid the non-motor vehicle)
+   D: D 非自動車の後ろにつき、クラクションを鳴らす (D. Follow behind the non-motor vehicle and honk the horn)
+ options:
+   q0120_o1: A クラクションを鳴らし、道を譲らせる
+   q0120_o2: B 走行優先権を非自動車に譲る
+   q0120_o3: C 加速して非自動車を避ける
+   q0120_o4: D 非自動車の後ろにつき、クラクションを鳴らす
```

### q0295

```diff
+ qid: q0295
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 免許証を一時没収されている人に自動車を渡して運転させた場合、交通警察は口頭で警告する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.08.png
```

### q0206

```diff
+ qid: q0206
+ sourceBucket: reviewed
+ type: ROW
+ prompt: ナンバープレートが損傷した場合、自動車所有者は登録地の車両管理所に自動車走行許可証の再交付・更新を申請しなければならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.09 1.png
```

### q0729

```diff
+ qid: q0729
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 踏切でこの信号が点灯している場合、どう走行すべきか〇
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.09.png
+ localeOptionOrder:
+   A: A 観察しながら徐行して通過する (A: Pass slowly while observing)
+   B: B ギアを変えずに加速して通過する (B: Accelerate through without changing gears)
+   C: C 電車が来る前に通過する (C: Cross before the train comes)
+   D: D 停止線を越えてはならない (D: Do not cross the stop line)
+ options:
+   q0729_o1: C 電車が来る前に通過する
+   q0729_o2: D 停止線を越えてはならない
+   q0729_o3: A 観察しながら徐行して通過する
+   q0729_o4: B ギアを変えずに加速して通過する
```

### q0202

```diff
+ qid: q0202
+ sourceBucket: reviewed
+ type: ROW
+ prompt: この交差点でUターンしてもよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.10.png
```

### q0791

```diff
+ qid: q0791
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.11.png
+ localeOptionOrder:
+   A: A 進行方向別通行区分 (A: Lane for each direction)
+   B: B 右折車線 (B: Right turn lane)
+   C: C Uターン車線 (C: U-turn lane)
+   D: D 左折車線 (D: Left turn lane)
+ options:
+   q0791_o1: B 右折車線
+   q0791_o2: C Uターン車線
+   q0791_o3: D 左折車線
+   q0791_o4: A 進行方向別通行区分
```

### q0833

```diff
+ qid: q0833
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 交差点最先端の二本の白い破線は、なにを示すか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.12.png
+ localeOptionOrder:
+   A: A 青信号に変わるの待機する標示 (A: Markings for waiting for the light to turn green)
+   B: B 停車し、道を譲る標示 (B: Markings to stop and yield)
+   C: C 減速し、道を譲る標示 (C: Markings to slow down and yield)
+   D: D 左折待機標示 (D: Markings for waiting to turn left)
+ options:
+   q0833_o1: A 青信号に変わるの待機する標示
+   q0833_o2: B 停車し、道を譲る標示
+   q0833_o3: C 減速し、道を譲る標示
+   q0833_o4: D 左折待機標示
```

### q0828

```diff
+ qid: q0828
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この路面標示はなにか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.13.png
+ localeOptionOrder:
+   A: A 横断歩道予告 (A: Pedestrian crossing ahead)
+   B: B 交差点予告 (B: Intersection ahead)
+   C: C 減速して道を譲る予告 (C: Yield ahead (slow down to yield))
+   D: D 停車して道を譲る予告 (D: Yield ahead (stop to yield))
+ options:
+   q0828_o1: A 横断歩道予告
+   q0828_o2: B 交差点予告
+   q0828_o3: C 減速して道を譲る予告
+   q0828_o4: D 停車して道を譲る予告
```

### q0396

```diff
+ qid: q0396
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: ぬかるんだ道路を運転する場合の自動車の最高速度はどれか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.14 1.png
+ localeOptionOrder:
+   A: A 15km/h (A 15 km/h)
+   B: B 20km/h (B 20 km/h)
+   C: C 30km/h (C 30 km/h)
+   D: D 40km/h (D 40 km/h)
+ options:
+   q0396_o1: A 15km/h
+   q0396_o2: B 20km/h
+   q0396_o3: D 40km/h
+   q0396_o4: C 30km/h
```

### q0027

```diff
+ qid: q0027
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 踏み切りでは、低いギアに入れて通過しエンストを防ぐため途中でギアチェンジをしてはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.15.png
```

### q0189

```diff
+ qid: q0189
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような状況では、加速して踏み切りを通過しなければならな。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.17.png
```

### q0843

```diff
+ qid: q0843
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.18.png
+ localeOptionOrder:
+   A: A 左側を走行せよ (A Drive on the left side)
+   B: B 左折のみ可 (B Left turn only allowed)
+   C: C 左側に下り勾配あり (C There is a downward slope on the left side)
+   D: D 道路の左側に寄り停車せよ (D Pull over and stop on the left side of the road)
+ options:
+   q0843_o1: D 道路の左側に寄り停車せよ
+   q0843_o2: C 左側に下り勾配あり
+   q0843_o3: B 左折のみ可
+   q0843_o4: A 左側を走行せよ
```

### q0099

```diff
+ qid: q0099
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 走行時にタイヤの空気漏れを発見し車線を離れる場合、横転や後続車からの追突を避けるため、急ブレーキをかけてはならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.20.png
```

### q0288

```diff
+ qid: q0288
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 狭い道や狭い橋を通る場合、自動車の最高速度は30km/hを超過してはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.21.png
```

### q0024

```diff
+ qid: q0024
+ sourceBucket: reviewed
+ type: ROW
+ prompt: アイスバーン上や雪路を走行する場合、積雪にAが反射するため目が眩み錯覚を起こしやすい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.23 1.png
```

### q0667

```diff
+ qid: q0667
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.23.png
+ localeOptionOrder:
+   A: A 歩行者注意 (A. Watch out for pedestrians)
+   B: B 横断歩道あり (B. Pedestrian crossing ahead)
+   C: C 村や町あり (C. Village or town ahead)
+   D: D 小学校あり (D. Elementary school ahead)
+ options:
+   q0667_o1: A 歩行者注意
+   q0667_o2: B 横断歩道あり
+   q0667_o3: C 村や町あり
+   q0667_o4: D 小学校あり
```

### q0123

```diff
+ qid: q0123
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 山道で対向車に遭った場合、どうすれ違うのが適切か。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.24.png
+ localeOptionOrder:
+   A: A 減速しない (A. Do not slow down)
+   B: B 道路の中央に寄る (B. Move toward the center of the road)
+   C: C 加速する (C. Accelerate)
+   D: D 減速または停止して道を譲る (D. Slow down or stop and yield the way)
+ options:
+   q0123_o1: A 減速しない
+   q0123_o2: B 道路の中央に寄る
+   q0123_o3: C 加速する
+   q0123_o4: D 減速または停止して道を譲る
```

### q0420

```diff
+ qid: q0420
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 運転者は免許証有効期間が切れる前、どの期間から免許更新を申請できるか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.26.png
+ localeOptionOrder:
+   A: A 有効期間の切れる30日以内 (A: Within 30 days before expiration)
+   B: B 有効期間の切れる60日以内 (B: Within 60 days before expiration)
+   C: C 有効期間の切れる90日以内 (C: Within 90 days before expiration)
+   D: D 有効期間の切れる6ヶ月以内 (D: Within 6 months before expiration)
+ options:
+   q0420_o1: B 有効期間の切れる60日以内
+   q0420_o2: A 有効期間の切れる30日以内
+   q0420_o3: C 有効期間の切れる90日以内
+   q0420_o4: D 有効期間の切れる6ヶ月以内
```

### q0691

```diff
+ qid: q0691
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この白い長方形はなにを示す標示か。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.27.png
+ localeOptionOrder:
+   A: A タクシー専用の乗客乗降用駐車エリア (A. Taxi-exclusive passenger boarding/alighting parking area)
+   B: B 平行駐車 (B. Parallel parking)
+   C: C 斜め駐車 (C. Diagonal parking)
+   D: D 直角駐車 (D. Perpendicular parking)
+ options:
+   q0691_o1: A タクシー専用の乗客乗降用駐車エリア
+   q0691_o2: B 平行駐車
+   q0691_o3: D 直角駐車
+   q0691_o4: C 斜め駐車
```

### q0304

```diff
+ qid: q0304
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような状況では、交差点で優先通行権を持っている。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.29.png
```

### q0549

```diff
+ qid: q0549
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 左ウィンカーを出すとが点滅する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.30.png
```

### q0578

```diff
+ qid: q0578
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この操縦装置は何か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.31 1.png
+ localeOptionOrder:
+   A: A スロットル・レバー (Throttle lever)
+   B: B パーキングブレーキ・レバー (Parking brake lever)
+   C: C 変速レバー (Gear lever)
+   D: D クラッチ・レバー (Clutch lever)
+ options:
+   q0578_o1: B パーキングブレーキ・レバー
+   q0578_o2: A スロットル・レバー
+   q0578_o3: C 変速レバー
+   q0578_o4: D クラッチ・レバー
```

### q0217

```diff
+ qid: q0217
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 不正改造車不法にパーツを組み合わせて作った車であっても、安全だと認められれば路上で運転することが出来る。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.32.png
```

### q0867

```diff
+ qid: q0867
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.33.png
+ localeOptionOrder:
+   A: A 直進・左折禁止 (A No going straight or turning left)
+   B: B 直進禁止・左へ車線変更禁止 (B No going straight; no lane change to the left)
+   C: C 直進・左折可 (C Going straight and turning left allowed)
+   D: D 直進と右折禁止をしてはいけない (D You must not prohibit going straight and turning right)
+ options:
+   q0867_o1: B 直進禁止・左へ車線変更禁止
+   q0867_o2: A 直進・左折禁止
+   q0867_o3: C 直進・左折可
+   q0867_o4: D 直進と右折禁止をしてはいけない
```

### q0672

```diff
+ qid: q0672
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.34 1.png
+ localeOptionOrder:
+   A: A トンネルの出口までの距離 (A. Distance to the tunnel exit)
+   B: B トンネルの入口までの距離 (B. Distance to the tunnel entrance)
+   C: C トンネル内での車間距離 (C. Following distance inside the tunnel)
+   D: D トンネルの総延長 (D. Total length of the tunnel)
+ options:
+   q0672_o1: A トンネルの出口までの距離
+   q0672_o2: B トンネルの入口までの距離
+   q0672_o3: C トンネル内での車間距離
+   q0672_o4: D トンネルの総延長
```

### q0511

```diff
+ qid: q0511
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 夜間に追い越しをしようとする場合、自動車のライトをどのように使うのが正しいか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.34.png
+ localeOptionOrder:
+   A: A ヘッドランプを上向きや下向きに切り替える (A. Switch the headlights between high and low beam)
+   B: B フォグランプをつける (B. Turn on the fog lights)
+   C: C ヘッドランプを上向きにする (C. Set the headlights to high beam)
+   D: D ヘッドランプを消す (D. Turn off the headlights)
+ options:
+   q0511_o1: D ヘッドランプを消す
+   q0511_o2: C ヘッドランプを上向きにする
+   q0511_o3: B フォグランプをつける
+   q0511_o4: A ヘッドランプを上向きや下向きに切り替える
```

### q0649

```diff
+ qid: q0649
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 踏切で二つの赤信号が交互に点滅している場合、停車して待つべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.35.png
```

### q0461

```diff
+ qid: q0461
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 法律に基づき交通警察が路上で運転している車両を拘置することができるのは、どれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.36.png
+ localeOptionOrder:
+   A: A ナンバープレートが取り付けられていない (A. The license plate is not attached.)
+   B: B 運転者が身分証明書を携帯していない (B. The driver does not carry identification.)
+   C: C 運転者が自動車保険契約書を携帯していない (C. The driver does not carry the automobile insurance contract.)
+   D: D エコマークを表示していない (D. There is no eco-mark displayed.)
+ options:
+   q0461_o1: A ナンバープレートが取り付けられていない
+   q0461_o2: D エコマークを表示していない
+   q0461_o3: C 運転者が自動車保険契約書を携帯していない
+   q0461_o4: B 運転者が身分証明書を携帯していない
```

### q0156

```diff
+ qid: q0156
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 凹凸のある路面を通過する場合、どうするのが適切か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.37 1.png
+ localeOptionOrder:
+   A: A 低速で徐行し、穏やかに通過する (A. Go slowly at low speed and pass over gently)
+   B: B 慣性に頼り、加速して猛進する (B. Rely on inertia and speed up, rushing through)
+   C: C ギアをニュートラルにし、滑走して通過する (C. Shift to neutral and coast through)
+   D: D 元の速度を維持し通過する (D. Maintain your original speed and pass through)
+ options:
+   q0156_o1: B 慣性に頼り、加速して猛進する
+   q0156_o2: C ギアをニュートラルにし、滑走して通過する
+   q0156_o3: D 元の速度を維持し通過する
+   q0156_o4: A 低速で徐行し、穏やかに通過する
```

### q0594

```diff
+ qid: q0594
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車のインパネの点滅は、何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.37.png
+ localeOptionOrder:
+   A: A フロント・リアサイドランプの点灯 (A: Front and rear side lamp on)
+   B: B 右ウインカーの点滅 (B: Right turn signal blinking)
+   C: C 左ウインカーの点滅 (C: Left turn signal blinking)
+   D: D 車幅燈の点灯 (D: Width lamp on)
+ options:
+   q0594_o1: C 左ウインカーの点滅
+   q0594_o2: A フロント・リアサイドランプの点灯
+   q0594_o3: D 車幅燈の点灯
+   q0594_o4: B 右ウインカーの点滅
```

### q0271

```diff
+ qid: q0271
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車が路上で軽微な交通事故を起こし、かつ交通の妨げとなる場合であっても移動する必要は、ない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.38.png
```

### q0427

```diff
+ qid: q0427
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このような状況に遭遇した場合、どうすべきか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.39.png
+ localeOptionOrder:
+   A: A 歩行者の前方へ回り通過する (A. Go around in front of the pedestrians and pass)
+   B: B 停車して歩行者に道をゆずる (B. Stop and yield to the pedestrians)
+   C: C クラクションを鳴らして歩行者に合図をする (C. Sound the horn to signal to the pedestrians)
+   D: D 歩行者の後方へ回り通過する (D. Go around behind the pedestrians and pass)
+ options:
+   q0427_o1: B 停車して歩行者に道をゆずる
+   q0427_o2: A 歩行者の前方へ回り通過する
+   q0427_o3: C クラクションを鳴らして歩行者に合図をする
+   q0427_o4: D 歩行者の後方へ回り通過する
```

### q0040

```diff
+ qid: q0040
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 高速道路のランプで時速を60km/h以上にすれば、直接走行車線に入ることができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.41.png
```

### q0146

```diff
+ qid: q0146
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 水浸しの道路が通行しにくい原因は何か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/500.png
+ localeOptionOrder:
+   A: A 路面の凹凸状況が観察できない (A The surface bumps and dents cannot be observed)
+   B: B 路面付着力が増す (B Road adhesion increases)
+   C: C 視界が悪くぼやける (C Visibility becomes poor and blurry)
+   D: D 日光の反射により視界が妨げられる (D Visibility is impaired by sunlight reflection)
+ options:
+   q0146_o1: B 路面付着力が増す
+   q0146_o2: A 路面の凹凸状況が観察できない
+   q0146_o3: C 視界が悪くぼやける
+   q0146_o4: D 日光の反射により視界が妨げられる
```

### q0312

```diff
+ qid: q0312
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 一計算周期で交通違反による累積点数が12点となったる場合、交通警察は法律に基づき免許証を押収することができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.12 1.png
```

### q0414

```diff
+ qid: q0414
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 前方の交差点のこの信号は、なにを示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.18 1.png
+ localeOptionOrder:
+   A: A 注意して進め (A Proceed with caution)
+   B: B 通行禁止 (B No entry)
+   C: C 通行許可 (C Passage allowed)
+   D: D 注意喚起 (D Warning)
+ options:
+   q0414_o1: C 通行許可
+   q0414_o2: A 注意して進め
+   q0414_o3: D 注意喚起
+   q0414_o4: B 通行禁止
```

### q0767

```diff
+ qid: q0767
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.20 1.png
+ localeOptionOrder:
+   A: A 事故多発区間 (A: Area with frequent accidents)
+   B: B 減速徐行 (B: Slow down)
+   C: C 危険に注意 (C: Caution: Danger)
+   D: D 渋滞区間 (D: Congestion area)
+ options:
+   q0767_o1: B 減速徐行
+   q0767_o2: C 危険に注意
+   q0767_o3: D 渋滞区間
+   q0767_o4: A 事故多発区間
```

### q0001

```diff
+ qid: q0001
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: ぬかるんだ道路でブレーキをかけると、車輪が横滑りや斜め滑りを起こすため、交通事故を引き起こしやすくなる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.05 1.png
```

### q0343

```diff
+ qid: q0343
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 追い越しをした後、すぐ右ウィンカーを出し、元の車道に戻るべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.05.png
```

### q0336

```diff
+ qid: q0336
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 自動車が建物や公共施設に衝突したあと、運転者はただちに現場から離れてよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.14.png
```

### q0019

```diff
+ qid: q0019
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 狭い道路で車両とすれ違う場合、先に減速、先に ゆずる、先に止まるという「三つの先」を実践す べきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.19.png
```

### q0662

```diff
+ qid: q0662
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.22.png
+ localeOptionOrder:
+   A: A 高速道路ETC通路 (Expressway ETC lane)
+   B: B 高速道路料金所車線 (Expressway tollgate lane)
+   C: C 高速道路検査車線 (Expressway inspection lane)
+   D: D 高速道路カード受領車線 (Expressway card receiving lane)
+ options:
+   q0662_o1: B 高速道路料金所車線
+   q0662_o2: C 高速道路検査車線
+   q0662_o3: D 高速道路カード受領車線
+   q0662_o4: A 高速道路ETC通路
```

### q0642

```diff
+ qid: q0642
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 赤い自動車はこの車線を走行することができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.25.png
```

### q0632

```diff
+ qid: q0632
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 交差点のこの信号は自動車の通行禁止を示している。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.28 1.png
```

### q0149

```diff
+ qid: q0149
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: 高速道路の料金所に入る場合、どの入口を選ぶべきか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.28.png
+ localeOptionOrder:
+   A: A 車両が多い (A. There are many vehicles)
+   B: B 赤信号がついている (B. The red light is on)
+   C: C サービスが一時停止中 (C. The service is temporarily stopped)
+   D: D 青信号がついている (D. The green light is on)
+ options:
+   q0149_o1: A 車両が多い
+   q0149_o2: B 赤信号がついている
+   q0149_o3: D 青信号がついている
+   q0149_o4: C サービスが一時停止中
```

### q0246

```diff
+ qid: q0246
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 自動車のドアを開ける場合、他の車両や歩行者の通行を妨害してはならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.31.png
```

### q0402

```diff
+ qid: q0402
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: このような交差点では、どのようにしてリターンするのが適切か。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.19.40.png
+ localeOptionOrder:
+   A: A 横断歩道でUターンする (A. Make a U-turn at the crosswalk)
+   B: B 交差点に進入してUターンする (B. Enter the intersection and make a U-turn)
+   C: C 右側の車線からUターンする (C. Make a U-turn from the right lane)
+   D: D 中心線の破線からUターンする (D. Make a U-turn from the broken center line)
+ options:
+   q0402_o1: D 中心線の破線からUターンする
+   q0402_o2: C 右側の車線からUターンする
+   q0402_o3: B 交差点に進入してUターンする
+   q0402_o4: A 横断歩道でUターンする
```

