# Full-Batch Dry-Run Merge Review: ja batch-020

- Dataset: `2023-test1`
- Auto-matched items: 9
- Reviewed items: 41
- Equivalent overlaps: 0
- Final total: 50
- Ready for merge: 49
- Blockers: 1
- Safe to merge next step: no
- Full preview: `qbank-tools/generated/staging/translations.ja.batch-020.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ja.batch-020.full.merge-dry-run.json`

## Blockers

- `q0582` [reviewed]: answerKeyDecisionConsistent, answerKeyReady

## Diff Summary

### q0670

```diff
+ qid: q0670
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.22.png
+ localeOptionOrder:
+   A: A 直進通行 (A. Straight-through traffic)
+   B: B 左折車線 (B. Left-turn lane)
+   C: C 右折車線 (C. Right-turn lane)
+   D: D 進行方向別通行区分 (D. Lanes divided by direction of travel)
+ options:
+   q0670_o1: B 左折車線
+   q0670_o2: A 直進通行
+   q0670_o3: C 右折車線
+   q0670_o4: D 進行方向別通行区分
```

### q0229

```diff
+ qid: q0229
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような状況であれば、右側から追い越しをしてよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.23 1.png
```

### q0737

```diff
+ qid: q0737
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.23.png
+ localeOptionOrder:
+   A: A 直進・左折車線 (A: Lane for going straight and turning left)
+   B: B 左折およびUターン禁止車線 (B: Lane where left turn and U-turn are prohibited)
+   C: C Uターン・左折車線 (C: Lane for U-turns and left turns)
+   D: D 進行方向別通行区分 (D: Traffic direction separation)
+ options:
+   q0737_o1: D 進行方向別通行区分
+   q0737_o2: C Uターン・左折車線
+   q0737_o3: B 左折およびUターン禁止車線
+   q0737_o4: A 直進・左折車線
```

### q0565

```diff
+ qid: q0565
+ sourceBucket: reviewed
+ type: ROW
+ prompt: アオグランプのスイッチをオンにするとが点灯する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.25 1.png
```

### q0451

```diff
+ qid: q0451
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 前方の交差点のこの信号は、なにを示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.25.png
+ localeOptionOrder:
+   A: A 注意して進め (A. Proceed with caution)
+   B: B 速度を上げ直進 (B. Increase speed and go straight)
+   C: C 速度を上げ左折 (C. Increase speed and turn left)
+   D: D 右折禁止 (D. No right turn)
+ options:
+   q0451_o1: C 速度を上げ左折
+   q0451_o2: D 右折禁止
+   q0451_o3: A 注意して進め
+   q0451_o4: B 速度を上げ直進
```

### q0752

```diff
+ qid: q0752
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.26.png
+ localeOptionOrder:
+   A: A 重量制限40トン (A. Weight limit 40 tons)
+   B: B 最高時速40キロメートル (B. Maximum speed 40 km/h)
+   C: C この先40メートルから速度制限あり (C. Speed limit starts 40 meters ahead)
+   D: D 最低時速40キロメートル (D. Minimum speed 40 km/h)
+ options:
+   q0752_o1: C この先40メートルから速度制限あり
+   q0752_o2: D 最低時速40キロメートル
+   q0752_o3: A 重量制限40トン
+   q0752_o4: B 最高時速40キロメートル
```

### q0714

```diff
+ qid: q0714
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は次のなかのどの種類に属しますか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.27.png
+ localeOptionOrder:
+   A: A 警戒標識 (A Warning sign)
+   B: B 規制標識 (B Regulatory sign)
+   C: C 指示標識 (C Instruction sign)
+   D: D 案内標識 (D Guidance sign)
+ options:
+   q0714_o1: A 警戒標識
+   q0714_o2: D 案内標識
+   q0714_o3: B 規制標識
+   q0714_o4: C 指示標識
```

### q0754

```diff
+ qid: q0754
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.28.png
+ localeOptionOrder:
+   A: A 立体交差直進および右折 (A: Go straight at intersection and turn right)
+   B: B 立体交差直進および左折 (B: Go straight at intersection and turn left)
+   C: C 直進および左折 (C: Go straight and turn left)
+   D: D 直進および右折 (D: Go straight and turn right)
+ options:
+   q0754_o1: B 立体交差直進および左折
+   q0754_o2: A 立体交差直進および右折
+   q0754_o3: C 直進および左折
+   q0754_o4: D 直進および右折
```

### q0172

