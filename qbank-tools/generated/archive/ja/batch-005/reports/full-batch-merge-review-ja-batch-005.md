# Full-Batch Dry-Run Merge Review: ja batch-005

- Dataset: `2023-test1`
- Auto-matched items: 11
- Reviewed items: 40
- Equivalent overlaps: 0
- Final total: 50
- Ready for merge: 50
- Blockers: 0
- Safe to merge next step: yes
- Full preview: `qbank-tools/generated/staging/translations.ja.batch-005.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ja.batch-005.full.merge-dry-run.json`

## Diff Summary

### q0290

```diff
+ qid: q0290
+ sourceBucket: reviewed
+ type: ROW
+ prompt: この交差点でUターンしてはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.16.png
```

### q0590

```diff
+ qid: q0590
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: これは何のペダルか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/150.png
+ localeOptionOrder:
+   A: A アクセル (A. Accelerator)
+   B: B クラッチ・ペダル (B. Clutch pedal)
+   C: C ブレーキ・ペダル (C. Brake pedal)
+   D: D パーキングブレーキ (D. Parking brake)
+ options:
+   q0590_o1: B クラッチ・ペダル
+   q0590_o2: C ブレーキ・ペダル
+   q0590_o3: D パーキングブレーキ
+   q0590_o4: A アクセル
```

### q0395

```diff
+ qid: q0395
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 免許証を取得しない練習者が路上で運転練習をする場合、以下の方法のなかで正しいのはどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.37.png
+ localeOptionOrder:
+   A: A 練習している車種の教習車に指導員が同乗して指導する (A. A licensed instructor rides along in the training vehicle to instruct.)
+   B: B 練習している車種の教習車を単独で練習する (B. Practice alone in the training vehicle.)
+   C: C 自家用車に指導員が同乗して指導する (C. A licensed instructor rides along in a private car to instruct.)
+   D: D 練習している車種の教習車に非指導員の運転者が同乗して指導する (D. A non-instructor driver rides along in the training vehicle to instruct.)
+ options:
+   q0395_o1: A 練習している車種の教習車に指導員が同乗して指導する
+   q0395_o2: B 練習している車種の教習車を単独で練習する
+   q0395_o3: D 練習している車種の教習車に非指導員の運転者が同乗して指導する
+   q0395_o4: C 自家用車に指導員が同乗して指導する
```

### q0599

```diff
+ qid: q0599
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このメーターは何か。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.40.png
+ localeOptionOrder:
+   A: A 燃料計ガソリンメーター (A Fuel gauge (gasoline meter))
+   B: B 速度メーター (B Speedometer)
+   C: C タコメーター (C Tachometer)
+   D: D 最高速度制限メーター (D Maximum speed limit meter)
+ options:
+   q0599_o1: B 速度メーター
+   q0599_o2: C タコメーター
+   q0599_o3: D 最高速度制限メーター
+   q0599_o4: A 燃料計ガソリンメーター
```

### q0724

```diff
+ qid: q0724
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 道路中央の二本の黄色い実線は、なにを示す路面標示か。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.42.png
+ localeOptionOrder:
+   A: A 指示標示 (A Instruction marking)
+   B: B 補助標示 (B Auxiliary marking)
+   C: C 警告標示 (C Warning marking)
+   D: D 規制標示 (D Regulation marking)
+ options:
+   q0724_o1: B 補助標示
+   q0724_o2: C 警告標示
+   q0724_o3: A 指示標示
+   q0724_o4: D 規制標示
```

### q0317

```diff
+ qid: q0317
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車が路上でU:ターンする場合、早めに左ウィンカーを出す。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.43.png
```

### q0757

```diff
+ qid: q0757
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.44 1.png
+ localeOptionOrder:
+   A: A 交差点あり (A Intersection ahead)
+   B: B 斜線方向の予告 (B Diagonal direction announcement)
+   C: C 進行方向別通行の予告 (C Advance notice of separate directions)
+   D: D 道路分流部あり (D Road junction)
+ options:
+   q0757_o1: B 斜線方向の予告
+   q0757_o2: A 交差点あり
+   q0757_o3: C 進行方向別通行の予告
+   q0757_o4: D 道路分流部あり
```

