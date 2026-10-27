# The Pilz-Index model

The score is a small **water-balance + phenology model**, not a lookup table.
It lives in [`src/model/`](src/model/), is pure TypeScript without
dependencies, and is the same code in the browser, in the tests and in the
scenario report.

| File                                                                             | Step                                                                  |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`params.ts`](src/model/params.ts)                                               | every tunable constant, with its documentation                        |
| [`water-balance.ts`](src/model/water-balance.ts)                                 | 1–2: snow, infiltration, soil store                                   |
| [`factors.ts`](src/model/factors.ts)                                             | 3: moisture, sustained wetness, flush trigger, temperature            |
| [`modifiers.ts`](src/model/modifiers.ts)                                         | 4: frost, heat, heavy rain, waterlogging, diurnal trigger             |
| [`curves.ts`](src/model/curves.ts)                                               | the response curves: ramps, infiltration, temperature, season         |
| [`score.ts`](src/model/score.ts)                                                 | puts the steps together: `computeScores(days, { params, elevation })` |
| [`notes.ts`](src/model/notes.ts), [`ratings.ts`](src/model/ratings.ts)           | explanations and rating bands                                         |
| [`scenarios.ts`](src/model/scenarios.ts), [`evaluate.ts`](src/model/evaluate.ts) | reference scenarios with expected ratings                             |

## Why it looks like this

Four findings from the literature drive the shape:

1. **Fruiting follows stored soil moisture, not yesterday's rain.** Long-run
   yield models for _Boletus edulis_ and _Lactarius_ spp. find precipitation to
   be the strongest predictor, but with a delayed effect of roughly a month, and
   remote-sensed soil moisture predicts yields about as well as rainfall does.
2. **The ground can only take so much water.** A cloudburst largely runs off or
   drains past the rooting zone; the same total spread over a fortnight is worth
   far more. Soil-moisture indices in hydrology (the _antecedent precipitation
   index_) model this as weighted, decaying, capped accumulation.
3. **A flush takes days.** Field guidance converges on **3–10 days** between a
   soaking rain and a harvestable flush (some warmth-loving boletes 12–15 days;
   the first chanterelle flush after a summer drought 2–3 weeks).
4. **Temperature gates everything.** Fruit-body formation runs roughly
   **10–25 °C**, best around **15–23 °C by day** (≈ 12–18 °C daily mean); it
   slows below ~5 °C and above ~25 °C, and hard frost ends the season for most
   edible species.

## How a day is scored

Parameter names are given in `code`; their defaults are in the reference below.

**Step 1: infiltration.** Daily rainfall passes through a saturating curve,
`eff = S · tanh(P / S)` with `S = infiltrationSaturation` (19 mm). 8 mm gives
7.6 mm of usable water; 40 mm gives 18.4 mm. This is where "three downpours ≠
fifteen showers" comes from. Precipitation on days whose maximum stays below
`snowMaxTemp` is banked as snow and released by degree-day melt
(`meltPerDegreeDay`), so a snowy fortnight does not count as a wet one until
the thaw.

**Step 2: the soil store.** Infiltrated water accumulates in a store that keeps
`retentionBase − retentionPerDegree · (T̄ − retentionReferenceTemp)` of itself
per day, clamped to `retentionRange` (80–96 %), so it dries faster in the heat.
It is capped at `fieldCapacity` (85 mm); beyond that, water drains away.