```diff
+ qid: q0172
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 山道で追い越しをしようとする場合、どうすればよいか○
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.30.png
+ localeOptionOrder:
+   A: A なだらかな下り坂を選ぶ (A. Choose a gentle downhill slope)
+   B: B いかなる機会を利用してでも追い越す (B. Attempt to overtake at any opportunity)
+   C: C 広くてなだらかな登り坂を選ぶ (C. Choose a wide and gentle uphill slope)
+   D: D 長い下り坂を選ぶ (D. Choose a long downhill slope)
+ options:
+   q0172_o1: B いかなる機会を利用してでも追い越す
+   q0172_o2: C 広くてなだらかな登り坂を選ぶ
+   q0172_o3: D 長い下り坂を選ぶ
+   q0172_o4: A なだらかな下り坂を選ぶ
```

### q0400

```diff
+ qid: q0400
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このカーブを走行する場合の最高速度はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.31 1.png
+ localeOptionOrder:
+   A: A 30km/h (30km/h)
+   B: B 40km/h (40km/h)
+   C: C 50km/h (50km/h)
+   D: D 70km/h (70km/h)
+ options:
+   q0400_o1: B 40km/h
+   q0400_o2: A 30km/h
+   q0400_o3: C 50km/h
+   q0400_o4: D 70km/h
```

### q0063

```diff
+ qid: q0063
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 夜間走行は、運転者の視界が悪くなるため道路状況を把握しにくくなり、また注意力を集中させなければいけないため疲れやすい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.31.png
```

### q0088

```diff
+ qid: q0088
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 走行中タイヤがバーストした場合、慌てて急ブレーキをかけるのではなく、ギアをローに入れエンジンブレーキを利用し減速をはかるべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.34 1.png
```

### q0364

```diff
+ qid: q0364
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この交差点はどう通るのが適切か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.34.png
+ localeOptionOrder:
+   A: A クラクションを鳴らして催促する (A. Honk the horn to urge people)
+   B: B 速度を維持して走行する (B. Maintain your speed)
+   C: C 速度を落として徐行する (C. Slow down and proceed slowly)
+   D: D 速度を上げて通る (D. Increase your speed and pass through)
+ options:
+   q0364_o1: B 速度を維持して走行する
+   q0364_o2: A クラクションを鳴らして催促する
+   q0364_o3: C 速度を落として徐行する
+   q0364_o4: D 速度を上げて通る
```

### q0582

```diff
+ qid: q0582
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この操作装置は何か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.35.png
+ localeOptionOrder:
+   A: A ミストワイパー・スイッチ (A Mist wiper switch)
+   B: B ウインカー・スイッチ (B Turn signal switch)
+   C: C ヘッドランプ・スイッチ (C Headlamp switch)
+   D: D ワイパー・スイッチ (D Wiper switch)
+ options:
+   q0582_o1: B ウインカー・スイッチ
+   q0582_o2: C ヘッドランプ・スイッチ
+   q0582_o3: D ワイパー・スイッチ
+   q0582_o4: A ミストワイパー・スイッチ
```

### q0459

```diff
+ qid: q0459
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車が路上で故障し、停車して修理する必要がある場合、運転者は何をすべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.36 1.png
+ localeOptionOrder:
+   A: A その場で修理し修理する (A: Repair the car on the spot)
+   B: B ロービームヘッドランプまたはフォグランプをつける (B: Turn on the low beam headlights or fog lights)
+   C: C 交通を妨害しない場所に停車する (C: Stop at a place that does not obstruct traffic)
+   D: D 道路の中央部に停車する (D: Stop in the middle of the road)
+ options:
+   q0459_o1: D 道路の中央部に停車する
+   q0459_o2: C 交通を妨害しない場所に停車する
+   q0459_o3: B ロービームヘッドランプまたはフォグランプをつける
+   q0459_o4: A その場で修理し修理する
```

### q0482

```diff
+ qid: q0482
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 雪道・凍結路を運転する場合の自動車の最高速度はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.36.png
+ localeOptionOrder:
+   A: A 20km/h (20 km/h)
+   B: B 30km/h (30 km/h)
+   C: C 40km/h (40 km/h)
+   D: D 50km/h (50 km/h)
+ options:
+   q0482_o1: D 50km/h
+   q0482_o2: C 40km/h
+   q0482_o3: B 30km/h
+   q0482_o4: A 20km/h
```

### q0183