### q0486

```diff
+ qid: q0486
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車が急勾配を降りるさい、してはいけない危険行為はどれか
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.46.png
+ localeOptionOrder:
+   A: A 早めにギアをさげる (A Lower the gear early)
+   B: B ギアをニュートラルにして滑走する (B Put the gear in neutral and coast)
+   C: C ギアをローにして走行する (C Drive in low gear)
+   D: D ブレーキをかけて速度を落とす (D Use the brake to reduce speed)
+ options:
+   q0486_o1: B ギアをニュートラルにして滑走する
+   q0486_o2: C ギアをローにして走行する
+   q0486_o3: D ブレーキをかけて速度を落とす
+   q0486_o4: A 早めにギアをさげる
```

### q0610

```diff
+ qid: q0610
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: このメーターは何か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.47.png
+ localeOptionOrder:
+   A: A 電流計 (A Ammeter)
+   B: B 圧力計 (B Pressure gauge)
+   C: C 水温計 (C Water temperature gauge)
+   D: D 燃料計 (D Fuel gauge)
+ options:
+   q0610_o1: C 水温計
+   q0610_o2: D 燃料計
+   q0610_o3: A 電流計
+   q0610_o4: B 圧力計
```

### q0723

```diff
+ qid: q0723
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 路面の白い破線と三角地帯標示からなる標示は、なにを示す路面標示か。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.48.png
+ localeOptionOrder:
+   A: A 道路の入り口標示 (A: Road entrance marking)
+   B: B 跨ぐことができる道路境界線 (B: Road boundary line that can be crossed)
+   C: C 道路の入り口にある減速標示 (C: Deceleration marking at the road entrance)
+   D: D 道路の出口標示 (D: Road exit marking)
+ options:
+   q0723_o1: A 道路の入り口標示
+   q0723_o2: B 跨ぐことができる道路境界線
+   q0723_o3: C 道路の入り口にある減速標示
+   q0723_o4: D 道路の出口標示
```

### q0247

```diff
+ qid: q0247
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 路上で交通事故を起こし死者や負傷者を出した場合、ただちに負傷者を救助し警察を呼ぶべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.51.png
```

### q0772

```diff
+ qid: q0772
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.53 1.png
+ localeOptionOrder:
+   A: A 高速道路カード受領所 (A Expressway card reception office)
+   B: B 高速道路料金所 (B Expressway toll booth)
+   C: C 高速道路検査所 (C Expressway inspection office)
+   D: D ETCシステム設置料金所 (D ETC system equipped toll booth)
+ options:
+   q0772_o1: B 高速道路料金所
+   q0772_o2: C 高速道路検査所
+   q0772_o3: D ETCシステム設置料金所
+   q0772_o4: A 高速道路カード受領所
```

### q0884

```diff
+ qid: q0884
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.53.png
+ localeOptionOrder:
+   A: A 高速道路の料金所予告 (A. Expressway toll booth ahead notice)
+   B: B 高速道路のサービスエリア予出 (B. Expressway service area ahead notice)
+   C: C 高速道路の危険注意予告 (C. Expressway danger caution notice)
+   D: D 高速道路のバス停留所予告 (D. Expressway bus stop ahead notice)
+ options:
+   q0884_o1: D 高速道路のバス停留所予告
+   q0884_o2: C 高速道路の危険注意予告
+   q0884_o3: B 高速道路のサービスエリア予出
+   q0884_o4: A 高速道路の料金所予告
```

### q0233

```diff
+ qid: q0233
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 運転者の交通違反法による点数はまだ制限に達していないが、罰金を納めていない場合、点数は次の計算周期に持ち越しとなる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.55.png
```

### q0477

