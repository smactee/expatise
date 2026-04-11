# Full-Batch Dry-Run Merge Review: ja batch-006

- Dataset: `2023-test1`
- Auto-matched items: 11
- Reviewed items: 40
- Equivalent overlaps: 0
- Final total: 50
- Ready for merge: 50
- Blockers: 0
- Safe to merge next step: yes
- Full preview: `qbank-tools/generated/staging/translations.ja.batch-006.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ja.batch-006.full.merge-dry-run.json`

## Diff Summary

### q0553

```diff
+ qid: q0553
+ sourceBucket: reviewed
+ type: ROW
+ prompt: ウインカースイッチを上に引くと、左ウインカーがつく。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.26 1.png
```

### q0621

```diff
+ qid: q0621
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: エンジンの起動後、インパネのの点灯は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.19 1.png
+ localeOptionOrder:
+   A: A 燃料タンクの残量が最小限となった (A: The fuel tank level has reached the minimum)
+   B: B 燃料システムの故障 (B: Malfunction in the fuel system)
+   C: C 点火システムの故障 (C: Malfunction in the ignition system)
+   D: D 燃料ポンプの故障または異常 (D: Malfunction or abnormality in the fuel pump)
+ options:
+   q0621_o1: D 燃料ポンプの故障または異常
+   q0621_o2: C 点火システムの故障
+   q0621_o3: B 燃料システムの故障
+   q0621_o4: A 燃料タンクの残量が最小限となった
```

### q0864

```diff
+ qid: q0864
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 道路中央の二本の黄色い実線は、なにを示すか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.20.png
+ localeOptionOrder:
+   A: A 対向車線への境界線を越えてよい (A. You may cross the boundary line to the opposite lane)
+   B: B 対向車線への境界線を越えてはいけない (B. You may not cross the boundary line to the opposite lane)
+   C: C 両側から同一方向車線の境界線を越えてよい (C. From both sides, you may cross the boundary line for same-direction lanes)
+   D: D 一方通行車線の境界線 (D. Boundary line for a one-way lane)
+ options:
+   q0864_o1: B 対向車線への境界線を越えてはいけない
+   q0864_o2: A 対向車線への境界線を越えてよい
+   q0864_o3: C 両側から同一方向車線の境界線を越えてよい
+   q0864_o4: D 一方通行車線の境界線
```

### q0143

```diff
+ qid: q0143
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 片側4車線の高速道路で運転するさい、時速110km/hを上回る自動車はどの車線で走行すべきか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.23.png
+ localeOptionOrder:
+   A: A 最も左側の車線 (A: The leftmost lane)
+   B: B 二本目 (B: The second lane)
+   C: C 三本目 (C: The third lane)
+   D: D 最も右側の車線 (D: The rightmost lane)
+ options:
+   q0143_o1: A 最も左側の車線
+   q0143_o2: B 二本目
+   q0143_o3: D 最も右側の車線
+   q0143_o4: C 三本目
```

### q0656

```diff
+ qid: q0656
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.24.png
+ localeOptionOrder:
+   A: A 二方向交道 (A Two-way traffic)
+   B: B 分離式道路 (B Divided road)
+   C: C 潮汐流可変車道（中央線変移・時間帯により通行区分が変更される車線） (C Tidal flow variable lane (the lane division changes depending on the time))
+   D: D 減速しゅぐれ (D Deceleration lane)
+ options:
+   q0656_o1: D 減速しゅぐれ
+   q0656_o2: C 潮汐流可変車道（中央線変移・時間帯により通行区分が変更される車線）
+   q0656_o3: B 分離式道路
+   q0656_o4: A 二方向交道
```

### q0443

```diff
+ qid: q0443
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このような橋を走行する場合、まず何をするべきか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.26.png
+ localeOptionOrder:
+   A: A 一定の速度を維持して通過する (A. Maintain a constant speed and pass)
+   B: B できるだけ速度をあげて通過する (B. Pass at the highest possible speed)
+   C: C 低速で徐行する (C. Drive slowly at low speed)
+   D: D 停車して水浸しの状況を確認する (D. Stop and check the flooding situation)
+ options:
+   q0443_o1: A 一定の速度を維持して通過する
+   q0443_o2: B できるだけ速度をあげて通過する
+   q0443_o3: D 停車して水浸しの状況を確認する
+   q0443_o4: C 低速で徐行する
```

### q0616

