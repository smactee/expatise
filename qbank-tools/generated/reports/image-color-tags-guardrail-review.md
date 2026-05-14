# Image Color Tags Guardrail Review

Generated: 2026-05-14T04:46:36.857Z
Source file: public/qbank/2023-test1/image-color-tags.json
Mode: read-only-diff-review

## Summary

- changedQids: 130
- additiveOnly: 91
- removals: 4
- structural: 21
- valueChanges: 39
- expectedIntentional: 0
- unsafeOrAccidental: 39
- recommendations: {"keep":91,"revert or needs human review":24,"requires explicit image-tag correction override":15}

## Guard Note

- Existing guard flag for value corrections: `npm run guard-protected-qbank-files -- --allow-questions-master-edit true --allow-image-tag-correction true`
- Safe to use image-tag correction override without structural changes: no
- Only high-risk changes are known stale q0001/q0003 removals: no

## Changed QIDs

| QID | Classification | Risk | Recommended action | Before summary | After summary |
| --- | --- | --- | --- | --- | --- |
| q0226 | additive-only | low | keep | assets=1<br>colors=[white, gray]<br>objects=[pov, 80, 50, alone, lonely, countryroad, grass]<br>dominant=1 | assets=1<br>colors=[white, gray]<br>objects=[pov, 80, 50, alone, lonely, countryroad, grass, sky, yellow-solid-line, white-solid-line]<br>dominant=1 |
| q0228 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[pov, car, white-car, tree, police-car, building, popo]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[pov, car, white-car, tree, police-car, building, popo, redwhitenblue, flashing-lights]<br>dominant=1 |
| q0259 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[pov, tree, trees, highway, 40, alone, blue-arrow]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[pov, tree, trees, highway, 40, alone, blue-arrow, countryroad, merge, exit]<br>dominant=1 |
| q0260 | additive-only | low | keep | assets=1<br>colors=[gray, blue]<br>objects=[car, blue-car, purple-car, highway]<br>dominant=1 | assets=1<br>colors=[gray, blue]<br>objects=[car, blue-car, purple-car, highway, merge, white-solid-line, sky, clouds, guardrail, left-turn]<br>dominant=1 |
| q0272 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[bicycle, car, green-car, building, tree]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[bicycle, car, green-car, building, tree, buildings, yellow-solid-line, trees]<br>dominant=1 |
| q0281 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[car, green-car, building, department-store, shopping-mall, clouds, bus-stop]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[car, green-car, building, department-store, shopping-mall, clouds, bus-stop, street-lights, city, city-road, yellow-solid-line, white-dashed-lines]<br>dominant=1 |
| q0289 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[pov, car, red-car, green-car, building, tree, trees, buildings]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[pov, car, red-car, green-car, building, tree, trees, buildings, merge, city, city-road]<br>dominant=1 |
| q0292 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[car, blue-car, tree, 40, trees, highway]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[car, blue-car, tree, 40, trees, highway, merge, exit, clouds, white-dashed-lines, highway, countryroad]<br>dominant=1 |
| q0361 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[pov, car, silver-car]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[pov, car, silver-car, grass, sky, road-sign, rang, chinese-text, white-dashed-lines, triangle, white-triangle]<br>dominant=1 |
| q0367 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[pov, clouds, 90, countryroad, alone, lonley, highway]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[pov, clouds, 90, countryroad, alone, lonley, highway, white-dashed-lines, sky]<br>dominant=1 |
| q0372 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[brown-building, buildings, green-light, building]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[brown-building, buildings, green-light, building, crosswalk, intersection, sky, city]<br>dominant=1 |
| q0378 | additive-only | low | keep | assets=1<br>colors=[white, gray]<br>objects=[car, red-car, police-car, popo, clouds]<br>dominant=1 | assets=1<br>colors=[white, gray]<br>objects=[car, red-car, police-car, popo, clouds, siren, yellow-solid-line, sky, guardrail, highway, double-yellow-solid-line, highway, countryroad, trees]<br>dominant=1 |
| q0380 | additive-only | low | keep | assets=1<br>colors=[white, gray]<br>objects=[arrow, crosswalk, traffic-light, pov, house, houses, tree, trees, grass, intersection, three-lights, three-signals, red-red-green]<br>dominant=1 | assets=1<br>colors=[white, gray]<br>objects=[arrow, crosswalk, traffic-light, pov, house, houses, tree, trees, grass, intersection, three-lights, three-signals, red-red-green, no-no-yes]<br>dominant=1 |
| q0398 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[blue, gray]<br>objects=[pov, silver-car, car]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[pov, car, silver-car, grass, sky, road-sign, rang, chinese-text, white-dashed-lines, triangle, white-triangle]<br>dominant=1 |
| q0408 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[pov, green-light]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[pov, green-light, white-arrow, white-dashed-lines, white-solid-line, grass, sky, clouds, trees, liberal]<br>dominant=1 |
| q0414 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[red-light, building, crosswalk, city, buildings, intersection]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[red-light, building, crosswalk, city, buildings, intersection, yellow-solid-line, city, city-road]<br>dominant=1 |
| q0418 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[pov, car, red-car, tree, trees, green-light, green-signal, crosswalk, clouds, intersection]<br>dominant=1 | assets=1<br>colors=[blue, gray, white]<br>objects=[pov, car, red-car, tree, trees, green-light, green-signal, crosswalk, clouds, intersection, yellow-solid-line, yellow-grid]<br>dominant=1 |
| q0424 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[car, red-car, orange-car, building, tree, trees, buildings, crosswalk, people, pedestrians, pedestrian]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[car, red-car, orange-car, building, tree, trees, buildings, crosswalk, people, pedestrians, pedestrian, crash]<br>dominant=1 |
| q0425 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[pov, silver-car, car, tree]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[pov, silver-car, car, tree, trees, grass, sky, countryroad]<br>dominant=1 |
| q0475 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[car, silver-car, trees, grass, countryroad, dragonballz]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[car, silver-car, trees, grass, countryroad, dragonballz, yellow-dashed-line]<br>dominant=1 |
| q0485 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[pov, car, blue-car, merge]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[pov, car, blue-car, merge, highway, white-solid-line, clouds, sky]<br>dominant=1 |
| q0493 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[silver-car, car, building, tree]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[silver-car, car, building, tree, gray-car, bus-stop, yellow-solid-line, double-yellow-solid-line, people, trees, buildings, city-road, city]<br>dominant=1 |
| q0497 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[rain, pov, car, silver-car]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[rain, pov, car, silver-car, raining, trees, wiper, windshield]<br>dominant=1 |
| q0525 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[stalk, control-lever]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[stalk, control-lever, circle-red, wheel, dashboard, twsit]<br>dominant=1 |
| q0526 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[white, gray]<br>objects=[needs-tag-review]<br>dominant=1 | assets=1<br>colors=[white, gray]<br>objects=[needle, dashboard, devil, satan, 666, 166, 166.66, 666.6]<br>dominant=1 |
| q0547 | additive-only | low | keep | assets=1<br>colors=[orange, gray, black]<br>objects=[windshield]<br>dominant=1 | assets=1<br>colors=[orange, gray, black]<br>objects=[windshield, wavy, squiggly, heat, wind]<br>dominant=1 |
| q0552 | removal+value-change | high | revert or needs human review | assets=1<br>colors=[yellow, gray]<br>objects=[indicator, dashboard-indicator, car-icon, yellow-car-icon, open-door, vehicle-top-view, warning-light, gray-background]<br>dominant=1 | assets=1<br>colors=[yellow, gray]<br>objects=[car, yellow-car, left-door, door-open]<br>dominant=1 |
| q0559 | additive-only | low | keep | assets=1<br>colors=[red, gray]<br>objects=[lamp]<br>dominant=1 | assets=1<br>colors=[red, gray]<br>objects=[lamp, genie, droplet, tear, blood, aladdin, red-lamp]<br>dominant=1 |
| q0567 | structural+value-change+additive | high | revert or needs human review | assets=1<br>colors=[gray, green]<br>objects=[90]<br>dominant=1 | assets=1<br>colors=[gray, black, white]<br>objects=[90, 50, 130, needle, C]<br>dominant=1 |
| q0568 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[gray]<br>objects=[yellow-sign, triangle]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[gas, fuel, tank, 0, 1/2, 1/1]<br>dominant=1 |
| q0570 | additive-only | low | keep | assets=1<br>colors=[red, gray]<br>objects=[seatbelt]<br>dominant=1 | assets=1<br>colors=[red, gray]<br>objects=[seatbelt, human, stick-figure]<br>dominant=1 |
| q0585 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[?, pedal, center-console, interior, inside]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[?, pedal, center-console, interior, inside, middle-pedal]<br>dominant=1 |
| q0587 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[?, center-console, interior, inside, 페달, 브레이크]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[?, center-console, interior, inside, 페달, 브레이크, right-pedal]<br>dominant=1 |
| q0588 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[?, emergency, brake, 주차 브레이크, parking-brake, center-console, interior, inside]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[?, emergency, brake, 주차 브레이크, parking-brake, center-console, interior, inside, emergency]<br>dominant=1 |
| q0590 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[?, center-console, interior, inside]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[?, center-console, interior, inside, lef-pedal]<br>dominant=1 |
| q0595 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[blue, gray]<br>objects=[seatbelt, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[human, airbag, motorboat, inyourface]<br>dominant=1 |
| q0600 | structural+value-change+additive | high | revert or needs human review | assets=1<br>colors=[gray]<br>objects=[gas-station, gas-pump, flooded, water]<br>dominant=1 | assets=1<br>colors=[gray, black, red, blue]<br>objects=[guage, fuel, E, F, gas, pump, needle, oil]<br>dominant=1 |
| q0605 | additive-only | low | keep | assets=1<br>colors=[red, gray]<br>objects=[seatbelt]<br>dominant=1 | assets=1<br>colors=[red, gray]<br>objects=[seatbelt, strapped, stick-figure, red-person, human]<br>dominant=1 |
| q0606 | removal+value-change | high | revert or needs human review | assets=1<br>colors=[yellow, gray]<br>objects=[indicator, dashboard-indicator, car-icon, yellow-car-icon, open-trunk, vehicle-side-view, warning-light, gray-background]<br>dominant=1 | assets=1<br>colors=[yellow, gray]<br>objects=[car, yellow-car, hood, open-hood]<br>dominant=1 |
| q0610 | structural+value-change+additive | high | revert or needs human review | assets=1<br>colors=[red, gray]<br>objects=[gas-station, gas-pump, flooded, water]<br>dominant=1 | assets=1<br>colors=[red, gray, black, blue]<br>objects=[C, H, key, waves, needle]<br>dominant=1 |
| q0611 | value-change | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[red, gray]<br>objects=[lamp, red-lamp, genie, aladin, blood, tear, droplet]<br>dominant=1 | assets=1<br>colors=[red, gray]<br>objects=[lamp, red-lamp, genie, aladdin, blood, tear, droplet]<br>dominant=1 |
| q0628 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[white, gray]<br>objects=[needs-tag-review]<br>dominant=1 | assets=1<br>colors=[white, gray]<br>objects=[stick-figure, white-arrow, right-arrow, arrow,, human]<br>dominant=1 |
| q0630 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[stalk, control-lever]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[stalk, control-lever, circle-red, twist, wheel, dashboard]<br>dominant=1 |
| q0637 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[arrow, pov, car, yellow-car, building, tree]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[arrow, pov, car, yellow-car, building, tree, crosswalk, no-no-yes, red-red-green, intersection]<br>dominant=1 |
| q0638 | additive-only | low | keep | assets=1<br>colors=[blue, gray, purple]<br>objects=[traffic-light, intersection, crosswalk, pov, purple-car, car, red-circle, green-light, building, tree, trees, skyscapers]<br>dominant=1 | assets=1<br>colors=[blue, gray, purple]<br>objects=[traffic-light, intersection, crosswalk, pov, purple-car, car, red-circle, green-light, building, tree, trees, skyscapers, pimp, slickback, pimpnamedslickback, left-arrow, left-turn]<br>dominant=1 |
| q0644 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[pov, car, purple-car, building, tree]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[pov, car, purple-car, building, tree, overpass,, glass, white-dashed-lines, white-solid-line, yes-no-yes, green-red-green, trees, buildings, city, city-road, pedestrian, pedestrians]<br>dominant=1 |
| q0646 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[arrow, pov, car, green-car, building, tree]<br>dominant=1 | assets=1<br>colors=[green, gray]<br>objects=[arrow, pov, car, green-car, building, tree, overpass, green-green-green, yes-yes-yes, city, city-road, trees, white-dashed-lines, white-solid-line, guardrail, glass, conservative, far-right]<br>dominant=1 |
| q0649 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[train, railroad, pov, car, red-car, tree, railway, red-light]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[train, railroad, pov, car, red-car, tree, railway, red-light, road-sign, train-tracks, sky, grass, double-red, red-signal]<br>dominant=1 |
| q0650 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[pov, green-light, building, tree, crosswalk, intersection, skyscapers]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[pov, green-light, building, tree, crosswalk, intersection, skyscapers, sky, clouds]<br>dominant=1 |
| q0651 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[man, human, run, running-man]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[man, human, run, running-man, stick-figure, white-man, white-person]<br>dominant=1 |
| q0659 | value-change+additive | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[yellow, black]<br>objects=[s203]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[s203, s, s2, s20, s203, 203, highway-sign]<br>dominant=1 |
| q0663 | additive-only | low | keep | assets=1<br>colors=[green, white]<br>objects=[coffee, parking, p, chinese-text, P, arrow, highway-sign, white-arrow]<br>dominant=1 | assets=1<br>colors=[green, white]<br>objects=[coffee, parking, p, chinese-text, P, arrow, highway-sign, white-arrow, right-arrow]<br>dominant=1 |
| q0664 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[yellow, white]<br>objects=[bridge, sign, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[움푹, bump, hole, triangle, dip, hollow]<br>dominant=1 |
| q0665 | removal+value-change | high | revert or needs human review | assets=1<br>colors=[red, white]<br>objects=[red-circle, sign, needs-tag-review, red-white, red-slash]<br>dominant=1 | assets=1<br>colors=[red, white]<br>objects=[red-white, red-slash, candycane]<br>dominant=1 |
| q0667 | additive-only | low | keep | assets=1<br>colors=[yellow, black]<br>objects=[house, tree]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[house, tree, black-tree, black-house, triangle]<br>dominant=1 |
| q0668 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[yellow, white]<br>objects=[sign, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[^, car, black-car, black-dashed-lines, ^^]<br>dominant=1 |
| q0670 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrows, three-arrows, highway-sign, white-arrow]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrows, three-arrows, highway-sign, white-arrow, white-dashed-lines, highway-sign, left-straight-right]<br>dominant=1 |
| q0671 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[cctv, camera, big-brother, george-orwell, 1984, big brother is watching]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[cctv, camera, big-brother, george-orwell, 1984, big brother is watching, cheese, say cheese]<br>dominant=1 |
| q0674 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[blue]<br>objects=[crosswalk, bicycle, red-circle, roadway]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[bicycle, red-circle, roadway, white-dashed-lines, white-solid-line, white-arrow]<br>dominant=1 |
| q0677 | value-change | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[blue, white]<br>objects=[sign, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[umbrella, popo]<br>dominant=1 |
| q0678 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[crosswalk, traffic-light, pov, tree, three-lights, no-no-yes, red-red-green]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[crosswalk, traffic-light, pov, tree, three-lights, no-no-yes, red-red-green, crosswalk, intersection, trees, clouds, sky, ocean]<br>dominant=1 |
| q0682 | additive-only | low | keep | assets=1<br>colors=[yellow, white]<br>objects=[train, railroad]<br>dominant=1 | assets=1<br>colors=[yellow, white, black, red]<br>objects=[train, railroad, single-slash, train-sign, black-train, red-slash]<br>dominant=1 |
| q0684 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[red, white]<br>objects=[sign, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[red, white]<br>objects=[circle, 3, m, 3m]<br>dominant=1 |
| q0687 | value-change+additive | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[white, black]<br>objects=[y002]<br>dominant=1 | assets=1<br>colors=[white, black]<br>objects=[y002, 002, 00, 02, y00, y0]<br>dominant=1 |
| q0702 | additive-only | low | keep | assets=1<br>colors=[yellow, green]<br>objects=[60, 60km/h]<br>dominant=1 | assets=1<br>colors=[yellow, green, gray, white]<br>objects=[60, 60km/h, white-dashed-lines, white-solid-line, clouds, dark-clouds]<br>dominant=1 |
| q0705 | additive-only | low | keep | assets=1<br>colors=[white, gray]<br>objects=[arrow, arrows, two-arrows, right-turn]<br>dominant=1 | assets=1<br>colors=[white, gray]<br>objects=[arrow, arrows, two-arrows, right-turn, double-headed-arrow, straight-right]<br>dominant=1 |
| q0713 | value-change | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[yellow, black]<br>objects=[deer, wildlife, antlers, rudolph, reindeer, bambi]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[deer, wildlife, antlers, rudolph, reindeer, bambi]<br>dominant=1 |
| q0714 | additive-only | low | keep | assets=1<br>colors=[red, white, black]<br>objects=[car, black-car]<br>dominant=1 | assets=1<br>colors=[red, white, black]<br>objects=[car, black-car, circle]<br>dominant=1 |
| q0716 | additive-only | low | keep | assets=1<br>colors=[red, white, black]<br>objects=[arrow, arrows, two-arrows, double-arrows]<br>dominant=1 | assets=1<br>colors=[red, white, black]<br>objects=[arrow, arrows, two-arrows, double-arrows, double-headed-arrow, black-arrow, left-right]<br>dominant=1 |
| q0717 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrow, arrows, double-arrows, two-arrows, straight-left, white-arrow]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, arrows, double-arrows, two-arrows, straight-left, white-arrow, two-headed-arrow, double-headed-arrow]<br>dominant=1 |
| q0719 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrow, right-arrow]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, right-arrow, white-arrow]<br>dominant=1 |
| q0720 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[bus]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[bus, highway-sign, white-dashed-lines, down-arrow, white-arrow, arrow]<br>dominant=1 |
| q0722 | additive-only | low | keep | assets=1<br>colors=[green, gray]<br>objects=[red-circle, roadway]<br>dominant=1 | assets=1<br>colors=[green, gray, yellow, green, flowers]<br>objects=[red-circle, roadway, <, <<, highway, white-dashed-lines, white-solid-line, road-sign, flowers]<br>dominant=1 |
| q0724 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[blue]<br>objects=[yellow-sign, triangle, sign]<br>dominant=1 | assets=1<br>colors=[gray, yellow, white]<br>objects=[arrow,, white-arrow, yellow-solid-line, double-yellow-solid-line, opposite-arrows]<br>dominant=1 |
| q0726 | structural+value-change+additive | high | revert or needs human review | assets=1<br>colors=[gray]<br>objects=[needs-tag-review]<br>dominant=1 | assets=1<br>colors=[gray, white]<br>objects=[white-arrow, white-solid-line, arrow]<br>dominant=1 |
| q0727 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[white, gray]<br>objects=[sign, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[white, blue, black]<br>objects=[umbrella, popo]<br>dominant=1 |
| q0729 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[train, railroad, pov, red-light, tree]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[train, railroad, pov, red-light, tree, railway, choochoo, train-sign, road-sign, train-tracks, red-car, sky, clouds]<br>dominant=1 |
| q0732 | additive-only | low | keep | assets=1<br>colors=[yellow, black]<br>objects=[children, kids, schoolkids]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[children, kids, schoolkids, black-kids, black-people]<br>dominant=1 |
| q0733 | value-change+additive | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[yellow, black]<br>objects=[car, skid]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[car, skid, black-car, skrr]<br>dominant=1 |
| q0737 | value-change+additive | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[blue, white]<br>objects=[arrow, arrows, two-arrows, double-arrows, blue-arrows]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, arrows, two-arrows, double-arrows, blue-arrows, double-headed-arrow, white-arrow, road-sign, white-dashed-lines, straight-uturn]<br>dominant=1 |
| q0739 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrow, 4, 4m]<br>dominant=1 | assets=1<br>colors=[blue, white, black]<br>objects=[arrow, 4, 4m, black-arrow, road-sign, snake, up-arrow]<br>dominant=1 |
| q0742 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[p, parking, parking-lot, omega, P, arrows]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[p, parking, parking-lot, omega, P, arrows, white-arrow, up-arrow]<br>dominant=1 |
| q0745 | additive-only | low | keep | assets=1<br>colors=[gray, yellow]<br>objects=[red-circle, yellow-line, yellow-sign, roadway, yellow-dashed-line]<br>dominant=1 | assets=1<br>colors=[gray, yellow]<br>objects=[red-circle, yellow-line, yellow-sign, roadway, yellow-dashed-line, road-sign, narrows, ㅏ, omega, white-arrow, yellow-dashed-line, white-dashed-lines, white-solid-line, city-road, narrows]<br>dominant=1 |
| q0753 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[right-turn, arrow, sign]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[right-turn, arrow, sign, white-arrow, right-arrow, down-arrow]<br>dominant=1 |
| q0754 | value-change+additive | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[blue, white]<br>objects=[arrow, twisted, arrows, double-arrows, two-arrows]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, twisted, arrows, double-arrows, two-arrows, straight-left, white-arrow]<br>dominant=1 |
| q0755 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrow, white-arrow, left-arrow, highway-sign]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, white-arrow, left-arrow, highway-sign, white-dashed-lines]<br>dominant=1 |
| q0760 | additive-only | low | keep | assets=1<br>colors=[green, white]<br>objects=[chinese-text, g2]<br>dominant=1 | assets=1<br>colors=[green, white, red]<br>objects=[chinese-text, g2]<br>dominant=1 |
| q0761 | additive-only | low | keep | assets=1<br>colors=[green, white]<br>objects=[telephone]<br>dominant=1 | assets=1<br>colors=[green, white, black]<br>objects=[telephone, phone, black-phone, 여보세요]<br>dominant=1 |
| q0762 | additive-only | low | keep | assets=1<br>colors=[gray, grey]<br>objects=[red-circle, intersection, roadway]<br>dominant=1 | assets=1<br>colors=[gray, grey, white, yellow]<br>objects=[red-circle, intersection, roadway, white-dashed-lines, triangle, city, city-road]<br>dominant=1 |
| q0766 | value-change | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[yellow, white]<br>objects=[bridge, sign, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[hump, humps, double-hump]<br>dominant=1 |
| q0767 | additive-only | low | keep | assets=1<br>colors=[yellow, black]<br>objects=[!]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[!, triangle]<br>dominant=1 |
| q0768 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrow, arrows, double-arrows, two-arrows, straight-right, double-headed-arrow]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, arrows, double-arrows, two-arrows, straight-right, double-headed-arrow, white-arrow]<br>dominant=1 |
| q0774 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[red-circle, bicycle, roadway]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[red-circle, bicycle, roadway, white-bicycle, white-dashed-lines, flowers, flower, white-arrow, city-road]<br>dominant=1 |
| q0775 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[arrow, straight]<br>dominant=1 | assets=1<br>colors=[gray, white]<br>objects=[arrow, straight, white-arrow, straight-arrow, up-arrow]<br>dominant=1 |
| q0779 | additive-only | low | keep | assets=1<br>colors=[gray, yellow]<br>objects=[x]<br>dominant=1 | assets=1<br>colors=[gray, yellow, white]<br>objects=[x, white-dashed-lines, yellow-dashed-line, city-road]<br>dominant=1 |
| q0783 | additive-only | low | keep | assets=1<br>colors=[yellow, white, red]<br>objects=[train, railroad, choochoo, railway, black-train, triangle, red-slash]<br>dominant=1 | assets=1<br>colors=[yellow, white, red, black]<br>objects=[train, railroad, choochoo, railway, black-train, triangle, red-slash, triple-slash, train-sign]<br>dominant=1 |
| q0794 | value-change | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[blue, white]<br>objects=[P, P, ^, ^P, ^p]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[P, P, ^, ^P, ^p]<br>dominant=1 |
| q0800 | additive-only | low | keep | assets=1<br>colors=[red, green]<br>objects=[chinese-text]<br>dominant=1 | assets=1<br>colors=[red, green, yellow, white]<br>objects=[chinese-text, card, white=card, hand, yellow-hand]<br>dominant=1 |
| q0804 | additive-only | low | keep | assets=1<br>colors=[gray, white, yellow]<br>objects=[intersection, crosswalk, square, yellow-square, roadway]<br>dominant=1 | assets=1<br>colors=[gray, white, yellow]<br>objects=[intersection, crosswalk, square, yellow-square, roadway, flowers, grid, yellow-grid]<br>dominant=1 |
| q0809 | additive-only | low | keep | assets=1<br>colors=[yellow, black]<br>objects=[zigzag]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[zigzag, squiggly]<br>dominant=1 |
| q0812 | additive-only | low | keep | assets=1<br>colors=[yellow, white, black]<br>objects=[train, railroad]<br>dominant=1 | assets=1<br>colors=[yellow, white, black, red]<br>objects=[train, railroad, double-slash, red-slash, train-sign, black-train]<br>dominant=1 |
| q0817 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrow]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, left-arrow, left-turn, white-arrow]<br>dominant=1 |
| q0818 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrow]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, white-arrow, up-arrow, straight-arrow]<br>dominant=1 |
| q0829 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[red-circle, roadway]<br>dominant=1 | assets=1<br>colors=[gray, white]<br>objects=[red-circle, roadway, flower, flowers, white-dashed-lines, white-solid-line, highway, arrow,, white-arrow, two-arrows]<br>dominant=1 |
| q0832 | value-change+additive | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[gray, white]<br>objects=[red-circle, crosswalk, roadway]<br>dominant=1 | assets=1<br>colors=[gray, white]<br>objects=[red-circle, crosswalk, roadway, city-road]<br>dominant=1 |
| q0833 | removal+structural+value-change | high | revert or needs human review | assets=1<br>colors=[blue, white, gray]<br>objects=[rang, crosswalk, chinese-text, rang]<br>dominant=1 | assets=1<br>colors=[white, gray]<br>objects=[rang, crosswalk, chinese-text, road-sign, yellow-solid-line, white-dashed-lines, white-triangle]<br>dominant=1 |
| q0834 | additive-only | low | keep | assets=1<br>colors=[gray]<br>objects=[red-circle, bicycle, roadway]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[red-circle, bicycle, roadway, yellow-solid-line, white-solid-line, white-bicycle, white-arrow, city-road]<br>dominant=1 |
| q0839 | additive-only | low | keep | assets=1<br>colors=[red, white, black]<br>objects=[arrow, arrows, black-arrow]<br>dominant=1 | assets=1<br>colors=[red, white, black]<br>objects=[arrow, arrows, black-arrow, straight-arrow, two-arrows]<br>dominant=1 |
| q0841 | additive-only | low | keep | assets=1<br>colors=[red, white, black]<br>objects=[3.5m, 3.5, height]<br>dominant=1 | assets=1<br>colors=[red, white, black]<br>objects=[3.5m, 3.5, height, circle]<br>dominant=1 |
| q0846 | value-change | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[blue, white]<br>objects=[chinese-text, T, highway-sign]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[chinese-text, T, highway-sign]<br>dominant=1 |
| q0850 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[pov, car, blue-car, building, tree, overpass,, bridge, pedestrian, pedestrians, no-yes-no]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[pov, car, blue-car, building, tree, overpass,, bridge, pedestrian, pedestrians, no-yes-no, red-green-red, city, city-road]<br>dominant=1 |
| q0852 | additive-only | low | keep | assets=1<br>colors=[yellow, black]<br>objects=[arrow, double-headed-arrow, <>, dashed-lines]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[arrow, double-headed-arrow, <>, dashed-lines, black-arrow, black-dashed-lines]<br>dominant=1 |
| q0854 | additive-only | low | keep | assets=1<br>colors=[red, white]<br>objects=[chinese-text]<br>dominant=1 | assets=1<br>colors=[red, white]<br>objects=[chinese-text, stop, listen]<br>dominant=1 |
| q0855 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[blue, white]<br>objects=[straight, arrow, sign]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[straight, arrow, straight-arrow, white-arrow, up-arrow]<br>dominant=1 |
| q0857 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[blue]<br>objects=[sign, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[gray]<br>objects=[bicycle, yellow-dashed-line, white-arrow, white-solid-line]<br>dominant=1 |
| q0859 | additive-only | low | keep | assets=1<br>colors=[gray, white]<br>objects=[red-circle, crosswalk, roadway, intersection]<br>dominant=1 | assets=1<br>colors=[gray, white]<br>objects=[red-circle, crosswalk, roadway, intersection, city-road, city]<br>dominant=1 |
| q0861 | additive-only | low | keep | assets=1<br>colors=[white, gray]<br>objects=[arrow, arrows, double-arrows, two-arrows]<br>dominant=1 | assets=1<br>colors=[white, gray]<br>objects=[arrow, arrows, double-arrows, two-arrows, white-arrow, double-headed-arrow, left-right]<br>dominant=1 |
| q0863 | value-change+additive | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[green, white]<br>objects=[bicycle]<br>dominant=1 | assets=1<br>colors=[gray, white]<br>objects=[bicycle, white-bicycle]<br>dominant=1 |
| q0869 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrows, double-arrows, two-arrows, dash, straight-right]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrows, double-arrows, two-arrows, dash, straight-right, highway-sign, white-arrow, two-headed-arrow, white-dashed-lines]<br>dominant=1 |
| q0870 | additive-only | low | keep | assets=1<br>colors=[blue, white]<br>objects=[arrow, arrows, double-arrows, two-arrows, dash]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[arrow, arrows, double-arrows, two-arrows, dash, straight-left, white-arrow, white-dashed-lines, highway-sign, double-headed-arrow]<br>dominant=1 |
| q0873 | structural+value-change+additive | high | revert or needs human review | assets=1<br>colors=[yellow, gray]<br>objects=[needs-tag-review]<br>dominant=1 | assets=1<br>colors=[yellow, gray, white]<br>objects=[double-yellow-solid-line, yellow-solid-line, white-arrow, arrows, white-dashed-lines, roadway, yellow-slash]<br>dominant=1 |
| q0874 | structural+value-change+additive | high | revert or needs human review | assets=1<br>colors=[blue, white]<br>objects=[chinese-text]<br>dominant=1 | assets=1<br>colors=[gray, white, yellow]<br>objects=[chinese-text, crosswalk, intersection, road-sign, yellow-solid-line, omega]<br>dominant=1 |
| q0875 | value-change | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[blue, white]<br>objects=[sign, needs-tag-review]<br>dominant=1 | assets=1<br>colors=[blue, white]<br>objects=[popo, umbrella]<br>dominant=1 |
| q0877 | additive-only | low | keep | assets=1<br>colors=[blue, red]<br>objects=[arrow, arrows]<br>dominant=1 | assets=1<br>colors=[blue, red, white]<br>objects=[arrow, arrows, red-arrow, white-arrow, up-arrow, down-arrow]<br>dominant=1 |
| q0883 | structural+value-change | high | revert or needs human review | assets=1<br>colors=[green, white, red]<br>objects=[chinese-text, g24, 48]<br>dominant=1 | assets=1<br>colors=[green, white, red]<br>objects=[chinese-text, g324, 48, white-arrow, arrow,, right-arrow, diagonal-arrow]<br>dominant=1 |
| q0893 | additive-only | low | keep | assets=1<br>colors=[blue, gray]<br>objects=[red-circle, roadway]<br>dominant=1 | assets=1<br>colors=[blue, gray]<br>objects=[red-circle, roadway, flower, flowers, white-arrow, white-dashed-lines, city-road]<br>dominant=1 |
| q0897 | additive-only | low | keep | assets=1<br>colors=[yellow, black]<br>objects=[train, railway, railroad]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[train, railway, railroad, train-tracks, choochoo, thomas]<br>dominant=1 |
| q0928 | additive-only | low | keep | assets=1<br>colors=[yellow, black]<br>objects=[arrow, downhill, slope]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[arrow, downhill, slope, yellow-arrow, triangle]<br>dominant=1 |
| q0932 | value-change | needs-human-review | requires explicit image-tag correction override | assets=1<br>colors=[yellow, black]<br>objects=[ㅏ, T]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[ㅏ, T]<br>dominant=1 |
| q0956 | additive-only | low | keep | assets=1<br>colors=[yellow, black]<br>objects=[train, choochoo, thomas]<br>dominant=1 | assets=1<br>colors=[yellow, black]<br>objects=[train, choochoo, thomas, black-train]<br>dominant=1 |