```diff
+ qid: q0477
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 公安機関交通管理部門は累積減点が規定点値に達した運転者をどう処するか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.56.png
+ localeOptionOrder:
+   A: A 法律に基づき刑事責任を追及する (A Pursue criminal liability based on the law)
+   B: B 15日以下の収監 (B Imprisonment for 15 days or less)
+   C: C 生涯運転禁止 (C Lifetime driving ban)
+   D: D 法律法則について指導し、もう一度試験を受験させる (D Provide legal instruction and require them to retake the exam)
+ options:
+   q0477_o1: B 15日以下の収監
+   q0477_o2: C 生涯運転禁止
+   q0477_o3: D 法律法則について指導し、もう一度試験を受験させる
+   q0477_o4: A 法律に基づき刑事責任を追及する
```

### q0707

```diff
+ qid: q0707
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この矢印はなにを示すか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.57 1.png
+ localeOptionOrder:
+   A: A 前方右折またはUターンを指示する (A. Go straight ahead or turn right, or make a U-turn)
+   B: B 前方直進または左折を指示する (B. Go straight ahead or turn left)
+   C: C 前方直進またはUターンを指示する (C. Go straight ahead or make a U-turn)
+   D: D 直進または左への車道変更を指示する (D. Go straight ahead or change lanes to the left)
+ options:
+   q0707_o1: A 前方右折またはUターンを指示する
+   q0707_o2: B 前方直進または左折を指示する
+   q0707_o3: D 直進または左への車道変更を指示する
+   q0707_o4: C 前方直進またはUターンを指示する
```

### q0559

```diff
+ qid: q0559
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車のインパネのの点灯は、エンジンオイルがパ)ないことを示している。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.57.png
```

### q0203

```diff
+ qid: q0203
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 国家の規定に従い自動車交通事故責任強制保険に加入していない車両に対し、交通警察は法律に基づき車を拘留できる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.58.png
```

### q0577

```diff
+ qid: q0577
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標示のスイッチはどの装置をコントロールするか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.59.png
+ localeOptionOrder:
+   A: A リアガラスの除霜またはくもり止め (A: Rear window defroster or anti-fog)
+   B: B フロントワイパーおよびスクラバー (B: Front wiper and scrubber)
+   C: C リアワイパーおよびスクラバー (C: Rear wiper and scrubber)
+   D: D フロントガラスの除霜またはくもり止め (D: Front window defroster or anti-fog)
+ options:
+   q0577_o1: D フロントガラスの除霜またはくもり止め
+   q0577_o2: C リアワイパーおよびスクラバー
+   q0577_o3: B フロントワイパーおよびスクラバー
+   q0577_o4: A リアガラスの除霜またはくもり止め
```

### q0614

```diff
+ qid: q0614
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: の標示のスイッチはどの装置をコントロールするか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.00.png
+ localeOptionOrder:
+   A: A 自動車の後部ドア用の児童安全錠 (A. Child safety lock for rear doors of the car)
+   B: B 両側窓ウィンドガラス (B. Both side window glass)
+   C: C オートドア (C. Automatic door)
+   D: D ドアロックまたはドアオープン (D. Door lock or door open)
+ options:
+   q0614_o1: A 自動車の後部ドア用の児童安全錠
+   q0614_o2: B 両側窓ウィンドガラス
+   q0614_o3: C オートドア
+   q0614_o4: D ドアロックまたはドアオープン
```

### q0032

```diff
+ qid: q0032
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 夜間の走行中対向車とすれ違うさい、対向車がハイビームヘッドランプを消し忘れていた場合、ヘッドランプを切り換えて合図をするとともに減速して右側へ寄り走行を続ける、または停車する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.01.png
```

### q0125