```diff
+ qid: q0616
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車のインパネの点灯は、何を示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.27.png
+ localeOptionOrder:
+   A: A 右ウインカー----インジケータの点滅 (A. Right turn signal indicator flashing)
+   B: B ハザードランプの点滅 (B. Hazard light flashing)
+   C: C 左ウインカーインジケータの点滅 (C. Left turn signal indicator flashing)
+   D: D フロント・リアサイドランプの点灯 (D. Front/rear side lamp illumination)
+ options:
+   q0616_o1: B ハザードランプの点滅
+   q0616_o2: A 右ウインカー----インジケータの点滅
+   q0616_o3: C 左ウインカーインジケータの点滅
+   q0616_o4: D フロント・リアサイドランプの点灯
```

### q0858

```diff
+ qid: q0858
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 図が示す円中の黄色い破線は、なにを示す路面標示か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.30.png
+ localeOptionOrder:
+   A: A 交差点内の方向を導く標示 (A: A marking that guides the direction within the intersection)
+   B: B 非自動車を導く標示 (B: A marking that guides non-motor vehicles)
+   C: C 車線をつなぐ標示 (C: A marking that connects lanes)
+   D: D 小型g動車用左右折線 (D: Left/right turning line for small vehicles)
+ options:
+   q0858_o1: B 非自動車を導く標示
+   q0858_o2: A 交差点内の方向を導く標示
+   q0858_o3: C 車線をつなぐ標示
+   q0858_o4: D 小型g動車用左右折線
```

### q0535

```diff
+ qid: q0535
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車のインパネのこの点灯は、エンジンの冷却水が足りないことを示している。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.31.png
```

### q0531

```diff
+ qid: q0531
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 追突事故が発生した場合、ヘッドレストは運転者の頭部を保護する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.32.png
```

### q0439

```diff
+ qid: q0439
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 同じ車線を走行している前車がどの車両である場合、追い越してはいけないか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.33.png
+ localeOptionOrder:
+   A: A 過積載の大型貨物車 (A. Overloaded large truck)
+   B: B 大型旅客車 (B. Large passenger vehicle)
+   C: C 任務中の救急車 (C. Ambulance on duty)
+   D: D 小型貨物車 (D. Small truck)
+ options:
+   q0439_o1: A 過積載の大型貨物車
+   q0439_o2: B 大型旅客車
+   q0439_o3: C 任務中の救急車
+   q0439_o4: D 小型貨物車
```

### q0644

```diff
+ qid: q0644
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような場合、中央の車線を走行してはならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.34.png
```

### q0138

```diff
+ qid: q0138
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 運転中、負傷者を救助する救急車が同一車道から走行してきた場合、どのように対応すべきか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.35 1.png
+ localeOptionOrder:
+   A: A 脇に寄って減速し、停車して道を譲る (A: Pull over to the side, slow down, stop and yield the way)
+   B: B 他の車線を利用して運転する (B: Use another lane to drive)
+   C: C 加速して車線を変更し、道を譲る (C: Accelerate, change lane, and yield the way)
+   D: D 同一車線で運転し続ける (D: Continue driving in the same lane)
+ options:
+   q0138_o1: A 脇に寄って減速し、停車して道を譲る
+   q0138_o2: B 他の車線を利用して運転する
+   q0138_o3: C 加速して車線を変更し、道を譲る
+   q0138_o4: D 同一車線で運転し続ける
```

### q0742

```diff
+ qid: q0742
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: これはなにを示す停車線か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.35.png
+ localeOptionOrder:
+   A: A 乗客待ち専用駐車エリア (A Parking area exclusively for waiting for passengers)
+   B: B 乗客乗降専用駐車エリア (B Parking area exclusively for picking up or dropping off passengers)
+   C: C 停車方向が決められた駐車エリア (C Parking area with a designated parking direction)
+   D: D 駐車時間制限のある駐車エリア (D Parking area with a time limit)
+ options:
+   q0742_o1: A 乗客待ち専用駐車エリア
+   q0742_o2: B 乗客乗降専用駐車エリア
+   q0742_o3: D 駐車時間制限のある駐車エリア
+   q0742_o4: C 停車方向が決められた駐車エリア
```

### q0717