**Step 3: three water factors**, combined as a weighted geometric mean so that
none of them can stand in for another (Liebig's law of the minimum):

| Factor            | Weight                | What it asks                                                                            |
| ----------------- | --------------------- | --------------------------------------------------------------------------------------- |
| Soil moisture     | `weightMoisture` 0.28 | Is the ground wet _today_? (`moistureRamp` 8 → 40 mm)                                   |
| Sustained wetness | `weightSustain` 0.30  | Has it stayed damp over the last `sustainWindow` (21) days? Never below `sustainFloor`. |
| Trigger rain      | `weightFlush` 0.42    | Was there a soaking rain 3–10 days ago?                                                 |

The trigger term convolves effective rainfall with the `flushKernel` over the
previous 16 days: weight ~0 on the day itself, 0.15 at 2 days, 0.75 at 4,
**1.0 at 6–7**, 0.55 at 11, 0.05 at 16. That is what makes yesterday's downpour
barely move today's score while the same rain six days back nearly doubles it.

**Step 4: gates and modifiers.**

- **Temperature gate** (`temperatureGateFloor + (1 − floor) · suitability`):
  full marks for a daily mean of 12–18 °C, tapering to nothing below 2 °C and
  above 27 °C (`tempColdRamp`, `tempWarmRamp`). It blends today's temperature
  (`tempTodayWeight`, 55 %) with the previous `tempHistoryDays` (10), because
  the mycelium responds to the weather of the last week or so, not to one afternoon.
- **Frost**: below 0 °C at night ×0.75, below −2 ×0.4, below −5 ×0.15, plus
  ×0.5 for 5 days after a hard frost.
- **Heat**: ×0.85 from 28 °C, ×0.7 from 32 °C.
- **Waterlogging**: the share of the last 10 days spent near field capacity
  costs up to ×0.55; sodden ground goes sour and fruit bodies rot.
- **Rain today**: ×0.85 from 20 mm, ×0.75 from 40 mm (soaked mushrooms keep
  badly).
- **Diurnal trigger**: ×1.05 for warm days with cool, frost-free nights.
- **Season**: a mid-month table for the Mittelland (`seasonByMonth`): 1.0 in
  Aug/Sep, 0.95 in Oct, 0.75 in Jun, 0.28 in Mar, 0.15 in Jan/Feb,
  interpolated daily. It keeps a warm, wet January honest.

**Season and elevation** (new in v2). The table is for about 550 m
(`seasonReferenceElevation`). Higher up, the season starts later and ends
earlier, so the calendar is stretched away from the peak day
(`seasonPeakDay`, 1 September): `seasonShiftDaysPer100m` (3 days, after
Hopkins' bioclimatic law) per 100 m, measured 120 days from the peak. At
1500 m, mid-October reads like late October in the Mittelland, mid-May like
late April. The peak itself does not move. Most of the altitude effect still
comes from the weather data (Open-Meteo corrects temperatures for elevation),
so the shift is deliberately modest. The elevation comes from the Open-Meteo
response for the chosen coordinates.

**Bands.** 80–100 Hervorragend · 55–79 Gut · 30–54 Mässig · 0–29 Schlecht.

**History window.** The page fetches 35 days of history plus the forecast and
shows the last 14 days and the next 3: the sustained-wetness term runs over
21 days and the soil store has a memory of roughly a month, so every displayed
day has a fully warmed-up water balance behind it.

## Tuning

There are three ways to change the parameters:

- **In the page.** The section "Modellparameter" lists every parameter with its
  description. Changes apply immediately (to the forecast and the scenario page),
  are kept in the browser, and can be copied as JSON.
- **For a quick check.** Save overrides as JSON (for example
  `{"fieldCapacity": 100, "flushRamp": [6, 36]}`) and run
  `bun run scenarios overrides.json`. It shows every scenario's new score next
  to the old one.
- **To change the defaults.** Edit `default` in
  [`src/model/params.ts`](src/model/params.ts), then run `bun run docs:params`
  to refresh the table below and `bun test`. The scenario bands must still hold.
  The score snapshot shows exactly what moved; accept it with
  `bun test --update-snapshots` once you agree with the change.

## Reference scenarios and how to review them

[`src/model/scenarios.ts`](src/model/scenarios.ts) holds 26 synthetic six-week
histories, each with the **rating an experienced forager would expect** for the
last day and a reason for it, plus pairwise comparisons such as "the same rain
spread out must beat three downpours by at least 15 points". The test suite
asserts all of them. `bun run scenarios` prints them as a table, and the page
`scenarios.html` (linked in the page footer) shows each one with its weather,
the score breakdown, and a form where reviewers record their own rating and
comments. The form copies everything as text to send back.

**To add a case from experience**, copy a scenario in `scenarios.ts`, describe
the weather with `series(endDate, 42, (i, age) => mild({...}))` (`age` counts
days back from the scored day), and set `expect` to the lowest and highest
rating that would be acceptable.

### Open questions

Three scenarios are marked `open`: the expectation is a hypothesis the current
model does not meet, so they show up as `todo` in the test run instead of
failing. All three are about how the flush timing reacts to what came before:

| Scenario                                                                     | Model | Hypothesis                                                   |
| ---------------------------------------------------------------------------- | ----- | ------------------------------------------------------------ |
| `drought-broken-recently`: five weeks dry, then five rainy days 3–7 days ago | 86    | Mässig at best: after a drought the first flush takes longer |
| `drought-broken-two-weeks-ago`: same rain 12–16 days ago, dry since          | 19    | Mässig to gut: the delayed first flush                       |
| `dry-spell-after-wet`: wet month, then ten dry days                          | 6     | Mässig: the last flush is fading, not gone                   |

The first two point at the same gap: the flush kernel is the same whatever came
before, whereas field guidance says the first flush after a drought lags by
2–3 weeks. A possible fix is a kernel that stretches when the sustained-wetness
term was low before the rain. That is a new mechanism needing calibration, so it
waits for reviewers to confirm the hypotheses. Once they answer, either change
the model until the scenario passes, or change the expectation. Either way,
remove `open`.

## Sources

Peer-reviewed work on climate and mushroom yields:

- [Yield models for ectomycorrhizal mushrooms in _Pinus sylvestris_ forests, with focus on _Boletus edulis_ and _Lactarius_ group _deliciosus_](https://www.sciencedirect.com/science/article/abs/pii/S0378112712003635): Forest Ecology and Management, 15 years of plot data; rainfall and temperature significant in every fitted model.
- [Primary productivity and climate control mushroom yields in Mediterranean pine forests](https://www.sciencedirect.com/science/article/abs/pii/S0168192320301179): 22–24-year series; soil moisture from remote sensing rivals precipitation as a predictor (r = 0.63–0.72).
- [Effect of climatic and soil moisture conditions on mushroom productivity](https://www.sciencedirect.com/science/article/abs/pii/S0168192317303441): yields track same-month weather and soil moisture, with precipitation showing a one-month delay.
- [Drought-induced changes in the phenology, productivity and diversity of Spanish fungi](https://www.sciencedirect.com/science/article/abs/pii/S1754504815000331): what a dry spell does to the season.
- [A thirty-year survey reveals that ecosystem function of fungi predicts phenology of mushroom fruiting](https://pmc.ncbi.nlm.nih.gov/articles/PMC3507881/): PLOS ONE / PMC.
- [Antecedent precipitation index](https://glossary.ametsoc.org/wiki/antecedent-precipitation-index/): AMS Glossary of Meteorology, the weighted-decaying-rainfall soil-moisture proxy this model borrows.

Field and foraging guidance (used for the thresholds the papers do not give):

- [Pilzesammeln nach Regen](https://pilz-und-kraut.de/pilzesammeln-nach-regen/): best finds 3–10 days after decent rainfall.
- [Pilze sammeln nach dem Regen: der ideale Zeitpunkt](https://www.ludwigshafen24.de/tiere-natur/morgens-regen-pilze-sammeln-wann-steinpilz-wetter-beste-zeit-schnell-wachsen-tipps-september-saison-93857600.html): 15–23 °C, rainfall over 10 l/m² across several days, growth falling off below 5 °C and above 25 °C.
- [Einflussgrößen auf das Pilzwachstum](http://www.wernerlahmer.de/Pilz4You/einflussgroeszen.html): temperature, moisture and humidity as growth drivers.
- [Wann kommen die Pilze nach dem Regen?](https://lacasadelassetas.com/blog/en/the-mushrooms-are-already-here-find-out-when-mushrooms-come-out-after-the-rains/): 5–10 days generally, 12–15 for warmth-loving boletes.
- [How fast do mushrooms grow after rain?](https://fungiatlas.com/how-fast-do-mushrooms-grow-after-rain/): porcini reaching harvestable size in 3–6 days after a soaking.
- [Best climate for growing chanterelles](https://exploreingredients.com/best-climate-for-growing-chanterelle-mushrooms/): 15–21 °C, 3–4 inches of rain over two weeks, first flush 2–3 weeks after sustained rain.
- [Gemeiner Steinpilz](https://de.wikipedia.org/wiki/Gemeiner_Steinpilz): habitat and season for the Swiss Mittelland.

## Parameter reference

Generated from [`src/model/params.ts`](src/model/params.ts). The labels and
descriptions are German because the in-page parameter panel shows the same
text to foragers.

<!-- params:start (generated by `bun run docs:params`) -->

#### Wasserhaushalt

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `infiltrationSaturation` | Sättigung der Versickerung | 19 | mm | Wie viel Regen pro Tag höchstens in den Boden gelangt. Wirksamer Regen = S · tanh(Regen / S): 8 mm zählen fast voll, von 40 mm kommt weniger als die Hälfte an. Kleinere Werte bestrafen Wolkenbrüche stärker. |
| `fieldCapacity` | Feldkapazität | 85 | mm | Wie viel Wasser der Wurzelraum halten kann. Was darüber hinausgeht, versickert und ist verloren. |
| `retentionBase` | Speicherrate | 0.95 |  | Anteil des Bodenwassers, der bei der Referenztemperatur von einem Tag zum nächsten erhalten bleibt (der Rest verdunstet oder wird von den Pflanzen aufgenommen). |
| `retentionPerDegree` | Verdunstung pro Grad | 0.004 | 1/°C | Wie stark die tägliche Speicherrate pro Grad Tagesmittel über der Referenztemperatur sinkt. Wärmere Tage trocknen den Boden schneller aus. |
| `retentionReferenceTemp` | Referenztemperatur der Verdunstung | 8 | °C | Tagesmittel, bei dem genau die Speicherrate gilt. |
| `retentionRange` | Grenzen der Speicherrate | [0.8, 0.96] |  | Die temperaturabhängige Speicherrate bleibt immer in diesem Bereich. |
| `snowMaxTemp` | Schneegrenze (Tagesmaximum) | 1 | °C | Liegt das Tagesmaximum darunter, fällt der Niederschlag als Schnee. Er wird als Schneedecke gespeichert und zählt erst, wenn er schmilzt. |
| `meltPerDegreeDay` | Schneeschmelze | 3 | mm/°C | Schmelzwasser pro Grad Tagesmittel über 0 °C (Gradtagverfahren). |

#### Feuchte-Faktoren

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `moistureRamp` | Bodenfeuchte | [8, 40] | mm | Bodenwasserspeicher, ab dem der Boden als feucht gilt (von) und ab dem er voll zählt (bis). |
| `sustainWindow` | Fenster der anhaltenden Feuchte | 21 | Tage | Über wie viele Tage das Myzel feucht gewesen sein muss, um Fruchtkörper bilden zu können. |
| `sustainWetRamp` | Feuchter Tag | [12, 36] | mm | Bodenwasserspeicher, ab dem ein einzelner Tag im Fenster als feucht zählt (von) bzw. als voll feucht (bis). |
| `sustainRamp` | Anhaltende Feuchte | [0.15, 0.7] |  | Mittlere Feuchte im Fenster (0 = immer trocken, 1 = immer feucht), ab der der Faktor zu wirken beginnt (von) und voll ist (bis). |
| `sustainFloor` | Untergrenze anhaltende Feuchte | 0.45 |  | Ein trockener Monat verhindert einen Schub nicht ganz, er bremst ihn nur. Der Faktor sinkt nie unter diesen Wert. |

#### Auslösender Regen

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `flushKernel` | Verzögerung des Schubs | 0 T.: 0, 1 T.: 0.05, 2 T.: 0.15, 3 T.: 0.45, 4 T.: 0.75, 5 T.: 0.95, 6 T.: 1, 7 T.: 1, 8 T.: 0.95, 9 T.: 0.85, 10 T.: 0.7, 11 T.: 0.55, 12 T.: 0.4, 13 T.: 0.28, 14 T.: 0.18, 15 T.: 0.1, 16 T.: 0.05 |  | Wie stark Regen von vor n Tagen zum Schub von heute beiträgt (Index = Tage zurück). Höchstwert bei 6–7 Tagen, der Regen von heute zählt nicht. |
| `flushRamp` | Auslösender Regen | [6, 42] | mm | Gewichtete Regensumme (mm) im Schubfenster, ab der der Faktor zu wirken beginnt (von) und voll ist (bis). |

#### Gewichtung

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `weightMoisture` | Gewicht Bodenfeuchte | 0.28 |  | Exponent im gewichteten geometrischen Mittel der drei Wasserfaktoren. Die drei Gewichte sollten zusammen 1 ergeben. |
| `weightSustain` | Gewicht anhaltende Feuchte | 0.3 |  | Exponent der anhaltenden Feuchte (siehe oben). |
| `weightFlush` | Gewicht auslösender Regen | 0.42 |  | Exponent des auslösenden Regens (siehe oben). |

#### Temperatur

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `tempColdRamp` | Kälteschwelle (Tagesmittel) | [2, 12] | °C | Unter «von» bilden sich keine Fruchtkörper, ab «bis» ist es warm genug. |
| `tempWarmRamp` | Wärmeschwelle (Tagesmittel) | [18, 27] | °C | Bis «von» ideal, ab «bis» zu warm. |
| `tempTodayWeight` | Gewicht der heutigen Temperatur | 0.55 |  | Anteil der heutigen Temperatur gegenüber dem Mittel der vorangehenden Tage. Das Myzel reagiert auf die Witterung, nicht auf einen einzelnen Nachmittag. |
| `tempHistoryDays` | Temperatur-Gedächtnis | 10 | Tage | Über wie viele vorangehende Tage die Temperatur gemittelt wird. |
| `temperatureGateFloor` | Untergrenze Temperaturschranke | 0.15 |  | Auch bei ungeeigneter Temperatur bleibt dieser Anteil übrig, für späte Arten, die bei wenigen Grad noch erscheinen. |

#### Staunässe

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `saturationLevel` | Beginn der Staunässe | 0.75 |  | Anteil der Feldkapazität, ab dem der Boden als durchnässt gilt. |
| `saturationWindow` | Fenster der Staunässe | 10 | Tage | Über wie viele Tage durchnässte Tage gezählt werden. |
| `saturationPenalty` | Abzug bei Staunässe | 0.45 |  | Grösster Abzug, wenn der Boden im ganzen Fenster gesättigt war (0,45 = −45 %). |

#### Frost

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `frostLightBelow` | Leichter Frost unter | 0 | °C | Tagesminimum, unter dem leichter Nachtfrost gilt. |
| `frostLightFactor` | Faktor leichter Frost | 0.75 |  | Multiplikator für einen Tag mit leichtem Nachtfrost. |
| `frostModerateBelow` | Frost unter | -2 | °C | Tagesminimum, unter dem die Fruchtkörper Schaden nehmen. |
| `frostModerateFactor` | Faktor Frost | 0.4 |  | Multiplikator für einen Frosttag. |
| `frostHardBelow` | Strenger Frost unter | -5 | °C | Tagesminimum, unter dem für die meisten Speisepilze die Saison endet. |
| `frostHardFactor` | Faktor strenger Frost | 0.15 |  | Multiplikator für einen Tag mit strengem Frost. |
| `frostAftermathDays` | Nachwirkung strenger Frost | 5 | Tage | So viele Tage nach strengem Frost wirkt er noch nach. |
| `frostAftermathFactor` | Faktor Nachwirkung | 0.5 |  | Multiplikator in den Tagen nach strengem Frost. |

#### Hitze

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `heatWarmFrom` | Warmer Tag ab | 28 | °C | Tagesmaximum, ab dem der Oberboden schnell austrocknet. |
| `heatWarmFactor` | Faktor warmer Tag | 0.85 |  | Multiplikator für einen warmen Tag. |
| `heatHotFrom` | Hitzetag ab | 32 | °C | Tagesmaximum, ab dem die Streuschicht austrocknet. |
| `heatHotFactor` | Faktor Hitzetag | 0.7 |  | Multiplikator für einen Hitzetag. |

#### Regen am Tag selbst

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `rainHeavyFrom` | Starkregen ab | 20 | mm | Tagesniederschlag, ab dem die Fruchtkörper sich vollsaugen (und das Sammeln wenig Freude macht). |
| `rainHeavyFactor` | Faktor Starkregen | 0.85 |  | Multiplikator für einen Starkregentag. |
| `rainCloudburstFrom` | Wolkenbruch ab | 40 | mm | Tagesniederschlag, ab dem ein Wolkenbruch gilt. |
| `rainCloudburstFactor` | Faktor Wolkenbruch | 0.75 |  | Multiplikator für einen Wolkenbruchtag. |

#### Tag/Nacht-Auslöser

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `diurnalSpreadRange` | Tagesgang | [6, 15] | °C | Spanne zwischen Tagesmaximum und -minimum, in der der Auslöser «warme Tage, kühle Nächte» greift. |
| `diurnalNightRange` | Kühle Nacht | [5, 14] | °C | Bereich des Tagesminimums für den Auslöser (frostfrei, kühl). |
| `diurnalMaxDay` | Höchstens so warm am Tag | 25 | °C | Tagesmaximum, über dem der Auslöser nicht mehr greift. |
| `diurnalBonus` | Bonus | 1.05 |  | Multiplikator, wenn die Bedingungen erfüllt sind (1,05 = +5 %). |

#### Saison

| Parameter | Bezeichnung | Standard | Einheit | Beschreibung |
|---|---|---|---|---|
| `seasonByMonth` | Saisonfaktor (Monatsmitte) | Jan: 0.15, Feb: 0.15, Mär: 0.28, Apr: 0.45, Mai: 0.6, Jun: 0.75, Jul: 0.9, Aug: 1, Sep: 1, Okt: 0.95, Nov: 0.6, Dez: 0.25 |  | Wie viele Speisepilze die Jahreszeit hergibt, jeweils zur Monatsmitte, auf Referenzhöhe. Dazwischen wird linear interpoliert. |
| `seasonReferenceElevation` | Referenzhöhe | 550 | m ü. M. | Höhe, für die die Saisontabelle gilt (Mittelland). Höher gelegene Orte haben eine kürzere Saison. |
| `seasonPeakDay` | Saisonhöhepunkt | 244 | Tag im Jahr | Tag im Jahr, um den sich die Saison in der Höhe zusammenzieht (244 = 1. September). |
| `seasonShiftDaysPer100m` | Saisonverschiebung pro 100 m | 3 | Tage | Um so viele Tage pro 100 m über der Referenzhöhe beginnt die Saison später und endet früher (gemessen 120 Tage vom Höhepunkt entfernt, näher am Höhepunkt entsprechend weniger). 0 schaltet die Höhenkorrektur ab. |

<!-- params:end -->