```diff
+ qid: q0125
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: バーストを防ぐ方法で誤っているのはどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.03.png
+ localeOptionOrder:
+   A: A 空気圧を減らす (A. Reduce air pressure)
+   B: B 定期点検をする (B. Perform regular inspections)
+   C: C タイヤの溝の異物を除去する (C. Remove foreign objects from tire grooves)
+   D: D 亀裂や深いキズのあるタイヤは交換する (D. Replace tires with cracks or deep scratches)
+ options:
+   q0125_o1: A 空気圧を減らす
+   q0125_o2: B 定期点検をする
+   q0125_o3: C タイヤの溝の異物を除去する
+   q0125_o4: D 亀裂や深いキズのあるタイヤは交換する
```

### q0558

```diff
+ qid: q0558
+ sourceBucket: reviewed
+ type: ROW
+ prompt: エンジンキーをSTARTの位置にすると、エンジンが作動する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.04 1.png
```

### q0446

```diff
+ qid: q0446
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 3年以内に次のどの行為があった場合、免許証を申請できないか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.04.png
+ localeOptionOrder:
+   A: A タバコを吸う癖 (A: Habit of smoking tobacco)
+   B: B 麻薬注射 (B: Injecting narcotics)
+   C: C インシュリン注射 (C: Insulin injection)
+   D: D 飲酒経験 (D: Experience drinking alcohol)
+ options:
+   q0446_o1: C インシュリン注射
+   q0446_o2: D 飲酒経験
+   q0446_o3: A タバコを吸う癖
+   q0446_o4: B 麻薬注射
```

### q0829

```diff
+ qid: q0829
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 赤い円中の路面標示はなにを示すか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.05.png
+ localeOptionOrder:
+   A: A 一時的な駐車エリア (A. Temporary parking area)
+   B: B 道端にある停留所 (B. Roadside stop)
+   C: C 緊急駐車エリア (C. Emergency parking area)
+   D: D バス停留所 (D. Bus stop)
+ options:
+   q0829_o1: A 一時的な駐車エリア
+   q0829_o2: B 道端にある停留所
+   q0829_o3: C 緊急駐車エリア
+   q0829_o4: D バス停留所
```

### q0129

```diff
+ qid: q0129
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 左側の道路に入り追い越しをかけるさい、通常走行している前車との横の車間距離が十分に確保できない場合どうすべきか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.07 1.png
+ localeOptionOrder:
+   A: A 速度を上げ追い越す (A. Increase your speed and overtake)
+   B: B 一旦並走してから追い越す (B. Run parallel for a while, then overtake)
+   C: C 追い越すことをあきらめる (C. Give up overtaking)
+   D: D 注意して追い越す (D. Overtake with caution)
+ options:
+   q0129_o1: A 速度を上げ追い越す
+   q0129_o2: B 一旦並走してから追い越す
+   q0129_o3: C 追い越すことをあきらめる
+   q0129_o4: D 注意して追い越す
```

### q0390

```diff
+ qid: q0390
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 次のなかのどの人に自動車を渡して運転させた場合、交通警察は法律に基づき免許証を押収することができるか。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.07.png
+ localeOptionOrder:
+   A: A 初心運転者 (A. Beginner driver)
+   B: B 免許証を取得した人 (B. Person who has obtained a license)
+   C: C 免許証が取り消されている人 (C. Person whose license has been revoked)
+   D: D 免許証の交通違反による累積点数が6点になった人 (D. Person whose cumulative points from traffic violations have reached 6 points)
+ options:
+   q0390_o1: A 初心運転者
+   q0390_o2: B 免許証を取得した人
+   q0390_o3: C 免許証が取り消されている人
+   q0390_o4: D 免許証の交通違反による累積点数が6点になった人
```

### q0507

```diff
+ qid: q0507
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 道路で飲酒運転をすると、どのような処罰を受けるのか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.09.png
+ localeOptionOrder:
+   A: A 2年以下の懲役に処される (A: Imprisonment for up to 2 years)
+   B: B 拘留および罰金に処される (B: Detention and/or fine)
+   C: C 2年以上の懲役に処される (C: Imprisonment for more than 2 years)
+   D: D 管制および罰金に処される (D: Supervision and/or fine)
+ options:
+   q0507_o1: D 管制および罰金に処される
+   q0507_o2: C 2年以上の懲役に処される
+   q0507_o3: B 拘留および罰金に処される
+   q0507_o4: A 2年以下の懲役に処される
```