```diff
+ qid: q0717
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.36.png
+ localeOptionOrder:
+   A: A 直進および右折 (A. Go straight and turn right)
+   B: B 直進および左折 (B. Go straight and turn left)
+   C: C 直進と左折の禁止 (C. Going straight and turning left are prohibited)
+   D: D 左折または右折のみ可 (D. Only turning left or right is allowed)
+ options:
+   q0717_o1: A 直進および右折
+   q0717_o2: C 直進と左折の禁止
+   q0717_o3: B 直進および左折
+   q0717_o4: D 左折または右折のみ可
```

### q0685

```diff
+ qid: q0685
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.38.png
+ localeOptionOrder:
+   A: A 直進車線 (A: Straight-ahead lane)
+   B: B 一方通行 (B: One-way traffic)
+   C: C 左折 (C: Left turn)
+   D: D 直進禁止 (D: No going straight)
+ options:
+   q0685_o1: C 左折
+   q0685_o2: D 直進禁止
+   q0685_o3: A 直進車線
+   q0685_o4: B 一方通行
```

### q0168

```diff
+ qid: q0168
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: アイスバーン上や雪路で運転する場合、どのような現象が生じるか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.39 1.png
+ localeOptionOrder:
+   A: A 湿気のため電気設備がショートしやすくなる (A. Due to moisture, electrical equipment is more likely to short circuit)
+   B: B 視界が悪くぼやける (B. Visibility becomes poor and blurry)
+   C: C 走行抵抗力が増す (C. Rolling resistance increases)
+   D: D 制動性能が低下し、進行方向にズレが生じやすくなる (D. Braking performance decreases and deviation from the direction of travel is more likely)
+ options:
+   q0168_o1: A 湿気のため電気設備がショートしやすくなる
+   q0168_o2: B 視界が悪くぼやける
+   q0168_o3: C 走行抵抗力が増す
+   q0168_o4: D 制動性能が低下し、進行方向にズレが生じやすくなる
```

### q0257

```diff
+ qid: q0257
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 信号がない交差点は、できるだけ早く通過すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.42.png
```

### q0510

```diff
+ qid: q0510
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この⽶市道路を⾛⾏する場合の最⾼速度はどれか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.43.png
+ localeOptionOrder:
+   A: A 30km/h (A 30km/h)
+   B: B 40km/h (B 40km/h)
+   C: C 50km/h (C 50km/h)
+   D: D 70km/h (D 70km/h)
+ options:
+   q0510_o1: A 30km/h
+   q0510_o2: B 40km/h
+   q0510_o3: C 50km/h
+   q0510_o4: D 70km/h
```

### q0281

```diff
+ qid: q0281
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような自動車を路上で運転することは、軽微な規制違反になる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.44.png
```

### q0184

```diff
+ qid: q0184
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 濃霧のため視界が極端に悪く、走行が困難である場合どうすべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.48 1.png
+ localeOptionOrder:
+   A: A ヘッドランプをつけ走行し続ける (A. Continue driving with the headlights on)
+   B: B サイドランプおよびフォグランプをつけ、右に寄り走行する (B. Turn on the side lamps and fog lights and drive to the right side)
+   C: C ハザードランプおよびフォグランプをつけ、安全な場所で停止する (C. Turn on the hazard lights and fog lights and stop in a safe place)
+   D: D ハザードランプをつけ走行し続ける (D. Continue driving with the hazard lights on)
+ options:
+   q0184_o1: A ヘッドランプをつけ走行し続ける
+   q0184_o2: B サイドランプおよびフォグランプをつけ、右に寄り走行する
+   q0184_o3: D ハザードランプをつけ走行し続ける
+   q0184_o4: C ハザードランプおよびフォグランプをつけ、安全な場所で停止する
```

### q0140

```diff
+ qid: q0140
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 主幹道路を運転しており、主道路と従道路の接点に近づいた場合、従道路からの自動車との衝突を避けるためどうするのが適切か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.48.png
+ localeOptionOrder:
+   A: A あらかじめ減速し様子を見て、慎重に運転する (A: Decelerate in advance, observe the situation, and drive carefully.)
+   B: B 通常速度で運転する (B: Drive at normal speed.)
+   C: C クラクションを鳴らし、迅速に通過する (C: Sound the horn and pass quickly.)
+   D: D あらかじめ加速して通過する (D: Accelerate in advance and pass through.)
+ options:
+   q0140_o1: B 通常速度で運転する
+   q0140_o2: A あらかじめ減速し様子を見て、慎重に運転する
+   q0140_o3: C クラクションを鳴らし、迅速に通過する
+   q0140_o4: D あらかじめ加速して通過する
```

