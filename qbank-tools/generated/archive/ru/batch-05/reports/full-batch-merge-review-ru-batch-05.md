# Full-Batch Dry-Run Merge Review: ru batch-05

- Dataset: `2023-test1`
- Auto-matched items: 6
- Reviewed items: 42
- Equivalent overlaps: 0
- Final total: 47
- Ready for merge: 46
- Blockers: 1
- Safe to merge next step: no
- Full preview: `qbank-tools/generated/staging/translations.ru.batch-05.full.preview.json`
- Dry-run artifact: `qbank-tools/generated/staging/translations.ru.batch-05.full.merge-dry-run.json`

## Blockers

- `q0615` [auto-matched]: answerKeyDecisionConsistent, answerKeyReady

## Diff Summary

### q0480

```diff
+ qid: q0480
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Максимальная скорость при движении по скоростной дороге не может превышать:
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.03.png
+ localeOptionOrder:
+   A: A 100км/ч (100 km/h)
+   B: B 110км/ч (110 km/h)
+   C: C 120км/ч (120 km/h)
+   D: D 90км/ч (90 km/h)
+ options:
+   q0480_o1: B 110км/ч
+   q0480_o2: C 120км/ч
+   q0480_o3: D 90км/ч
+   q0480_o4: A 100км/ч
```

### q0005

```diff
+ qid: q0005
+ sourceBucket: reviewed
+ type: ROW
+ prompt: При заторе на автомагистрали из-за ДТП, разрешена остановка в зоне остановки или проезд по обочине.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/250.png
```

### q0010

```diff
+ qid: q0010
+ sourceBucket: reviewed
+ type: ROW
+ prompt: При движении транспортного средства на автомагистрали, запрещен разворот в месте въезда.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.49.57.png
```

### q0551

```diff
+ qid: q0551
+ sourceBucket: reviewed
+ type: ROW
+ prompt: Данное табло показывает, что настоящая скорость 20 км/час.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.49.58.png
```

### q0811

```diff
+ qid: q0811
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.49.59 1.png
+ localeOptionOrder:
+   A: А Опасная предгорная дорога (A Dangerous foothill road)
+   B: B Отрезок дороги около утеса (B Section of road near a cliff)
+   C: C Риск камнепада (C Risk of falling rocks)
+   D: D Опасный участок дороги (D Dangerous section of road)
+ options:
+   q0811_o1: А Опасная предгорная дорога
+   q0811_o2: B Отрезок дороги около утеса
+   q0811_o3: C Риск камнепада
+   q0811_o4: D Опасный участок дороги
```

### q0389

```diff
+ qid: q0389
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: В том случае, когда транспортное средство сломалось на автомагистрали, запрещено:
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.02.png
+ localeOptionOrder:
+   A: A. Включать аварийную световую сигнализацию (Turn on the hazard warning lights)
+   B: B. Ставить предупреждающий знак (Put up a warning sign)
+   C: C. Запрещена высадка пассажиров (Let passengers get out)
+   D: D. Подавать тревожный сигнал (Give a distress signal)
+ options:
+   q0389_o1: B. Ставить предупреждающий знак
+   q0389_o2: C. Запрещена высадка пассажиров
+   q0389_o3: D. Подавать тревожный сигнал
+   q0389_o4: A. Включать аварийную световую сигнализацию
```

### q0317

```diff
+ qid: q0317
+ sourceBucket: reviewed
+ type: ROW
+ prompt: При развороте водителю необходимо заранее подать сигнал левого поворота.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.03 1.png
```

### q0162