### q0325

```diff
+ qid: q0325
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 廃棄基準に達した自動車であっても、オーバーホールすれば路上で運転することができる。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.10.png
```

### q0570

```diff
+ qid: q0570
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 自動車のインパネの点灯は、運転者のシートベルトが着用されていないことを示している。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.11 1.png
```

### q0385

```diff
+ qid: q0385
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 急な坂を下る・角を曲が合の自動車の最高速度はどれか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.11.png
+ localeOptionOrder:
+   A: A 30km/h (30km/h)
+   B: B 40km/h (40km/h)
+   C: C 50km/h (50km/h)
+   D: D 60km/h (60km/h)
+ options:
+   q0385_o1: C 50km/h
+   q0385_o2: D 60km/h
+   q0385_o3: A 30km/h
+   q0385_o4: B 40km/h
```

### q0374

```diff
+ qid: q0374
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 狭い道路や狭い橋を通る場合の自動車の最高速度はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.12.png
+ localeOptionOrder:
+   A: A 60km/h (A 60 km/h)
+   B: B 50km/h (B 50 km/h)
+   C: C 40km/h (C 40 km/h)
+   D: D 30km/h (D 30 km/h)
+ options:
+   q0374_o1: B 50km/h
+   q0374_o2: C 40km/h
+   q0374_o3: D 30km/h
+   q0374_o4: A 60km/h
```

### q0204

```diff
+ qid: q0204
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 飲酒運転による重大な交通事故を起こし、法律に基づいき刑事責任が追及された者は、運転免許証取得を申請することができない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.14.png
```

### q0026

```diff
+ qid: q0026
+ sourceBucket: reviewed
+ type: ROW
+ prompt: トンネル内では追い越しをしてはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.15.png
```

### q0897

```diff
+ qid: q0897
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: この標識の示す意味はどれか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.39.png
+ localeOptionOrder:
+   A: A 番をする人がいない踏切 (A: Railroad crossing without a gatekeeper)
+   B: B 番をする人がいる踏切 (B: Railroad crossing with a gatekeeper)
+   C: C レールが多い鉄道と道路が交差 (C: Intersection of railway with many rails and road)
+   D: D 立体交差式の踏切 (D: Grade-separated (elevated) railroad crossing)
+ options:
+   q0897_o1: B 番をする人がいる踏切
+   q0897_o2: C レールが多い鉄道と道路が交差
+   q0897_o3: D 立体交差式の踏切
+   q0897_o4: A 番をする人がいない踏切
```

### q0463

```diff
+ qid: q0463
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 自動車を路上で運転する場合、車に掲示しなければならない標識はどれか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.44.png
+ localeOptionOrder:
+   A: A 製品合格マーク (A Product approval mark)
+   B: B 追突注意マーク (B Rear-end collision warning mark)
+   C: C 危険注意マーク (C Danger warning mark)
+   D: D 検査合格マーク (D Inspection approval mark)
+ options:
+   q0463_o1: B 追突注意マーク
+   q0463_o2: C 危険注意マーク
+   q0463_o3: D 検査合格マーク
+   q0463_o4: A 製品合格マーク
```

### q0654

```diff
+ qid: q0654
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 路面の標記は、なにを示す路面標示か。
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.45.png
+ localeOptionOrder:
+   A: A 運転禁止区間 (A. No-driving zone)
+   B: B 網状線 (B. Grid marking)
+   C: C センターサークル (C. Center circle)
+   D: D 自動車の流れを導く線 (D. Line to guide vehicle flow)
+ options:
+   q0654_o1: A 運転禁止区間
+   q0654_o2: B 網状線
+   q0654_o3: D 自動車の流れを導く線
+   q0654_o4: C センターサークル
```