### q0637

```diff
+ qid: q0637
+ sourceBucket: reviewed
+ type: ROW
+ prompt: このような場合、自動車は左折してはならない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.50.png
```

### q0077

```diff
+ qid: q0077
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 高速道路を走行中霧で見通しが悪くなった場合、ただちにブレーキをかけて停車すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.51.png
```

### q0428

```diff
+ qid: q0428
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この故障車の違法行為はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.52 1.png
+ localeOptionOrder:
+   A: A 三角板を設置していない (A. Not setting up a warning triangle)
+   B: B ハザードランプをつけていない (B. Not turning on the hazard lights)
+   C: C 道端に停車していない (C. Not stopping at the roadside)
+   D: D ただちに修理していない (D. Not repairing it immediately)
+ options:
+   q0428_o1: B ハザードランプをつけていない
+   q0428_o2: C 道端に停車していない
+   q0428_o3: D ただちに修理していない
+   q0428_o4: A 三角板を設置していない
```

### q0740

```diff
+ qid: q0740
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.52.png
+ localeOptionOrder:
+   A: A 高速道路の緊急駐車エリア (A: Emergency parking area on highway)
+   B: B 高速道路の待避所 (B: Refuge area on highway)
+   C: C 高速道路の駐車ニリア (C: Parking area on highway)
+   D: D 高速道路の旅客車停留所 (D: Bus stop on highway)
+ options:
+   q0740_o1: A 高速道路の緊急駐車エリア
+   q0740_o2: B 高速道路の待避所
+   q0740_o3: D 高速道路の旅客車停留所
+   q0740_o4: C 高速道路の駐車ニリア
```

### q0320

```diff
+ qid: q0320
+ sourceBucket: reviewed
+ type: ROW
+ prompt: ドア・トランクをしっかり閉めるまで、自動車を発進すべきではない
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.54.png
```

### q0848

```diff
+ qid: q0848
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この矢印はなにを示すか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.55.png
+ localeOptionOrder:
+   A: A 前方右折を指示する (A. Instructs to turn right ahead)
+   B: B 前方Uターンを指示する (B. Instructs a U-turn ahead)
+   C: C 前方直進を指示する (C. Instructs to go straight ahead)
+   D: D 左への車道変更を指示する (D. Instructs to change lanes to the left)
+ options:
+   q0848_o1: D 左への車道変更を指示する
+   q0848_o2: C 前方直進を指示する
+   q0848_o3: B 前方Uターンを指示する
+   q0848_o4: A 前方右折を指示する
```

### q0109

```diff
+ qid: q0109
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 踏み切りを通過する前に減速しギアを下げるが、踏み切りに入ったあとの動作として正しいのはどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.56.png
+ localeOptionOrder:
+   A: A ギアチェンジをしてはいけない (A. You must not change gears.)
+   B: B ギアチェンジをしてよい (B. You may change gears.)
+   C: C 高いギアにチェンジする (C. Shift to a higher gear.)
+   D: D 車を止め、様子を見る (D. Stop the car and observe the situation.)
+ options:
+   q0109_o1: A ギアチェンジをしてはいけない
+   q0109_o2: B ギアチェンジをしてよい
+   q0109_o3: C 高いギアにチェンジする
+   q0109_o4: D 車を止め、様子を見る
```

### q0836

```diff
+ qid: q0836
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.57 1.png
+ localeOptionOrder:
+   A: A 堤防道路 (A. Embankment road)
+   B: B 崖あり (B. Cliff ahead)
+   C: C 滑りやすい (C. Slippery)
+   D: D 川沿いの道路 (D. Road along a river)
+ options:
+   q0836_o1: A 堤防道路
+   q0836_o2: B 崖あり
+   q0836_o3: D 川沿いの道路
+   q0836_o4: C 滑りやすい
```

### q0619

```diff
+ qid: q0619
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このスイッチを上に引くと、どこをコントロールできるか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.57.png
+ localeOptionOrder:
+   A: A バックアップランプ (A. Backup lamp)
+   B: B ウインカー (B. Turn signal)
+   C: C サイドランプ (C. Side lamp)
+   D: D ハザードランプ (D. Hazard lamp)
+ options:
+   q0619_o1: B ウインカー
+   q0619_o2: A バックアップランプ
+   q0619_o3: C サイドランプ
+   q0619_o4: D ハザードランプ
```