```diff
+ qid: q0183
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 「学校・幼稚園・保育所等あり」の道路標識があった場合、どう対応するのが適切か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.37.png
+ localeOptionOrder:
+   A: A 加速して運転する (A. Accelerate and drive)
+   B: B 児童に道を譲って運転する (B. Yield the road to children and drive)
+   C: C 慎重に走行速度を選ぶ (C. Carefully choose your driving speed)
+   D: D 通常速度で運転する (D. Drive at normal speed)
+ options:
+   q0183_o1: A 加速して運転する
+   q0183_o2: B 児童に道を譲って運転する
+   q0183_o3: D 通常速度で運転する
+   q0183_o4: C 慎重に走行速度を選ぶ
```

### q0630

```diff
+ qid: q0630
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: スイッチをこの位置に回すと、どこをコントロールできるか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.38.png
+ localeOptionOrder:
+   A: A ウィンカー (A. Turn signal)
+   B: B ロービームランプ (B. Low beam lamp)
+   C: C フォグランプとリヤフォグランプ (C. Fog lamp and rear fog lamp)
+   D: D ハイビームランプ (D. High beam lamp)
+ options:
+   q0630_o1: B ロービームランプ
+   q0630_o2: C フォグランプとリヤフォグランプ
+   q0630_o3: D ハイビームランプ
+   q0630_o4: A ウィンカー
```

### q0793

```diff
+ qid: q0793
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.39.png
+ localeOptionOrder:
+   A: A 小型自動車専用車道 (A: Roadway for small vehicles only)
+   B: B 自動車専用車道 (B: Roadway for automobiles only)
+   C: C 多乗員専用車道 (C: Roadway for vehicles with multiple occupants only)
+   D: D タクシー専用車道 (D: Roadway for taxis only)
+ options:
+   q0793_o1: A 小型自動車専用車道
+   q0793_o2: B 自動車専用車道
+   q0793_o3: D タクシー専用車道
+   q0793_o4: C 多乗員専用車道
```

### q0154

```diff
+ qid: q0154
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車を道端に一旦停止させ発進しようとする場合、まず最初に何をすべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.40 1.png
+ localeOptionOrder:
+   A: A 給油する (A Refuel)
+   B: B クラクションを鳴らす (B Honk the horn)
+   C: C 周りの道路状況を確認する (C Check the surrounding road conditions)
+   D: D エンジンの回転数をあげる (D Increase the engine speed)
+ options:
+   q0154_o1: A 給油する
+   q0154_o2: B クラクションを鳴らす
+   q0154_o3: D エンジンの回転数をあげる
+   q0154_o4: C 周りの道路状況を確認する
```

### q0798

```diff
+ qid: q0798
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.42.png
+ localeOptionOrder:
+   A: A 高速道路の終点予告 (A Advance notice of the end of the expressway)
+   B: B 高速道路の入口予告 (B Advance notice of the entrance to the expressway)
+   C: C 高速道路の始点予告 (C Advance notice of the starting point of the expressway)
+   D: D 高速道路の出口予告 (D Advance notice of the exit from the expressway)
+ options:
+   q0798_o1: A 高速道路の終点予告
+   q0798_o2: B 高速道路の入口予告
+   q0798_o3: C 高速道路の始点予告
+   q0798_o4: D 高速道路の出口予告
```

### q0485

```diff
+ qid: q0485
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 図のような位置では、どのようにライトを用いるのが適切か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.43.png
+ localeOptionOrder:
+   A: A 左ウインカーを出す (A Use the left turn signal)
+   B: B 右ウインカーを出す (B Use the right turn signal)
+   C: C ハザードランプをつける (C Turn on the hazard lights)
+   D: D ヘッドライトをつける (D Turn on the headlights)
+ options:
+   q0485_o1: B 右ウインカーを出す
+   q0485_o2: A 左ウインカーを出す
+   q0485_o3: C ハザードランプをつける
+   q0485_o4: D ヘッドライトをつける
```

### q0718

```diff
+ qid: q0718
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.44.png
+ localeOptionOrder:
+   A: 右側通行 (Right-side traffic)
+   B: 左側通行 (Left-side traffic)
+   C: 右側を走行せよ (Drive on the right side)
+   D: ロータリーあり (There is a roundabout)
+ options:
+   q0718_o1: 右側通行
+   q0718_o2: 左側通行
+   q0718_o3: 右側を走行せよ
+   q0718_o4: ロータリーあり
```

### q0219

```diff
+ qid: q0219
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような状況であれば、加速して追い越しをしてよい。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.45 1.png
```

### q0896

```diff
+ qid: q0896
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この交通警察の手信号は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.46.png
+ localeOptionOrder:
+   A: 右折 (Right turn)
+   B: 減速徐行 (Slow down/Proceed slowly)
+   C: 車線変更 (Change lanes)
+   D: 道端に停車せよ (Stop at the side of the road)
+ options:
+   q0896_o1: 右折
+   q0896_o2: 減速徐行
+   q0896_o3: 道端に停車せよ
+   q0896_o4: 車線変更
```