## Per-QID Operation Details

### q0226

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0226.objectTags[7] — array entry appended
  - additive: questions.q0226.objectTags[8] — array entry appended
  - additive: questions.q0226.objectTags[9] — array entry appended

### q0228

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0228.objectTags[7] — array entry appended
  - additive: questions.q0228.objectTags[8] — array entry appended

### q0259

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0259.objectTags[7] — array entry appended
  - additive: questions.q0259.objectTags[8] — array entry appended
  - additive: questions.q0259.objectTags[9] — array entry appended

### q0260

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0260.objectTags[4] — array entry appended
  - additive: questions.q0260.objectTags[5] — array entry appended
  - additive: questions.q0260.objectTags[6] — array entry appended
  - additive: questions.q0260.objectTags[7] — array entry appended
  - additive: questions.q0260.objectTags[8] — array entry appended
  - additive: questions.q0260.objectTags[9] — array entry appended

### q0272

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0272.objectTags[5] — array entry appended
  - additive: questions.q0272.objectTags[6] — array entry appended
  - additive: questions.q0272.objectTags[7] — array entry appended

### q0281

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0281.objectTags[7] — array entry appended
  - additive: questions.q0281.objectTags[8] — array entry appended
  - additive: questions.q0281.objectTags[9] — array entry appended
  - additive: questions.q0281.objectTags[10] — array entry appended
  - additive: questions.q0281.objectTags[11] — array entry appended