```diff
+ qid: q0162
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: В том случае, когда заднее транспортное средство просит обгон, вам следует:
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.04.png
+ localeOptionOrder:
+   A: A Замедлить ход и ехать по правой стороне дороги, чтобы уступить дорогу (A. Slow down and keep to the right side of the road to give way)
+   B: B Ехать с прежней скоростью (B. Continue at the same speed)
+   C: C Ускорить ход и ехать по правой стороне дороги (C. Speed up and keep to the right side of the road)
+   D: D Не уступать дорогу (D. Do not give way)
+ options:
+   q0162_o1: B Ехать с прежней скоростью
+   q0162_o2: A Замедлить ход и ехать по правой стороне дороги, чтобы уступить дорогу
+   q0162_o3: C Ускорить ход и ехать по правой стороне дороги
+   q0162_o4: D Не уступать дорогу
```

### q0839

```diff
+ qid: q0839
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.05 1.png
+ localeOptionOrder:
+   A: A) Движение по запрещенной полосе запрещено (Driving in the prohibited lane is forbidden)
+   B: B) Перестроение полосы запрещено (Lane changing is forbidden)
+   C: C) Обгон запрещен (Overtaking is forbidden)
+   D: D) Разворот запрещен (U-turn is forbidden)
+ options:
+   q0839_o1: A) Движение по запрещенной полосе запрещено
+   q0839_o2: B) Перестроение полосы запрещено
+   q0839_o3: C) Обгон запрещен
+   q0839_o4: D) Разворот запрещен
```

### q0593

```diff
+ qid: q0593
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что такое подушка безопасности?
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.05.png
+ localeOptionOrder:
+   A: A. Система защиты головы и шеи водителя (A. Driver head and neck protection system)
+   B: B. Система антиблокировочного тормозного устройства (ABS) (B. Anti-lock braking system (ABS))
+   C: C. Электронная система распределения тормозных сил (C. Electronic brake force distribution system)
+   D: D. Вспомогательная система для защиты пассажиров (D. Auxiliary system for passenger protection)
+ options:
+   q0593_o1: B. Система антиблокировочного тормозного устройства (ABS)
+   q0593_o2: C. Электронная система распределения тормозных сил
+   q0593_o3: D. Вспомогательная система для защиты пассажиров
+   q0593_o4: A. Система защиты головы и шеи водителя
```

### q0243

```diff
+ qid: q0243
+ sourceBucket: reviewed
+ type: ROW
+ prompt: В том случае, когда транспортное средство на дороге неисправно и не может продолжить движение, необходимо поставить предупреждающие знаки, на расстоянии не менее 50 метров сзади от автомобиля.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.06.png
```

### q0359

```diff
+ qid: q0359
+ sourceBucket: reviewed
+ type: ROW
+ prompt: Автоинспектор имеет право задержать водителя непригодного автотранспорта.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.08.png
```

### q0214

```diff
+ qid: q0214
+ sourceBucket: reviewed
+ type: ROW
+ prompt: При совершении ДТП, нанесшего при этом телесные повреждения человеку следует немедленно сообщить об этом в милицию.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.09 1.png
```

### q0761

```diff
+ qid: q0761
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.09.png
+ localeOptionOrder:
+   A: A. Общественный телефон автомагистрали (A. Public telephone on the highway)
+   B: B. Экстренный телефон помощи на автомагистрали (B. Emergency assistance telephone on the highway)
+   C: C. Экстренный телефонный аппарат на автомагистрали (C. Emergency telephone device on the highway)
+   D: D. Телефон техпомощи на автомагистрали (D. Roadside assistance telephone on the highway)
+ options:
+   q0761_o1: A. Общественный телефон автомагистрали
+   q0761_o2: D. Телефон техпомощи на автомагистрали
+   q0761_o3: C. Экстренный телефонный аппарат на автомагистрали
+   q0761_o4: B. Экстренный телефон помощи на автомагистрали
```

### q0230

```diff
+ qid: q0230
+ sourceBucket: reviewed
+ type: ROW
+ prompt: На пересечении, в данном случае, автомобилю, который поворачивает, следует уступить автомобилю, который движется прямо.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.10.png
```

### q0117