### q0313

```diff
+ qid: q0313
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 財産への損失のある交通事故が発生した場合、当事者双方は事故の事実および成因に異議がない場合、車を移動するさいに現場の写真を撮り、停車位置に記しをつける必要がある。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.47 1.png
```

### q0084

```diff
+ qid: q0084
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 喫煙運転は安全運転の妨げにはならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.47.png
```

### q0038

```diff
+ qid: q0038
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 身障者が通行に影響をあたえていた場合、すずんで減速し身障者に道を譲るべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.48.png
```

### q0180

```diff
+ qid: q0180
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 山道を走行する場合、運転にどのような影響があるか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.50 1.png
+ localeOptionOrder:
+   A: A 道路標識が少ない (A: There are few road signs)
+   B: B 交通状況が単一 (B: The traffic situation is simple)
+   C: C 坂道が長く急カーブがあり、視界が十分でない (C: There are long slopes, sharp curves, and insufficient visibility)
+   D: D 交通量が多い (D: There is a lot of traffic)
+ options:
+   q0180_o1: D 交通量が多い
+   q0180_o2: C 坂道が長く急カーブがあり、視界が十分でない
+   q0180_o3: B 交通状況が単一
+   q0180_o4: A 道路標識が少ない
```

### q0303

```diff
+ qid: q0303
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような状況では、交差点で優先通行権を持っている。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.51.png
```

### q0101

```diff
+ qid: q0101
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 夜間の走行では、運転者の観察力が明らかに昼間よりも低下し、視界も短くなる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.52.png
```

### q0194

```diff
+ qid: q0194
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような場合、加速して交差点を通過できる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.53.png
```

### q0760

```diff
+ qid: q0760
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.55.png
+ localeOptionOrder:
+   A: A 高速道路境界石番号 (A. Expressway boundary stone number)
+   B: B 高速道路マイル番号 (B. Expressway mile marker)
+   C: C 高速道路路線番号 (C. Expressway route number)
+   D: D 高速道路区間番号 (D. Expressway section number)
+ options:
+   q0760_o1: A 高速道路境界石番号
+   q0760_o2: B 高速道路マイル番号
+   q0760_o3: C 高速道路路線番号
+   q0760_o4: D 高速道路区間番号
```

### q0708

```diff
+ qid: q0708
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この路面の数字標示はなにを示すか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.57.png
+ localeOptionOrder:
+   A: A 車間距離の保持 (A. Maintaining following distance)
+   B: B 最小車間距離 (B. Minimum following distance)
+   C: C 速度制限 (C. Speed limit)
+   D: D 道路番号 (D. Road number)
+ options:
+   q0708_o1: A 車間距離の保持
+   q0708_o2: B 最小車間距離
+   q0708_o3: C 速度制限
+   q0708_o4: D 道路番号
```

### q0061

```diff
+ qid: q0061
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 夜間の走行で交通信号のない交差点を通過する場合、ライトの上下切り換えをしてはならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.29.00.png
```

### q0851

```diff
+ qid: q0851
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.24.png
+ localeOptionOrder:
+   A: A 冠水の恐れあり (A: Risk of flooding)
+   B: B 冠水橋 (B: Submersible bridge)
+   C: C 渡し場 (C: Ferry crossing)
+   D: D 船用埠頭 (D: Dock for ships)
+ options:
+   q0851_o1: B 冠水橋
+   q0851_o2: C 渡し場
+   q0851_o3: D 船用埠頭
+   q0851_o4: A 冠水の恐れあり
```

### q0873

```diff
+ qid: q0873
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 道路中央の黄色い斜線部分は、なにを示す標示か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.29.png
+ localeOptionOrder:
+   A: A 対向車線の境界線を越えてよい (A. You may cross the boundary line of the oncoming lane)
+   B: B 両側から同一方向車線の境界線を越えてよい (B. You may cross the boundary line of the same direction lane from both sides)
+   C: C 対向車線の境界線を越えてはいけない (C. You must not cross the boundary line of the oncoming lane)
+   D: D 一方通行車線の境界線 (D. One-way lane boundary)
+ options:
+   q0873_o1: D 一方通行車線の境界線
+   q0873_o2: C 対向車線の境界線を越えてはいけない
+   q0873_o3: B 両側から同一方向車線の境界線を越えてよい
+   q0873_o4: A 対向車線の境界線を越えてよい
```

### q0221