### q0289

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0289.objectTags[8] — array entry appended
  - additive: questions.q0289.objectTags[9] — array entry appended
  - additive: questions.q0289.objectTags[10] — array entry appended

### q0292

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0292.objectTags[6] — array entry appended
  - additive: questions.q0292.objectTags[7] — array entry appended
  - additive: questions.q0292.objectTags[8] — array entry appended
  - additive: questions.q0292.objectTags[9] — array entry appended
  - additive: questions.q0292.objectTags[10] — array entry appended
  - additive: questions.q0292.objectTags[11] — array entry appended

### q0361

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":8}
  - additive: questions.q0361.objectTags[3] — array entry appended
  - additive: questions.q0361.objectTags[4] — array entry appended
  - additive: questions.q0361.objectTags[5] — array entry appended
  - additive: questions.q0361.objectTags[6] — array entry appended
  - additive: questions.q0361.objectTags[7] — array entry appended
  - additive: questions.q0361.objectTags[8] — array entry appended
  - additive: questions.q0361.objectTags[9] — array entry appended
  - additive: questions.q0361.objectTags[10] — array entry appended

### q0367

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0367.objectTags[7] — array entry appended
  - additive: questions.q0367.objectTags[8] — array entry appended

### q0372

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0372.objectTags[4] — array entry appended
  - additive: questions.q0372.objectTags[5] — array entry appended
  - additive: questions.q0372.objectTags[6] — array entry appended
  - additive: questions.q0372.objectTags[7] — array entry appended