```diff
+ qid: q0117
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Как ехать при движении на неровной дороге?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.11.png
+ localeOptionOrder:
+   A: A Замедлиться и плавно проехать (A Slow down and drive smoothly)
+   B: B Ускориться и проехать за счет инерции (B Accelerate and pass by inertia)
+   C: C Ехать на нейтральной скорости (C Drive in neutral gear)
+   D: D Держать первоначальную скорость и проехать (D Maintain the initial speed and drive through)
+ options:
+   q0117_o1: A Замедлиться и плавно проехать
+   q0117_o2: D Держать первоначальную скорость и проехать
+   q0117_o3: C Ехать на нейтральной скорости
+   q0117_o4: B Ускориться и проехать за счет инерции
```

### q0780

```diff
+ qid: q0780
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.12 1.png
+ localeOptionOrder:
+   A: A. Сужение дороги (A. Road narrows)
+   B: B. Сужение правой стороны дороги (B. Right side of the road narrows)
+   C: C. Сужение (C. Narrowing)
+   D: D. Узкий мост (D. Narrow bridge)
+ options:
+   q0780_o1: C. Сужение
+   q0780_o2: D. Узкий мост
+   q0780_o3: A. Сужение дороги
+   q0780_o4: B. Сужение правой стороны дороги
```

### q0200

```diff
+ qid: q0200
+ sourceBucket: reviewed
+ type: ROW
+ prompt: В данной ситуации, можно заехать в площадку для ожидания.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.12.png
```

### q0110

```diff
+ qid: q0110
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Экстренное торможение во время влажной погоды на скользкой дороге приводит к:
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.13.png
+ localeOptionOrder:
+   A: A. Выключению двигателя (A. Engine shutdown)
+   B: B. Снижению видимости действий других машин (B. Reduced visibility of other cars' actions)
+   C: C. Столкновению транспортных средств из-за снижения видимости (C. Vehicle collisions due to reduced visibility)
+   D: D. Заносу и ДТП (D. Skidding and accidents)
+ options:
+   q0110_o1: D. Заносу и ДТП
+   q0110_o2: C. Столкновению транспортных средств из-за снижения видимости
+   q0110_o3: B. Снижению видимости действий других машин
+   q0110_o4: A. Выключению двигателя
```

### q0800

```diff
+ qid: q0800
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.14.png
+ localeOptionOrder:
+   A: A Остановиться и получить карту (Stop and get a card)
+   B: B Остановиться и произвести оплату (Stop and pay)
+   C: C Остановиться и проверить (Stop and check)
+   D: D Терминал ETC (ETC terminal)
+ options:
+   q0800_o1: A Остановиться и получить карту
+   q0800_o2: B Остановиться и произвести оплату
+   q0800_o3: D Терминал ETC
+   q0800_o4: C Остановиться и проверить
```

### q0871

```diff
+ qid: q0871
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.15.png
+ localeOptionOrder:
+   A: A Велосипедная полоса (A Bicycle lane)
+   B: B Запрещенная полоса движения велосипеда (B Prohibited lane for bicycles)
+   C: C Специальная полоса для велосипеда (C Special lane for bicycles)
+   D: D Стоянка для велосипеда (D Bicycle parking)
+ options:
+   q0871_o1: B Запрещенная полоса движения велосипеда
+   q0871_o2: A Велосипедная полоса
+   q0871_o3: C Специальная полоса для велосипеда
+   q0871_o4: D Стоянка для велосипеда
```

### q0191

```diff
+ qid: q0191
+ sourceBucket: reviewed
+ type: ROW
+ prompt: Максимальная скорость при вождении автомобиля по городской дороге, не имеющей центральную разметку, не может превышать 50к/ч.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.16.png
```

### q0204

```diff
+ qid: q0204
+ sourceBucket: reviewed
+ type: ROW
+ prompt: Человек, совершивший ДТП в состоянии алкогольного опьянения и судимый за это, не имеет права подачи заявления на водительское удостоверение.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.17.png
```