```diff
+ qid: q0221
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 路上で自動車を運転する前に、規定に基づきシートベルトを着用すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.32.png
```

### q0419

```diff
+ qid: q0419
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このように一時駐車した赤い自動車の違法行為はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.45.png
+ localeOptionOrder:
+   A: A ガソリンスタンドから30メートル以内である (A: It is within 30 meters of a gas station.)
+   B: B 非自動車専用駐車線を占用した (B: Occupied a non-automobile-only parking lane.)
+   C: C 道端から30cm以上の間隔を空けた (C: Left more than 30 cm away from the roadside.)
+   D: D 駐車禁止線のある道路に駐車した (D: Parked on a road with a no-parking line.)
+ options:
+   q0419_o1: C 道端から30cm以上の間隔を空けた
+   q0419_o2: D 駐車禁止線のある道路に駐車した
+   q0419_o3: A ガソリンスタンドから30メートル以内である
+   q0419_o4: B 非自動車専用駐車線を占用した
```

### q0665

```diff
+ qid: q0665
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.49.png
+ localeOptionOrder:
+   A: A 左側通行 (A. Keep left)
+   B: B 通行止め (B. Road closed)
+   C: C 両側通行 (C. Both sides allowed)
+   D: D 右側通行 (D. Keep right)
+ options:
+   q0665_o1: C 両側通行
+   q0665_o2: D 右側通行
+   q0665_o3: A 左側通行
+   q0665_o4: B 通行止め
```

### q0224

```diff
+ qid: q0224
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 運転者は服役や出国（塀）のため、免許証の審査延長を申請している間、自動車を運転してはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.50.png
```

### q0328

```diff
+ qid: q0328
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 交通信号は交通信号灯・道路交通標識・道路路面表示および交通警察の指示を含む。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/900.png
```

### q0314

```diff
+ qid: q0314
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 実習期間内に運転する場合、運転者は車体後部に統一様式の実習運転マークを標示するべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/902.png
```

### q0876

```diff
+ qid: q0876
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.27 1.png
+ localeOptionOrder:
+   A: A 推奨速度 (A Recommended speed)
+   B: B 最低速度 (B Minimum speed)
+   C: C 最高速度 (C Maximum speed)
+   D: D 制限速度 (D Speed limit)
+ options:
+   q0876_o1: C 最高速度
+   q0876_o2: D 制限速度
+   q0876_o3: A 推奨速度
+   q0876_o4: B 最低速度
```

### q0380

```diff
+ qid: q0380
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: このような信号がある交差点では、どのように走行すべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.29 1.png
+ localeOptionOrder:
+   A: A 左折 (A. Turn left)
+   B: B 直進して通過 (B. Go straight through)
+   C: C 右折 (C. Turn right)
+   D: D 停車して待つ (D. Stop and wait)
+ options:
+   q0380_o1: C 右折
+   q0380_o2: D 停車して待つ
+   q0380_o3: A 左折
+   q0380_o4: B 直進して通過
```

### q0283

```diff
+ qid: q0283
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 道路標識路面表示は指示標識標示・警戒標識標示・規制禁止標識標示に分けられる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.33.png
```

### q0383

```diff
+ qid: q0383
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: 60歳以上の運転者はどの期間ごとに健康診断を提出するべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.41.png
+ localeOptionOrder:
+   A: A 3年 (A. Every 3 years)
+   B: B 2年 (B. Every 2 years)
+   C: C 1年 (C. Every year)
+   D: D 6ヶ月 (D. Every 6 months)
+ options:
+   q0383_o1: A 3年
+   q0383_o2: B 2年
+   q0383_o3: D 6ヶ月
+   q0383_o4: C 1年
```

### q0892

```diff
+ qid: q0892
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.43 1.png
+ localeOptionOrder:
+   A: A 駐車場 (A Parking lot)
+   B: B 展望台 (B Observation deck)
+   C: C 休憩エリア (C Rest area)
+   D: D サービスエリア (D Service area)
+ options:
+   q0892_o1: C 休憩エリア
+   q0892_o2: D サービスエリア
+   q0892_o3: A 駐車場
+   q0892_o4: B 展望台
```

### q0268

```diff
+ qid: q0268
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: Uターン・角を曲がる・急な坂を下る場合、自動車の最高速度は40km/hを超過してはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.52 1.png
```

### q0017

```diff
+ qid: q0017
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 夜間の走行で、対向車がハイビームヘッドランプをつけている場合、対向車と自車のライトの光が交差する位置を歩行者が通り事故とならないよう、減速して走行すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.28.54.png
```