### q0378

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":9}
  - additive: questions.q0378.objectTags[5] — array entry appended
  - additive: questions.q0378.objectTags[6] — array entry appended
  - additive: questions.q0378.objectTags[7] — array entry appended
  - additive: questions.q0378.objectTags[8] — array entry appended
  - additive: questions.q0378.objectTags[9] — array entry appended
  - additive: questions.q0378.objectTags[10] — array entry appended
  - additive: questions.q0378.objectTags[11] — array entry appended
  - additive: questions.q0378.objectTags[12] — array entry appended
  - additive: questions.q0378.objectTags[13] — array entry appended

### q0380

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0380.objectTags[13] — array entry appended

### q0398

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":2,"structural":8}
  - value-change: questions.q0398.objectTags[1] — existing value changed
  - value-change: questions.q0398.objectTags[2] — existing value changed
  - structural: questions.q0398.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0398.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0398.objectTags[5] — array entry added after earlier array changes
  - structural: questions.q0398.objectTags[6] — array entry added after earlier array changes
  - structural: questions.q0398.objectTags[7] — array entry added after earlier array changes
  - structural: questions.q0398.objectTags[8] — array entry added after earlier array changes
  - structural: questions.q0398.objectTags[9] — array entry added after earlier array changes
  - structural: questions.q0398.objectTags[10] — array entry added after earlier array changes