### q0046

```diff
+ qid: q0046
+ sourceBucket: reviewed
+ type: ROW
+ prompt: При перестроении с одной полосы на другую, следует осмотреть обстановку транспортных средств сзади.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.18 1.png
```

### q0772

```diff
+ qid: q0772
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.18.png
+ localeOptionOrder:
+   A: A) Бюро получения карты на автомагистрали (A) Highway card issuing bureau)
+   B: B) Пункт оплаты на автомагистрали (B) Highway toll booth)
+   C: C) Контрольно-пропускной пункт автомагистрали (C) Highway checkpoint)
+   D: D) Терминал ETC (D) ETC terminal)
+ options:
+   q0772_o1: B) Пункт оплаты на автомагистрали
+   q0772_o2: C) Контрольно-пропускной пункт автомагистрали
+   q0772_o3: D) Терминал ETC
+   q0772_o4: A) Бюро получения карты на автомагистрали
```

### q0580

```diff
+ qid: q0580
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Данная кнопка загорается тогда, когда:
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.19.png
+ localeOptionOrder:
+   A: A. Водитель включает передние противотуманные фары (The driver turns on the front fog lights)
+   B: B. Водитель включает задние противотуманные фары (The driver turns on the rear fog lights)
+   C: C. Водитель включает передние фары ближнего света (The driver turns on the front low beam headlights)
+   D: D. Водитель включает задние фары дальнего света (The driver turns on the rear high beam headlights)
+ options:
+   q0580_o1: A. Водитель включает передние противотуманные фары
+   q0580_o2: C. Водитель включает передние фары ближнего света
+   q0580_o3: D. Водитель включает задние фары дальнего света
+   q0580_o4: B. Водитель включает задние противотуманные фары
```

### q0638

```diff
+ qid: q0638
+ sourceBucket: reviewed
+ type: ROW
+ prompt: При мигании данного сигнала, разрешен поворот налево перед встречным транспортом.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.21 1.png
```

### q0369

```diff
+ qid: q0369
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Автоинспектор имеет право задержать автомобиль по закону, если водитель не имеет при себе:
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.21.png
+ localeOptionOrder:
+   A: A Водительское удостоверение (A Driver's license)
+   B: B Удостоверение личности (B Identity document)
+   C: C Трудовую книжку (C Work record book)
+   D: D Пропускной талон (D Pass card)
+ options:
+   q0369_o1: A Водительское удостоверение
+   q0369_o2: B Удостоверение личности
+   q0369_o3: D Пропускной талон
+   q0369_o4: C Трудовую книжку
```

### q0812

```diff
+ qid: q0812
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.22.png
+ localeOptionOrder:
+   A: A Расстояние от железнодорожного переезда без пункта охраны 50 метров (Distance to an unguarded railway crossing is 50 meters)
+   B: B Расстояние от железнодорожного переезда с пунктом охраны 50 метров (Distance to a guarded railway crossing is 50 meters)
+   C: C Расстояние от железнодорожного переезда без пункта охраны 100 метров (Distance to an unguarded railway crossing is 100 meters)
+   D: D Расстояние от железнодорожного переезда с пунктом охраны 100 метров (Distance to a guarded railway crossing is 100 meters)
+ options:
+   q0812_o1: B Расстояние от железнодорожного переезда с пунктом охраны 50 метров
+   q0812_o2: C Расстояние от железнодорожного переезда без пункта охраны 100 метров
+   q0812_o3: D Расстояние от железнодорожного переезда с пунктом охраны 100 метров
+   q0812_o4: A Расстояние от железнодорожного переезда без пункта охраны 50 метров
```

### q0826