### q0321

```diff
+ qid: q0321
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 交通運輸管理法を違反して重大な交通事故を起こし死者を出した場合、運転者は3年以上の有期懲役を受ける可能性がある。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.49.png
```

### q0348

```diff
+ qid: q0348
+ sourceBucket: reviewed
+ type: ROW
+ prompt: 交通信号に違反した運転者には6点が減点されるつく。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.00 1.png
```

### q0404

```diff
+ qid: q0404
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: 廃棄基準に達した自動車を路上で運転した運転者には、どのような処罰が課されるか。
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.06.png
+ localeOptionOrder:
+   A: A 15日以下の収監 (A: Imprisonment for 15 days or less)
+   B: B 運転免許証の取消 (B: Cancellation of driver's license)
+   C: C 20元以上200元以下の罰金 (C: Fine of not less than 20 yuan and not more than 200 yuan)
+   D: D 刑事責任の追及 (D: Pursuit of criminal responsibility)
+ options:
+   q0404_o1: C 20元以上200元以下の罰金
+   q0404_o2: D 刑事責任の追及
+   q0404_o3: A 15日以下の収監
+   q0404_o4: B 運転免許証の取消
```

### q0057

```diff
+ qid: q0057
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 運転者は交差点に入る前に速度を落として周囲の状況を観察し、安全を確認すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.35.png
```

### q0198

```diff
+ qid: q0198
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 飲酒後でも運転に影響がないかぎり、短距離運転が許可される。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.41.png
```

### q0305

```diff
+ qid: q0305
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 緊急走行中の消防車・救急車・救助専用車に対し、ただちに道をゆずる義務がある。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.50 1.png
```

### q0703

```diff
+ qid: q0703
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: これはどの標識に属すか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.50.png
+ localeOptionOrder:
+   A: A 観光地標識 (A: Tourist area sign)
+   B: B 作業地標識 (B: Work area sign)
+   C: C 告示標識 (C: Notification sign)
+   D: D 高速道路標識 (D: Expressway sign)
+ options:
+   q0703_o1: A 観光地標識
+   q0703_o2: B 作業地標識
+   q0703_o3: C 告示標識
+   q0703_o4: D 高速道路標識
```

### q0330

```diff
+ qid: q0330
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: このような状況で踏み切りを通ろうとする場合、まず停車して様子を見るべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.52.png
```

### q0329

```diff
+ qid: q0329
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 図に示される道路で運転する場合、最高速度は50km/hを超過してはいけない。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.00.54.png
```

### q0309

```diff
+ qid: q0309
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 高速道路で自動車が故障し走行できなくなった場合、救援車・レッカー車で牽引する。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.02.png
```

### q0635

```diff
+ qid: q0635
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: 交差点でこの信号が点灯していたら、自動車は加速して通過すべきである。
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.08.png
```

### q0746

```diff
+ qid: q0746
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この交差点では、どのように走行すべきか。
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.13.png
+ localeOptionOrder:
+   A: A 左折または右折 (A. Turn left or turn right)
+   B: B 直進または左折 (B. Go straight or turn left)
+   C: C 左折 (C. Turn left)
+   D: D 直進または右折 (D. Go straight or turn right)
+ options:
+   q0746_o1: D 直進または右折
+   q0746_o2: C 左折
+   q0746_o3: B 直進または左折
+   q0746_o4: A 左折または右折
```

### q0701

```diff
+ qid: q0701
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: この標識は何を示しているか。
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-07 at 18.01.15 1.png
+ localeOptionOrder:
+   A: A 展望台 (A: Observation deck)
+   B: B 駐車場 (B: Parking lot)
+   C: C 休憩ユリア (C: Rest area)
+   D: D 駐車区画 (D: Parking space)
+ options:
+   q0701_o1: A 展望台
+   q0701_o2: B 駐車場
+   q0701_o3: C 休憩ユリア
+   q0701_o4: D 駐車区画
```