### q0408

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":8}
  - additive: questions.q0408.objectTags[2] — array entry appended
  - additive: questions.q0408.objectTags[3] — array entry appended
  - additive: questions.q0408.objectTags[4] — array entry appended
  - additive: questions.q0408.objectTags[5] — array entry appended
  - additive: questions.q0408.objectTags[6] — array entry appended
  - additive: questions.q0408.objectTags[7] — array entry appended
  - additive: questions.q0408.objectTags[8] — array entry appended
  - additive: questions.q0408.objectTags[9] — array entry appended

### q0414

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0414.objectTags[6] — array entry appended
  - additive: questions.q0414.objectTags[7] — array entry appended
  - additive: questions.q0414.objectTags[8] — array entry appended

### q0418

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0418.colorTags[2] — array entry appended
  - additive: questions.q0418.objectTags[10] — array entry appended
  - additive: questions.q0418.objectTags[11] — array entry appended

### q0424

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0424.objectTags[11] — array entry appended

### q0425

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0425.objectTags[4] — array entry appended
  - additive: questions.q0425.objectTags[5] — array entry appended
  - additive: questions.q0425.objectTags[6] — array entry appended
  - additive: questions.q0425.objectTags[7] — array entry appended

### q0475

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0475.objectTags[6] — array entry appended

### q0485

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0485.objectTags[4] — array entry appended
  - additive: questions.q0485.objectTags[5] — array entry appended
  - additive: questions.q0485.objectTags[6] — array entry appended
  - additive: questions.q0485.objectTags[7] — array entry appended

### q0493

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":9}
  - additive: questions.q0493.objectTags[4] — array entry appended
  - additive: questions.q0493.objectTags[5] — array entry appended
  - additive: questions.q0493.objectTags[6] — array entry appended
  - additive: questions.q0493.objectTags[7] — array entry appended
  - additive: questions.q0493.objectTags[8] — array entry appended
  - additive: questions.q0493.objectTags[9] — array entry appended
  - additive: questions.q0493.objectTags[10] — array entry appended
  - additive: questions.q0493.objectTags[11] — array entry appended
  - additive: questions.q0493.objectTags[12] — array entry appended

### q0497

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0497.objectTags[4] — array entry appended
  - additive: questions.q0497.objectTags[5] — array entry appended
  - additive: questions.q0497.objectTags[6] — array entry appended
  - additive: questions.q0497.objectTags[7] — array entry appended

### q0525

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0525.objectTags[2] — array entry appended
  - additive: questions.q0525.objectTags[3] — array entry appended
  - additive: questions.q0525.objectTags[4] — array entry appended
  - additive: questions.q0525.objectTags[5] — array entry appended

### q0526

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":1,"structural":7}
  - value-change: questions.q0526.objectTags[0] — existing value changed
  - structural: questions.q0526.objectTags[1] — array entry added after earlier array changes
  - structural: questions.q0526.objectTags[2] — array entry added after earlier array changes
  - structural: questions.q0526.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0526.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0526.objectTags[5] — array entry added after earlier array changes
  - structural: questions.q0526.objectTags[6] — array entry added after earlier array changes
  - structural: questions.q0526.objectTags[7] — array entry added after earlier array changes

### q0547

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0547.objectTags[1] — array entry appended
  - additive: questions.q0547.objectTags[2] — array entry appended
  - additive: questions.q0547.objectTags[3] — array entry appended
  - additive: questions.q0547.objectTags[4] — array entry appended

### q0552

- Classification: removal+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"removal":1,"value-change":4}
  - removal: questions.q0552.objectTags — array length shrank from 8 to 4
  - value-change: questions.q0552.objectTags[0] — existing value changed
  - value-change: questions.q0552.objectTags[1] — existing value changed
  - value-change: questions.q0552.objectTags[2] — existing value changed
  - value-change: questions.q0552.objectTags[3] — existing value changed

### q0559

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0559.objectTags[1] — array entry appended
  - additive: questions.q0559.objectTags[2] — array entry appended
  - additive: questions.q0559.objectTags[3] — array entry appended
  - additive: questions.q0559.objectTags[4] — array entry appended
  - additive: questions.q0559.objectTags[5] — array entry appended
  - additive: questions.q0559.objectTags[6] — array entry appended

### q0567

- Classification: structural+value-change+additive
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":1,"structural":1,"additive":4}
  - value-change: questions.q0567.colorTags[1] — existing value changed
  - structural: questions.q0567.colorTags[2] — array entry added after earlier array changes
  - additive: questions.q0567.objectTags[1] — array entry appended
  - additive: questions.q0567.objectTags[2] — array entry appended
  - additive: questions.q0567.objectTags[3] — array entry appended
  - additive: questions.q0567.objectTags[4] — array entry appended

### q0568

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":4,"structural":4}
  - value-change: questions.q0568.assetSrcs[0] — existing value changed
  - value-change: questions.q0568.dominantByAsset[0].assetSrc — existing value changed
  - value-change: questions.q0568.objectTags[0] — existing value changed
  - value-change: questions.q0568.objectTags[1] — existing value changed
  - structural: questions.q0568.objectTags[2] — array entry added after earlier array changes
  - structural: questions.q0568.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0568.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0568.objectTags[5] — array entry added after earlier array changes

### q0570

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0570.objectTags[1] — array entry appended
  - additive: questions.q0570.objectTags[2] — array entry appended

### q0585

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0585.objectTags[5] — array entry appended

### q0587

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0587.objectTags[6] — array entry appended

### q0588

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0588.objectTags[8] — array entry appended

### q0590

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0590.objectTags[4] — array entry appended

### q0595

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":2,"structural":2}
  - value-change: questions.q0595.objectTags[0] — existing value changed
  - value-change: questions.q0595.objectTags[1] — existing value changed
  - structural: questions.q0595.objectTags[2] — array entry added after earlier array changes
  - structural: questions.q0595.objectTags[3] — array entry added after earlier array changes

### q0600

- Classification: structural+value-change+additive
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"additive":3,"value-change":4,"structural":4}
  - additive: questions.q0600.colorTags[1] — array entry appended
  - additive: questions.q0600.colorTags[2] — array entry appended
  - additive: questions.q0600.colorTags[3] — array entry appended
  - value-change: questions.q0600.objectTags[0] — existing value changed
  - value-change: questions.q0600.objectTags[1] — existing value changed
  - value-change: questions.q0600.objectTags[2] — existing value changed
  - value-change: questions.q0600.objectTags[3] — existing value changed
  - structural: questions.q0600.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0600.objectTags[5] — array entry added after earlier array changes
  - structural: questions.q0600.objectTags[6] — array entry added after earlier array changes
  - structural: questions.q0600.objectTags[7] — array entry added after earlier array changes

### q0605

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0605.objectTags[1] — array entry appended
  - additive: questions.q0605.objectTags[2] — array entry appended
  - additive: questions.q0605.objectTags[3] — array entry appended
  - additive: questions.q0605.objectTags[4] — array entry appended

### q0606

- Classification: removal+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"removal":1,"value-change":4}
  - removal: questions.q0606.objectTags — array length shrank from 8 to 4
  - value-change: questions.q0606.objectTags[0] — existing value changed
  - value-change: questions.q0606.objectTags[1] — existing value changed
  - value-change: questions.q0606.objectTags[2] — existing value changed
  - value-change: questions.q0606.objectTags[3] — existing value changed

### q0610

- Classification: structural+value-change+additive
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"additive":2,"value-change":4,"structural":1}
  - additive: questions.q0610.colorTags[2] — array entry appended
  - additive: questions.q0610.colorTags[3] — array entry appended
  - value-change: questions.q0610.objectTags[0] — existing value changed
  - value-change: questions.q0610.objectTags[1] — existing value changed
  - value-change: questions.q0610.objectTags[2] — existing value changed
  - value-change: questions.q0610.objectTags[3] — existing value changed
  - structural: questions.q0610.objectTags[4] — array entry added after earlier array changes

### q0611

- Classification: value-change
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":1}
  - value-change: questions.q0611.objectTags[3] — existing value changed

### q0628

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":1,"structural":4}
  - value-change: questions.q0628.objectTags[0] — existing value changed
  - structural: questions.q0628.objectTags[1] — array entry added after earlier array changes
  - structural: questions.q0628.objectTags[2] — array entry added after earlier array changes
  - structural: questions.q0628.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0628.objectTags[4] — array entry added after earlier array changes