```diff
+ qid: q0826
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означают выделенные в кругу линии?:
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.23.png
+ localeOptionOrder:
+   A: A) Изменчивая указательная линия (A) Variable guiding line)
+   B: B) Указательная (B) Guiding)
+   C: C) Указательная линия направления (C) Direction guiding line)
+   D: D) Односторонняя линия (D) One-way line)
+ options:
+   q0826_o1: B) Указательная
+   q0826_o2: A) Изменчивая указательная линия
+   q0826_o3: C) Указательная линия направления
+   q0826_o4: D) Односторонняя линия
```

### q0842

```diff
+ qid: q0842
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.25 1.png
+ localeOptionOrder:
+   A: A) Полоса снижения скорости в 40м (A) Lane for reducing speed within 40 meters)
+   B: B) Минимальная скорость 40км/ч (B) Minimum speed 40 km/h)
+   C: C) Снятие ограничения скорости на 40км/ч (C) End of 40 km/h speed limit)
+   D: D) Максимальная скорость — 40км/ч (D) Maximum speed — 40 km/h)
+ options:
+   q0842_o1: A) Полоса снижения скорости в 40м
+   q0842_o2: B) Минимальная скорость 40км/ч
+   q0842_o3: D) Максимальная скорость — 40км/ч
+   q0842_o4: C) Снятие ограничения скорости на 40км/ч
```

### q0379

```diff
+ qid: q0379
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Какой из ниже приведенных документов обязан иметь водитель при управлении автотранспортным средством?
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.25.png
+ localeOptionOrder:
+   A: A Регистрационные документы на автомобиль (A Registration documents for the car)
+   B: B Страховой полис автомобиля (B Car insurance policy)
+   C: C Водительское удостоверение на право управления автомобилем (C Driver's license to operate a car)
+   D: D Удостоверение о пригодности автомобиля (D Certificate of vehicle fitness)
+ options:
+   q0379_o1: B Страховой полис автомобиля
+   q0379_o2: C Водительское удостоверение на право управления автомобилем
+   q0379_o3: D Удостоверение о пригодности автомобиля
+   q0379_o4: A Регистрационные документы на автомобиль
```

### q0471

```diff
+ qid: q0471
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: На какой срок приговаривается к тюремному заключению водитель, который совершил значительное ДТП, приведшее к смерти людей, из-за нарушения правила дорожного движения и, к тому же, скрывшийся с места преступления?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.26.png
+ localeOptionOrder:
+   A: A) Больше 7 лет (More than 7 years)
+   B: B) Меньше 3 лет (Less than 3 years)
+   C: C) Больше 3 лет и меньше 7 лет (More than 3 years and less than 7 years)
+   D: D) Больше 10 лет (More than 10 years)
+ options:
+   q0471_o1: D) Больше 10 лет
+   q0471_o2: B) Меньше 3 лет
+   q0471_o3: C) Больше 3 лет и меньше 7 лет
+   q0471_o4: A) Больше 7 лет
```

### q0434

```diff
+ qid: q0434
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Нарушение правил дорожного движения во время управления автотранспортным средством на дороге это:
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.27.png
+ localeOptionOrder:
+   A: A Действие нарушения положений (Action of violating provisions)
+   B: B Действие нарушения закона (Action of breaking the law)
+   C: C Действие по неосторожности (Action by negligence)
+   D: D Действие нарушения правила (Action of violating a rule)
+ options:
+   q0434_o1: C Действие по неосторожности
+   q0434_o2: A Действие нарушения положений
+   q0434_o3: D Действие нарушения правила
+   q0434_o4: B Действие нарушения закона
```

### q0776

```diff
+ qid: q0776
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.28 1.png
+ localeOptionOrder:
+   A: A Указание поворота вправо (A Indication of right turn)
+   B: B Указание изменения дороги влево (B Indication of road change to the left)
+   C: C Указание прямого движения (C Indication of straight movement)
+   D: D Указание поворота налево (D Indication of left turn)
+ options:
+   q0776_o1: B Указание изменения дороги влево
+   q0776_o2: C Указание прямого движения
+   q0776_o3: D Указание поворота налево
+   q0776_o4: A Указание поворота вправо
```