### q0367

```diff
+ qid: q0367
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この車道を走行する場合の制限最高速度はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.58.png
+ localeOptionOrder:
+   A: A 120km/h (120 km/h)
+   B: B 110km/h (110 km/h)
+   C: C 100km/h (100 km/h)
+   D: D 90km/h (90 km/h)
+ options:
+   q0367_o1: C 100km/h
+   q0367_o2: D 90km/h
+   q0367_o3: A 120km/h
+   q0367_o4: B 110km/h
```

### q0618

```diff
+ qid: q0618
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この操縦装置は何か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.59.png
+ localeOptionOrder:
+   A: A ターンシグナルスイッチ (A Turn signal switch)
+   B: B バックアップランプ・スイッチ (B Backup lamp switch)
+   C: C ワイパー・スイッチ (C Wiper switch)
+   D: D ハザードランプ・スイッチ (D Hazard lamp switch)
+ options:
+   q0618_o1: B バックアップランプ・スイッチ
+   q0618_o2: C ワイパー・スイッチ
+   q0618_o3: D ハザードランプ・スイッチ
+   q0618_o4: A ターンシグナルスイッチ
```

### q0682

```diff
+ qid: q0682
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.19.png
+ localeOptionOrder:
+   A: A 番をする人がいない踏切までから50メートル (A. 50 meters to an unattended railroad crossing)
+   B: B 番をする人がいる踏切まで50メートル (B. 50 meters to an attended railroad crossing)
+   C: C 番をする人がいない踏切まで100メートル (C. 100 meters to an unattended railroad crossing)
+   D: D 番をする人がいる踏切まで100メートル (D. 100 meters to an attended railroad crossing)
+ options:
+   q0682_o1: C 番をする人がいない踏切まで100メートル
+   q0682_o2: D 番をする人がいる踏切まで100メートル
+   q0682_o3: A 番をする人がいない踏切までから50メートル
+   q0682_o4: B 番をする人がいる踏切まで50メートル
```

### q0675

```diff
+ qid: q0675
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 図が示す円中の白い半円状の標記は、なにを示す路面標示か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.28.png
+ localeOptionOrder:
+   A: A 減速して運転する標示 (A: Sign to drive with reduced speed)
+   B: B 速度を確認する標示 (B: Sign to check your speed)
+   C: C 車間距離を確認する標示 (C: Sign to check your following distance)
+   D: D 交差点で減速する標示 (D: Sign to reduce speed at intersections)
+ options:
+   q0675_o1: A 減速して運転する標示
+   q0675_o2: B 速度を確認する標示
+   q0675_o3: D 交差点で減速する標示
+   q0675_o4: C 車間距離を確認する標示
```

### q0377

```diff
+ qid: q0377
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 次のなかで、すでに登録した小型乗用車の所有者が登録変更手続きをしなくていいのはどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.29.png
+ localeOptionOrder:
+   A: A 自動車のエンジンを変えたられる (A. Changed the car's engine)
+   B: B 自動車の前後に衝突防止装置を装着した (B. Installed collision prevention devices on the front and rear of the car)
+   C: C 車体色を変えた (C. Changed the car body color)
+   D: D 車体あるいは車台を変えた (D. Changed the car body or chassis)
+ options:
+   q0377_o1: A 自動車のエンジンを変えたられる
+   q0377_o2: B 自動車の前後に衝突防止装置を装着した
+   q0377_o3: C 車体色を変えた
+   q0377_o4: D 車体あるいは車台を変えた
```

### q0787

```diff
+ qid: q0787
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.30 1.png
+ localeOptionOrder:
+   A: A 進入禁止 (A No entry)
+   B: B 通行禁止 (B No passage)
+   C: C 減速走行 (C Reduce speed)
+   D: D 進入に時間制限あり (D Time-limited entry)
+ options:
+   q0787_o1: B 通行禁止
+   q0787_o2: C 減速走行
+   q0787_o3: D 進入に時間制限あり
+   q0787_o4: A 進入禁止
```

### q0885

```diff
+ qid: q0885
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 指示標示の役割はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.37.png
+ localeOptionOrder:
+   A: A 通行を禁止する (A. Prohibit passage)
+   B: B 通行を指示する (B. Indicate passage)
+   C: C 通行を制限する (C. Restrict passage)
+   D: D 警告と注意 (D. Warning and caution)
+ options:
+   q0885_o1: A 通行を禁止する
+   q0885_o2: B 通行を指示する
+   q0885_o3: C 通行を制限する
+   q0885_o4: D 警告と注意
```