### q0630

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0630.objectTags[2] — array entry appended
  - additive: questions.q0630.objectTags[3] — array entry appended
  - additive: questions.q0630.objectTags[4] — array entry appended
  - additive: questions.q0630.objectTags[5] — array entry appended

### q0637

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0637.objectTags[6] — array entry appended
  - additive: questions.q0637.objectTags[7] — array entry appended
  - additive: questions.q0637.objectTags[8] — array entry appended
  - additive: questions.q0637.objectTags[9] — array entry appended

### q0638

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0638.objectTags[12] — array entry appended
  - additive: questions.q0638.objectTags[13] — array entry appended
  - additive: questions.q0638.objectTags[14] — array entry appended
  - additive: questions.q0638.objectTags[15] — array entry appended
  - additive: questions.q0638.objectTags[16] — array entry appended

### q0644

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":12}
  - additive: questions.q0644.objectTags[5] — array entry appended
  - additive: questions.q0644.objectTags[6] — array entry appended
  - additive: questions.q0644.objectTags[7] — array entry appended
  - additive: questions.q0644.objectTags[8] — array entry appended
  - additive: questions.q0644.objectTags[9] — array entry appended
  - additive: questions.q0644.objectTags[10] — array entry appended
  - additive: questions.q0644.objectTags[11] — array entry appended
  - additive: questions.q0644.objectTags[12] — array entry appended
  - additive: questions.q0644.objectTags[13] — array entry appended
  - additive: questions.q0644.objectTags[14] — array entry appended
  - additive: questions.q0644.objectTags[15] — array entry appended
  - additive: questions.q0644.objectTags[16] — array entry appended

### q0646

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":12}
  - additive: questions.q0646.objectTags[6] — array entry appended
  - additive: questions.q0646.objectTags[7] — array entry appended
  - additive: questions.q0646.objectTags[8] — array entry appended
  - additive: questions.q0646.objectTags[9] — array entry appended
  - additive: questions.q0646.objectTags[10] — array entry appended
  - additive: questions.q0646.objectTags[11] — array entry appended
  - additive: questions.q0646.objectTags[12] — array entry appended
  - additive: questions.q0646.objectTags[13] — array entry appended
  - additive: questions.q0646.objectTags[14] — array entry appended
  - additive: questions.q0646.objectTags[15] — array entry appended
  - additive: questions.q0646.objectTags[16] — array entry appended
  - additive: questions.q0646.objectTags[17] — array entry appended

### q0649

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0649.objectTags[8] — array entry appended
  - additive: questions.q0649.objectTags[9] — array entry appended
  - additive: questions.q0649.objectTags[10] — array entry appended
  - additive: questions.q0649.objectTags[11] — array entry appended
  - additive: questions.q0649.objectTags[12] — array entry appended
  - additive: questions.q0649.objectTags[13] — array entry appended

### q0650

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0650.objectTags[7] — array entry appended
  - additive: questions.q0650.objectTags[8] — array entry appended

### q0651

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0651.objectTags[4] — array entry appended
  - additive: questions.q0651.objectTags[5] — array entry appended
  - additive: questions.q0651.objectTags[6] — array entry appended

### q0659

- Classification: value-change+additive
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":7,"additive":6}
  - value-change: questions.q0659.dominantByAsset[0].colors[0].chromaticShare — existing value changed
  - value-change: questions.q0659.dominantByAsset[0].colors[0].overallShare — existing value changed
  - value-change: questions.q0659.dominantByAsset[0].colors[1].overallShare — existing value changed
  - value-change: questions.q0659.dominantByAsset[0].colors[2].color — existing value changed
  - value-change: questions.q0659.dominantByAsset[0].colors[2].overallShare — existing value changed
  - value-change: questions.q0659.dominantByAsset[0].colors[3].chromaticShare — existing value changed
  - value-change: questions.q0659.dominantByAsset[0].colors[3].overallShare — existing value changed
  - additive: questions.q0659.objectTags[1] — array entry appended
  - additive: questions.q0659.objectTags[2] — array entry appended
  - additive: questions.q0659.objectTags[3] — array entry appended
  - additive: questions.q0659.objectTags[4] — array entry appended
  - additive: questions.q0659.objectTags[5] — array entry appended
  - additive: questions.q0659.objectTags[6] — array entry appended

### q0663

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0663.objectTags[8] — array entry appended

### q0664

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":4,"structural":3}
  - value-change: questions.q0664.colorTags[1] — existing value changed
  - value-change: questions.q0664.objectTags[0] — existing value changed
  - value-change: questions.q0664.objectTags[1] — existing value changed
  - value-change: questions.q0664.objectTags[2] — existing value changed
  - structural: questions.q0664.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0664.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0664.objectTags[5] — array entry added after earlier array changes

### q0665

- Classification: removal+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"removal":1,"value-change":3}
  - removal: questions.q0665.objectTags — array length shrank from 5 to 3
  - value-change: questions.q0665.objectTags[0] — existing value changed
  - value-change: questions.q0665.objectTags[1] — existing value changed
  - value-change: questions.q0665.objectTags[2] — existing value changed

### q0667

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0667.objectTags[2] — array entry appended
  - additive: questions.q0667.objectTags[3] — array entry appended
  - additive: questions.q0667.objectTags[4] — array entry appended

### q0668

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":3,"structural":3}
  - value-change: questions.q0668.colorTags[1] — existing value changed
  - value-change: questions.q0668.objectTags[0] — existing value changed
  - value-change: questions.q0668.objectTags[1] — existing value changed
  - structural: questions.q0668.objectTags[2] — array entry added after earlier array changes
  - structural: questions.q0668.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0668.objectTags[4] — array entry added after earlier array changes

### q0670

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0670.objectTags[4] — array entry appended
  - additive: questions.q0670.objectTags[5] — array entry appended
  - additive: questions.q0670.objectTags[6] — array entry appended

### q0671

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0671.objectTags[6] — array entry appended
  - additive: questions.q0671.objectTags[7] — array entry appended

### q0674

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":5,"structural":2}
  - value-change: questions.q0674.colorTags[0] — existing value changed
  - value-change: questions.q0674.objectTags[0] — existing value changed
  - value-change: questions.q0674.objectTags[1] — existing value changed
  - value-change: questions.q0674.objectTags[2] — existing value changed
  - value-change: questions.q0674.objectTags[3] — existing value changed
  - structural: questions.q0674.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0674.objectTags[5] — array entry added after earlier array changes

### q0677

- Classification: value-change
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":2}
  - value-change: questions.q0677.objectTags[0] — existing value changed
  - value-change: questions.q0677.objectTags[1] — existing value changed

### q0678

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0678.objectTags[7] — array entry appended
  - additive: questions.q0678.objectTags[8] — array entry appended
  - additive: questions.q0678.objectTags[9] — array entry appended
  - additive: questions.q0678.objectTags[10] — array entry appended
  - additive: questions.q0678.objectTags[11] — array entry appended
  - additive: questions.q0678.objectTags[12] — array entry appended

### q0682

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0682.colorTags[2] — array entry appended
  - additive: questions.q0682.colorTags[3] — array entry appended
  - additive: questions.q0682.objectTags[2] — array entry appended
  - additive: questions.q0682.objectTags[3] — array entry appended
  - additive: questions.q0682.objectTags[4] — array entry appended
  - additive: questions.q0682.objectTags[5] — array entry appended

### q0684

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":2,"structural":2}
  - value-change: questions.q0684.objectTags[0] — existing value changed
  - value-change: questions.q0684.objectTags[1] — existing value changed
  - structural: questions.q0684.objectTags[2] — array entry added after earlier array changes
  - structural: questions.q0684.objectTags[3] — array entry added after earlier array changes

### q0687

- Classification: value-change+additive
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":5,"additive":5}
  - value-change: questions.q0687.dominantByAsset[0].colors[0].overallShare — existing value changed
  - value-change: questions.q0687.dominantByAsset[0].colors[1].color — existing value changed
  - value-change: questions.q0687.dominantByAsset[0].colors[1].overallShare — existing value changed
  - value-change: questions.q0687.dominantByAsset[0].colors[2].color — existing value changed
  - value-change: questions.q0687.dominantByAsset[0].colors[2].overallShare — existing value changed
  - additive: questions.q0687.objectTags[1] — array entry appended
  - additive: questions.q0687.objectTags[2] — array entry appended
  - additive: questions.q0687.objectTags[3] — array entry appended
  - additive: questions.q0687.objectTags[4] — array entry appended
  - additive: questions.q0687.objectTags[5] — array entry appended

### q0702

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0702.colorTags[2] — array entry appended
  - additive: questions.q0702.colorTags[3] — array entry appended
  - additive: questions.q0702.objectTags[2] — array entry appended
  - additive: questions.q0702.objectTags[3] — array entry appended
  - additive: questions.q0702.objectTags[4] — array entry appended
  - additive: questions.q0702.objectTags[5] — array entry appended

### q0705

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0705.objectTags[4] — array entry appended
  - additive: questions.q0705.objectTags[5] — array entry appended

### q0713

- Classification: value-change
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":2}
  - value-change: questions.q0713.assetSrcs[0] — existing value changed
  - value-change: questions.q0713.dominantByAsset[0].assetSrc — existing value changed