### q0865

```diff
+ qid: q0865
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.28.png
+ localeOptionOrder:
+   A: A Дорога около утеса (A Road near a cliff)
+   B: B Дорога около плотины (B Road near a dam)
+   C: C Опасная горная дорога (C Dangerous mountain road)
+   D: D Опасная горная дорога с риском камнепада (D Dangerous mountain road with risk of rockfall)
+ options:
+   q0865_o1: B Дорога около плотины
+   q0865_o2: C Опасная горная дорога
+   q0865_o3: D Опасная горная дорога с риском камнепада
+   q0865_o4: A Дорога около утеса
```

### q0577

```diff
+ qid: q0577
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Данная кнопка относится к включению:
+ localeCorrectOptionKey: B
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.29.png
+ localeOptionOrder:
+   A: A. Стеклоочистителей инея или тумана заднего ветрового стекла (A. Rear window defogger or mist wipers)
+   B: B. Стеклоочистителей переднего ветрового стекла (B. Front windshield wipers)
+   C: C. Стеклоочистителей заднего ветрового стекла (C. Rear windshield wipers)
+   D: D. Стеклоочистителей инея или тумана переднего ветрового стекла (D. Front window defogger or mist wipers)
+ options:
+   q0577_o1: D. Стеклоочистителей инея или тумана переднего ветрового стекла
+   q0577_o2: C. Стеклоочистителей заднего ветрового стекла
+   q0577_o3: B. Стеклоочистителей переднего ветрового стекла
+   q0577_o4: A. Стеклоочистителей инея или тумана заднего ветрового стекла
```

### q0149

```diff
+ qid: q0149
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Какую полосу движения следует выбрать при проезде через пункт оплаты за проезд по автомагистрали?
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.30 1.png
+ localeOptionOrder:
+   A: Полосу с наибольшим количеством автомобилей (The lane with the most cars)
+   B: Полосу с мигающим красным сигналом светофора (The lane with a flashing red traffic light)
+   C: Приостановиться (Stop)
+   D: Полосу с мигающим зеленым сигналом светофора (The lane with a flashing green traffic light)
+ options:
+   q0149_o1: Полосу с наибольшим количеством автомобилей
+   q0149_o2: Полосу с мигающим красным сигналом светофора
+   q0149_o3: Полосу с мигающим зеленым сигналом светофора
+   q0149_o4: Приостановиться
```

### q0837

```diff
+ qid: q0837
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: Что означает данный знак?
+ localeCorrectOptionKey: D
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.30.png
+ localeOptionOrder:
+   A: A Уступи дорогу (Give way)
+   B: B Железнодорожный переезд с пунктом охраны (Railroad crossing with a guard post)
+   C: C Железнодорожный переезд без пункта охраны (Railroad crossing without a guard post)
+   D: D Многочисленные железнодорожные пути пересекающие дорогу (Multiple railway tracks crossing the road)
+ options:
+   q0837_o1: B Железнодорожный переезд с пунктом охраны
+   q0837_o2: C Железнодорожный переезд без пункта охраны
+   q0837_o3: D Многочисленные железнодорожные пути пересекающие дорогу
+   q0837_o4: A Уступи дорогу
```

### q0632

```diff
+ qid: q0632
+ sourceBucket: reviewed
+ type: ROW
+ prompt: Запрещено движение автотранспортных средств на перекрестке при мигании данного сигнала светофора.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.56.png
```

### q0510

```diff
+ qid: q0510
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: На этом участке дороги максимальная скорость движения не может превышать:
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.57.png
+ localeOptionOrder:
+   A: A 30км/ч (30 km/h)
+   B: B 40км/ч (40 km/h)
+   C: C 50км/ч (50 km/h)
+   D: D 70км/ч (70 km/h)
+ options:
+   q0510_o1: A 30км/ч
+   q0510_o2: B 40км/ч
+   q0510_o3: C 50км/ч
+   q0510_o4: D 70км/ч
```