### q0169

```diff
+ qid: q0169
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: ぬかるんだ道路での運転は、どのような現象が生じるか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.41.png
+ localeOptionOrder:
+   A: A 走行抵抗力が減る (A. Rolling resistance decreases)
+   B: B 車輪が空転し横滑りしやすくなる (B. Wheels are more likely to spin and skid sideways)
+   C: C 視界が悪くぼやける (C. Visibility becomes poor and blurry)
+   D: D 路面付着力が増す (D. Surface adhesion increases)
+ options:
+   q0169_o1: A 走行抵抗力が減る
+   q0169_o2: B 車輪が空転し横滑りしやすくなる
+   q0169_o3: C 視界が悪くぼやける
+   q0169_o4: D 路面付着力が増す
```

### q0282

```diff
+ qid: q0282
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 国家規制の精神薬を服用しても短距離運転であれば許可される。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.47.png
```

### q0010

```diff
+ qid: q0010
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 高速道路のランプでUターンしてはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/200.png
```

### q0266

```diff
+ qid: q0266
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 道路交通標識と道路路面表示は交通信号に含まれない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.18.png
```

### q0508

```diff
+ qid: q0508
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: 運転者が初めて免許証を取得申請したあと、および運転可能車種を増やしたあとの実習期の期間はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.21.png
+ localeOptionOrder:
+   A: A 6ヶ月 (A. 6 months)
+   B: B 12ヶ月 (B. 12 months)
+   C: C 3ヶ月 (C. 3 months)
+   D: D 2年 (D. 2 years)
+ options:
+   q0508_o1: A 6ヶ月
+   q0508_o2: B 12ヶ月
+   q0508_o3: D 2年
+   q0508_o4: C 3ヶ月
```

### q0814

```diff
+ qid: q0814
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.22 1.png
+ localeOptionOrder:
+   A: A トンネル内ハイビームランプを点灯せよ (A Turn on the high beam headlights in the tunnel)
+   B: B トンネル内減速せよ (B Slow down in the tunnel)
+   C: C トンネル内前照灯を点灯せよ (C Turn on the headlights in the tunnel)
+   D: D トンネル内車幅灯を点灯せよ (D Turn on the width indicator lights in the tunnel)
+ options:
+   q0814_o1: B トンネル内減速せよ
+   q0814_o2: A トンネル内ハイビームランプを点灯せよ
+   q0814_o3: C トンネル内前照灯を点灯せよ
+   q0814_o4: D トンネル内車幅灯を点灯せよ
```

### q0308

```diff
+ qid: q0308
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 図の位置から、直接高速道路に入ることる
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.22.png
```

### q0091

```diff
+ qid: q0091
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 携帯電話をかけながら運転するのは違法行為である。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.25.png
```

### q0501

```diff
+ qid: q0501
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: 追い越しをしてはいけないのはどこどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.39.png
+ localeOptionOrder:
+   A: A 山岳道路 (A Mountain roads)
+   B: B 都市高架道路 (B Urban elevated roads)
+   C: C 都市高速道路 (C Urban expressways)
+   D: D い橋・カーブ (D Bridges and curves)
+ options:
+   q0501_o1: A 山岳道路
+   q0501_o2: B 都市高架道路
+   q0501_o3: C 都市高速道路
+   q0501_o4: D い橋・カーブ
```

### q0210

```diff
+ qid: q0210
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 高速道路でS動車が故障した場合、乗員を右側の路肩または緊急車線へ移動させ、ただちに警察を呼ぶべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.40.png
```

### q0768

```diff
+ qid: q0768
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.49.png
+ localeOptionOrder:
+   A: A 直進および右折 (A: Straight ahead and right turn)
+   B: B 直進および左折 (B: Straight ahead and left turn)
+   C: C 直進と右折の禁止 (C: No straight ahead and right turn)
+   D: D 左折または右折のみ可 (D: Only left or right turn allowed)
+ options:
+   q0768_o1: B 直進および左折
+   q0768_o2: A 直進および右折
+   q0768_o3: C 直進と右折の禁止
+   q0768_o4: D 左折または右折のみ可
```

### q0025

```diff
+ qid: q0025
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 水浸しの道路を走行する場合、高いギアを入れ高 速で通過すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.53.png
```