### q0714

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0714.objectTags[2] — array entry appended

### q0716

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0716.objectTags[4] — array entry appended
  - additive: questions.q0716.objectTags[5] — array entry appended
  - additive: questions.q0716.objectTags[6] — array entry appended

### q0717

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0717.objectTags[6] — array entry appended
  - additive: questions.q0717.objectTags[7] — array entry appended

### q0719

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0719.objectTags[2] — array entry appended

### q0720

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0720.objectTags[1] — array entry appended
  - additive: questions.q0720.objectTags[2] — array entry appended
  - additive: questions.q0720.objectTags[3] — array entry appended
  - additive: questions.q0720.objectTags[4] — array entry appended
  - additive: questions.q0720.objectTags[5] — array entry appended

### q0722

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":10}
  - additive: questions.q0722.colorTags[2] — array entry appended
  - additive: questions.q0722.colorTags[3] — array entry appended
  - additive: questions.q0722.colorTags[4] — array entry appended
  - additive: questions.q0722.objectTags[2] — array entry appended
  - additive: questions.q0722.objectTags[3] — array entry appended
  - additive: questions.q0722.objectTags[4] — array entry appended
  - additive: questions.q0722.objectTags[5] — array entry appended
  - additive: questions.q0722.objectTags[6] — array entry appended
  - additive: questions.q0722.objectTags[7] — array entry appended
  - additive: questions.q0722.objectTags[8] — array entry appended

### q0724

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":4,"structural":4}
  - value-change: questions.q0724.colorTags[0] — existing value changed
  - structural: questions.q0724.colorTags[1] — array entry added after earlier array changes
  - structural: questions.q0724.colorTags[2] — array entry added after earlier array changes
  - value-change: questions.q0724.objectTags[0] — existing value changed
  - value-change: questions.q0724.objectTags[1] — existing value changed
  - value-change: questions.q0724.objectTags[2] — existing value changed
  - structural: questions.q0724.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0724.objectTags[4] — array entry added after earlier array changes

### q0726

- Classification: structural+value-change+additive
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"additive":1,"value-change":1,"structural":2}
  - additive: questions.q0726.colorTags[1] — array entry appended
  - value-change: questions.q0726.objectTags[0] — existing value changed
  - structural: questions.q0726.objectTags[1] — array entry added after earlier array changes
  - structural: questions.q0726.objectTags[2] — array entry added after earlier array changes

### q0727

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":3,"structural":1}
  - value-change: questions.q0727.colorTags[1] — existing value changed
  - structural: questions.q0727.colorTags[2] — array entry added after earlier array changes
  - value-change: questions.q0727.objectTags[0] — existing value changed
  - value-change: questions.q0727.objectTags[1] — existing value changed

### q0729

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":8}
  - additive: questions.q0729.objectTags[5] — array entry appended
  - additive: questions.q0729.objectTags[6] — array entry appended
  - additive: questions.q0729.objectTags[7] — array entry appended
  - additive: questions.q0729.objectTags[8] — array entry appended
  - additive: questions.q0729.objectTags[9] — array entry appended
  - additive: questions.q0729.objectTags[10] — array entry appended
  - additive: questions.q0729.objectTags[11] — array entry appended
  - additive: questions.q0729.objectTags[12] — array entry appended

### q0732

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0732.objectTags[3] — array entry appended
  - additive: questions.q0732.objectTags[4] — array entry appended

### q0733

- Classification: value-change+additive
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":6,"additive":2}
  - value-change: questions.q0733.dominantByAsset[0].colors[0].chromaticShare — existing value changed
  - value-change: questions.q0733.dominantByAsset[0].colors[0].overallShare — existing value changed
  - value-change: questions.q0733.dominantByAsset[0].colors[1].overallShare — existing value changed
  - value-change: questions.q0733.dominantByAsset[0].colors[2].overallShare — existing value changed
  - value-change: questions.q0733.dominantByAsset[0].colors[3].chromaticShare — existing value changed
  - value-change: questions.q0733.dominantByAsset[0].colors[3].overallShare — existing value changed
  - additive: questions.q0733.objectTags[2] — array entry appended
  - additive: questions.q0733.objectTags[3] — array entry appended

### q0737

- Classification: value-change+additive
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":2,"additive":5}
  - value-change: questions.q0737.assetSrcs[0] — existing value changed
  - value-change: questions.q0737.dominantByAsset[0].assetSrc — existing value changed
  - additive: questions.q0737.objectTags[5] — array entry appended
  - additive: questions.q0737.objectTags[6] — array entry appended
  - additive: questions.q0737.objectTags[7] — array entry appended
  - additive: questions.q0737.objectTags[8] — array entry appended
  - additive: questions.q0737.objectTags[9] — array entry appended

### q0739

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0739.colorTags[2] — array entry appended
  - additive: questions.q0739.objectTags[3] — array entry appended
  - additive: questions.q0739.objectTags[4] — array entry appended
  - additive: questions.q0739.objectTags[5] — array entry appended
  - additive: questions.q0739.objectTags[6] — array entry appended

### q0742

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0742.objectTags[6] — array entry appended
  - additive: questions.q0742.objectTags[7] — array entry appended

### q0745

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":10}
  - additive: questions.q0745.objectTags[5] — array entry appended
  - additive: questions.q0745.objectTags[6] — array entry appended
  - additive: questions.q0745.objectTags[7] — array entry appended
  - additive: questions.q0745.objectTags[8] — array entry appended
  - additive: questions.q0745.objectTags[9] — array entry appended
  - additive: questions.q0745.objectTags[10] — array entry appended
  - additive: questions.q0745.objectTags[11] — array entry appended
  - additive: questions.q0745.objectTags[12] — array entry appended
  - additive: questions.q0745.objectTags[13] — array entry appended
  - additive: questions.q0745.objectTags[14] — array entry appended

### q0753

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0753.objectTags[3] — array entry appended
  - additive: questions.q0753.objectTags[4] — array entry appended
  - additive: questions.q0753.objectTags[5] — array entry appended

### q0754

- Classification: value-change+additive
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":2,"additive":2}
  - value-change: questions.q0754.assetSrcs[0] — existing value changed
  - value-change: questions.q0754.dominantByAsset[0].assetSrc — existing value changed
  - additive: questions.q0754.objectTags[5] — array entry appended
  - additive: questions.q0754.objectTags[6] — array entry appended

### q0755

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0755.objectTags[4] — array entry appended

### q0760

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0760.colorTags[2] — array entry appended

### q0761

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0761.colorTags[2] — array entry appended
  - additive: questions.q0761.objectTags[1] — array entry appended
  - additive: questions.q0761.objectTags[2] — array entry appended
  - additive: questions.q0761.objectTags[3] — array entry appended

### q0762

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0762.colorTags[2] — array entry appended
  - additive: questions.q0762.colorTags[3] — array entry appended
  - additive: questions.q0762.objectTags[3] — array entry appended
  - additive: questions.q0762.objectTags[4] — array entry appended
  - additive: questions.q0762.objectTags[5] — array entry appended
  - additive: questions.q0762.objectTags[6] — array entry appended

### q0766

- Classification: value-change
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":4}
  - value-change: questions.q0766.colorTags[1] — existing value changed
  - value-change: questions.q0766.objectTags[0] — existing value changed
  - value-change: questions.q0766.objectTags[1] — existing value changed
  - value-change: questions.q0766.objectTags[2] — existing value changed

### q0767

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0767.objectTags[1] — array entry appended

### q0768

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0768.objectTags[6] — array entry appended

### q0774

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0774.objectTags[3] — array entry appended
  - additive: questions.q0774.objectTags[4] — array entry appended
  - additive: questions.q0774.objectTags[5] — array entry appended
  - additive: questions.q0774.objectTags[6] — array entry appended
  - additive: questions.q0774.objectTags[7] — array entry appended
  - additive: questions.q0774.objectTags[8] — array entry appended

### q0775

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0775.colorTags[1] — array entry appended
  - additive: questions.q0775.objectTags[2] — array entry appended
  - additive: questions.q0775.objectTags[3] — array entry appended
  - additive: questions.q0775.objectTags[4] — array entry appended

### q0779

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0779.colorTags[2] — array entry appended
  - additive: questions.q0779.objectTags[1] — array entry appended
  - additive: questions.q0779.objectTags[2] — array entry appended
  - additive: questions.q0779.objectTags[3] — array entry appended

### q0783

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0783.colorTags[3] — array entry appended
  - additive: questions.q0783.objectTags[7] — array entry appended
  - additive: questions.q0783.objectTags[8] — array entry appended

### q0794

- Classification: value-change
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":5}
  - value-change: questions.q0794.assetSrcs[0] — existing value changed
  - value-change: questions.q0794.dominantByAsset[0].assetSrc — existing value changed
  - value-change: questions.q0794.dominantByAsset[0].colors[0].overallShare — existing value changed
  - value-change: questions.q0794.dominantByAsset[0].colors[1].overallShare — existing value changed
  - value-change: questions.q0794.dominantByAsset[0].colors[2].overallShare — existing value changed