### q0419

```diff
+ qid: q0419
+ sourceBucket: reviewed
+ type: MCQ
+ prompt: К какому незаконному действию относится временная остановка красного легкового автомобиля, в ситуации на рисунке?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.15 1.png
+ localeOptionOrder:
+   A: A Остановка на расстоянии 30 м от заправочной станции (A. Stopping at a distance of 30 m from a gas station)
+   B: B Остановка на велосипедной полосе (B. Stopping in the bicycle lane)
+   C: C Превышение расстояния от обочины больше чем на 30 см (C. Distance from the curb exceeds 30 cm)
+   D: D Остановка на участке с нанесенной разметкой, запрещающей остановку (D. Stopping in an area marked with a line prohibiting stopping)
+ options:
+   q0419_o1: C Превышение расстояния от обочины больше чем на 30 см
+   q0419_o2: D Остановка на участке с нанесенной разметкой, запрещающей остановку
+   q0419_o3: A Остановка на расстоянии 30 м от заправочной станции
+   q0419_o4: B Остановка на велосипедной полосе
```

### q0383

```diff
+ qid: q0383
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: Как часто водители в возрасте старше 60 лет обязаны предоставлять справку медицинского осмотра?
+ localeCorrectOptionKey: C
+ sourceImage: screenshots/200.png
+ localeOptionOrder:
+   A: A) Каждые 3 года (Every 3 years)
+   B: B) Каждые 2 года (Every 2 years)
+   C: C) Каждый год (Every year)
+   D: D) Каждые 6 месяцев (Every 6 months)
+ options:
+   q0383_o1: A) Каждые 3 года
+   q0383_o2: B) Каждые 2 года
+   q0383_o3: D) Каждые 6 месяцев
+   q0383_o4: C) Каждый год
```

### q0436

```diff
+ qid: q0436
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: В каком из следующих случаев водителю запрещено управлять автомобилем?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.49.59.png
+ localeOptionOrder:
+   A: A) После питья алкогольных напитков (After drinking alcoholic beverages)
+   B: B) После питья чая (After drinking tea)
+   C: C) После питья кофе (After drinking coffee)
+   D: D) После питья молока (After drinking milk)
+ options:
+   q0436_o1: C) После питья кофе
+   q0436_o2: D) После питья молока
+   q0436_o3: A) После питья алкогольных напитков
+   q0436_o4: B) После питья чая
```

### q0019

```diff
+ qid: q0019
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: При встрече двух автомобилей на узкой дороге, следует первым снизить скорость, остановиться и уступить дорогу.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.00.png
```

### q0615

```diff
+ qid: q0615
+ sourceBucket: auto-matched
+ type: MCQ
+ prompt: Какую часть транспортного средства включает данный выключатель?
+ localeCorrectOptionKey: A
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.01 1.png
+ localeOptionOrder:
+   A: A Противотуманное устройство (A Fog device)
+   B: B Стеклоочиститель (B Windshield wiper)
+   C: C Аварийные световые сигнализации (C Hazard warning lights)
+   D: D Устройство света и сигнала (D Light and horn device)
+ options:
+   q0615_o1: B Стеклоочиститель
+   q0615_o2: A Противотуманное устройство
+   q0615_o3: C Аварийные световые сигнализации
+   q0615_o4: D Устройство света и сигнала
```

### q0079

```diff
+ qid: q0079
+ sourceBucket: auto-matched
+ type: ROW
+ prompt: До начала старта в темное время суток, следует включить фары ближнего света.
+ localeCorrectOptionKey: n/a
+ sourceImage: screenshots/Screenshot 2026-04-19 at 18.50.24.png
```