### q0800

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":6}
  - additive: questions.q0800.colorTags[2] — array entry appended
  - additive: questions.q0800.colorTags[3] — array entry appended
  - additive: questions.q0800.objectTags[1] — array entry appended
  - additive: questions.q0800.objectTags[2] — array entry appended
  - additive: questions.q0800.objectTags[3] — array entry appended
  - additive: questions.q0800.objectTags[4] — array entry appended

### q0804

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0804.objectTags[5] — array entry appended
  - additive: questions.q0804.objectTags[6] — array entry appended
  - additive: questions.q0804.objectTags[7] — array entry appended

### q0809

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0809.objectTags[1] — array entry appended

### q0812

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0812.colorTags[3] — array entry appended
  - additive: questions.q0812.objectTags[2] — array entry appended
  - additive: questions.q0812.objectTags[3] — array entry appended
  - additive: questions.q0812.objectTags[4] — array entry appended
  - additive: questions.q0812.objectTags[5] — array entry appended

### q0817

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0817.objectTags[1] — array entry appended
  - additive: questions.q0817.objectTags[2] — array entry appended
  - additive: questions.q0817.objectTags[3] — array entry appended

### q0818

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0818.objectTags[1] — array entry appended
  - additive: questions.q0818.objectTags[2] — array entry appended
  - additive: questions.q0818.objectTags[3] — array entry appended

### q0829

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":9}
  - additive: questions.q0829.colorTags[1] — array entry appended
  - additive: questions.q0829.objectTags[2] — array entry appended
  - additive: questions.q0829.objectTags[3] — array entry appended
  - additive: questions.q0829.objectTags[4] — array entry appended
  - additive: questions.q0829.objectTags[5] — array entry appended
  - additive: questions.q0829.objectTags[6] — array entry appended
  - additive: questions.q0829.objectTags[7] — array entry appended
  - additive: questions.q0829.objectTags[8] — array entry appended
  - additive: questions.q0829.objectTags[9] — array entry appended

### q0832

- Classification: value-change+additive
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":2,"additive":1}
  - value-change: questions.q0832.assetSrcs[0] — existing value changed
  - value-change: questions.q0832.dominantByAsset[0].assetSrc — existing value changed
  - additive: questions.q0832.objectTags[3] — array entry appended

### q0833

- Classification: removal+structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"removal":1,"value-change":3,"structural":3}
  - removal: questions.q0833.colorTags — array length shrank from 3 to 2
  - value-change: questions.q0833.colorTags[0] — existing value changed
  - value-change: questions.q0833.colorTags[1] — existing value changed
  - value-change: questions.q0833.objectTags[3] — existing value changed
  - structural: questions.q0833.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0833.objectTags[5] — array entry added after earlier array changes
  - structural: questions.q0833.objectTags[6] — array entry added after earlier array changes

### q0834

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0834.objectTags[3] — array entry appended
  - additive: questions.q0834.objectTags[4] — array entry appended
  - additive: questions.q0834.objectTags[5] — array entry appended
  - additive: questions.q0834.objectTags[6] — array entry appended
  - additive: questions.q0834.objectTags[7] — array entry appended

### q0839

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0839.objectTags[3] — array entry appended
  - additive: questions.q0839.objectTags[4] — array entry appended

### q0841

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0841.objectTags[3] — array entry appended

### q0846

- Classification: value-change
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":4}
  - value-change: questions.q0846.assetSrcs[0] — existing value changed
  - value-change: questions.q0846.dominantByAsset[0].assetSrc — existing value changed
  - value-change: questions.q0846.pinyinText[1] — existing value changed
  - value-change: questions.q0846.pinyinText[2] — existing value changed

### q0850

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0850.objectTags[10] — array entry appended
  - additive: questions.q0850.objectTags[11] — array entry appended
  - additive: questions.q0850.objectTags[12] — array entry appended

### q0852

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0852.objectTags[4] — array entry appended
  - additive: questions.q0852.objectTags[5] — array entry appended

### q0854

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0854.objectTags[1] — array entry appended
  - additive: questions.q0854.objectTags[2] — array entry appended

### q0855

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":1,"structural":2}
  - value-change: questions.q0855.objectTags[2] — existing value changed
  - structural: questions.q0855.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0855.objectTags[4] — array entry added after earlier array changes

### q0857

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":3,"structural":2}
  - value-change: questions.q0857.colorTags[0] — existing value changed
  - value-change: questions.q0857.objectTags[0] — existing value changed
  - value-change: questions.q0857.objectTags[1] — existing value changed
  - structural: questions.q0857.objectTags[2] — array entry added after earlier array changes
  - structural: questions.q0857.objectTags[3] — array entry added after earlier array changes

### q0859

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0859.objectTags[4] — array entry appended
  - additive: questions.q0859.objectTags[5] — array entry appended

### q0861

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0861.objectTags[4] — array entry appended
  - additive: questions.q0861.objectTags[5] — array entry appended
  - additive: questions.q0861.objectTags[6] — array entry appended

### q0863

- Classification: value-change+additive
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":1,"additive":1}
  - value-change: questions.q0863.colorTags[0] — existing value changed
  - additive: questions.q0863.objectTags[1] — array entry appended

### q0869

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":4}
  - additive: questions.q0869.objectTags[5] — array entry appended
  - additive: questions.q0869.objectTags[6] — array entry appended
  - additive: questions.q0869.objectTags[7] — array entry appended
  - additive: questions.q0869.objectTags[8] — array entry appended

### q0870

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0870.objectTags[5] — array entry appended
  - additive: questions.q0870.objectTags[6] — array entry appended
  - additive: questions.q0870.objectTags[7] — array entry appended
  - additive: questions.q0870.objectTags[8] — array entry appended
  - additive: questions.q0870.objectTags[9] — array entry appended

### q0873

- Classification: structural+value-change+additive
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"additive":1,"value-change":1,"structural":6}
  - additive: questions.q0873.colorTags[2] — array entry appended
  - value-change: questions.q0873.objectTags[0] — existing value changed
  - structural: questions.q0873.objectTags[1] — array entry added after earlier array changes
  - structural: questions.q0873.objectTags[2] — array entry added after earlier array changes
  - structural: questions.q0873.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0873.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0873.objectTags[5] — array entry added after earlier array changes
  - structural: questions.q0873.objectTags[6] — array entry added after earlier array changes

### q0874

- Classification: structural+value-change+additive
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":1,"structural":1,"additive":5}
  - value-change: questions.q0874.colorTags[0] — existing value changed
  - structural: questions.q0874.colorTags[2] — array entry added after earlier array changes
  - additive: questions.q0874.objectTags[1] — array entry appended
  - additive: questions.q0874.objectTags[2] — array entry appended
  - additive: questions.q0874.objectTags[3] — array entry appended
  - additive: questions.q0874.objectTags[4] — array entry appended
  - additive: questions.q0874.objectTags[5] — array entry appended

### q0875

- Classification: value-change
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":2}
  - value-change: questions.q0875.objectTags[0] — existing value changed
  - value-change: questions.q0875.objectTags[1] — existing value changed

### q0877

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0877.colorTags[2] — array entry appended
  - additive: questions.q0877.objectTags[2] — array entry appended
  - additive: questions.q0877.objectTags[3] — array entry appended
  - additive: questions.q0877.objectTags[4] — array entry appended
  - additive: questions.q0877.objectTags[5] — array entry appended

### q0883

- Classification: structural+value-change
- Risk: high
- Recommended action: revert or needs human review
- Operation counts: {"value-change":4,"structural":4}
  - value-change: questions.q0883.objectTags[1] — existing value changed
  - structural: questions.q0883.objectTags[3] — array entry added after earlier array changes
  - structural: questions.q0883.objectTags[4] — array entry added after earlier array changes
  - structural: questions.q0883.objectTags[5] — array entry added after earlier array changes
  - structural: questions.q0883.objectTags[6] — array entry added after earlier array changes
  - value-change: questions.q0883.pinyinText[0] — existing value changed
  - value-change: questions.q0883.pinyinText[1] — existing value changed
  - value-change: questions.q0883.pinyinText[2] — existing value changed

### q0893

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":5}
  - additive: questions.q0893.objectTags[2] — array entry appended
  - additive: questions.q0893.objectTags[3] — array entry appended
  - additive: questions.q0893.objectTags[4] — array entry appended
  - additive: questions.q0893.objectTags[5] — array entry appended
  - additive: questions.q0893.objectTags[6] — array entry appended

### q0897

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":3}
  - additive: questions.q0897.objectTags[3] — array entry appended
  - additive: questions.q0897.objectTags[4] — array entry appended
  - additive: questions.q0897.objectTags[5] — array entry appended

### q0928

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":2}
  - additive: questions.q0928.objectTags[3] — array entry appended
  - additive: questions.q0928.objectTags[4] — array entry appended

### q0932

- Classification: value-change
- Risk: needs-human-review
- Recommended action: requires explicit image-tag correction override
- Operation counts: {"value-change":1}
  - value-change: questions.q0932.dominantByAsset[0].assetSrc — existing value changed

### q0956

- Classification: additive-only
- Risk: low
- Recommended action: keep
- Operation counts: {"additive":1}
  - additive: questions.q0956.objectTags[3] — array entry appended

