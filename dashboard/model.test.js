const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("./model.js");

test("manufacturing concentration matches the reported 62 percent", function () {
  assert.ok(Math.abs(m.metallurgyShareOfManufacturing() - 62) < 0.2);
  assert.equal(
    m.round(m.FACTS.manufacturing.metallurgyPp + m.FACTS.manufacturing.otherPp, 1),
    13.7
  );
});

test("drug market identity recovers the reported import growth and a falling domestic level", function () {
  var y2021 = m.pharmaSnapshot(2021);
  var y2023 = m.pharmaSnapshot(2023);
  assert.ok(Math.abs(y2021.domesticMln - 885.301) < 0.01);
  assert.ok(Math.abs(y2023.domesticMln - 681.651) < 0.01);
  assert.ok(Math.abs(m.importGrowthPct() - 111.15) < 0.1);
  assert.ok(Math.abs(m.domesticChangePct() + 23) < 0.05);
  assert.ok(y2023.consumptionMln > y2021.consumptionMln);
  assert.ok(y2023.domesticMln < y2021.domesticMln);
});

test("raw-material identity is the complement of local processing", function () {
  assert.equal(m.unprocessedExportShare(6), 94);
  assert.equal(m.processingInFactRange(6), true);
  assert.equal(m.processingInFactRange(5), true);
  assert.equal(m.processingInFactRange(7), true);
  assert.equal(m.processingInFactRange(20), false);
});

test("open loop: missing coefficient does not move the drug market", function () {
  assert.equal(m.scenarioShare(2, null, 20, 6), null);
  assert.equal(m.scenarioShare(2, undefined, 20, 6), null);
});

test("closed loop: coefficient maps processing into market share and levels", function () {
  var share = m.scenarioShare(2, 0.2, 16, 6);
  assert.equal(share, 4);
  var base = m.pharmaSnapshot(2023).consumptionMln;
  var market = m.marketFromShare(base, share);
  assert.ok(Math.abs(market.domesticMln + market.importMln - base) < 1e-6);
  assert.ok(market.domesticMln > m.pharmaSnapshot(2023).domesticMln);
  assert.ok(market.importMln < m.FACTS.pharma.import2023);
});

test("inertial path damps the observed share and linear step falls through zero", function () {
  assert.equal(m.inertialShare(2, 0.5), 1);
  assert.ok(m.linearShareStep(2, 5.3) < 0);
  assert.equal(m.inertialShare(2, 1.2), null);
});

test("a new observation revises the coefficient and scores the error", function () {
  var baseShare = 2;
  var processingBase = 6;
  var processingNow = 16;
  var k = 0.2;
  var predicted = m.scenarioShare(baseShare, k, processingNow, processingBase);
  var consumption = m.pharmaSnapshot(2023).consumptionMln;
  var scenario = m.marketFromShare(consumption, predicted);
  var inertial = m.marketFromShare(consumption, m.inertialShare(baseShare, 0.5));
  var factShare = 3;
  var err = m.errors(factShare, null, inertial, scenario);
  assert.equal(err.scenarioShare, factShare - predicted);
  assert.equal(m.impliedK(factShare, baseShare, processingNow, processingBase), 0.1);
  assert.equal(m.impliedK(factShare, baseShare, processingBase, processingBase), null);
  assert.equal(err.inertialShare, 2);
});

test("plan score does not enter the forecast functions", function () {
  var gap = m.GAPS.find(function (g) { return g.id === "№9"; });
  assert.equal(m.planScore(gap), 10);
  var before = m.inertialShare(m.FACTS.pharma.share2023, 0.5);
  gap.productivity = 1;
  assert.equal(m.planScore(gap), 6);
  assert.equal(m.inertialShare(m.FACTS.pharma.share2023, 0.5), before);
  gap.productivity = 5;
});

test("legacy technology chart matches the previous dashboard bars", function () {
  var bars = m.legacyTechnologyBars();
  assert.equal(bars.length, 10);
  assert.equal(bars[0].process, "Лекарственные средства");
  assert.equal(bars[0].growthPct, 65.6);
  assert.equal(bars.find(function (b) { return b.process.indexOf("Текстиль") === 0; }).growthPct, 9.6);
  assert.equal(bars.find(function (b) { return b.process.indexOf("Цемент") === 0; }).growthPct, 37.4);
  assert.equal(bars.find(function (b) { return b.process.indexOf("Резина") === 0; }).growthPct, 25.9);
  assert.equal(bars.find(function (b) { return b.process.indexOf("Добыча") === 0; }).growthPct, 14.2);
  assert.equal(bars.find(function (b) { return b.process.indexOf("Нефте") === 0; }).growthPct, 3);
});

test("construction technologies move as one factor", function () {
  var calm = m.constructionScenario(100, 8);
  assert.equal(calm.length, 4);
  calm.forEach(function (row) {
    assert.equal(row.scenarioPct, 8);
    assert.ok(row.factPct >= 25.9);
  });
  var half = m.coolGrowth(40.7, 50, 8);
  assert.ok(Math.abs(half - 24.35) < 1e-9);
  var food = m.FACTS.technologies.find(function (t) { return t.process.indexOf("Пищевая") === 0; });
  assert.equal(food.driver, "other");
});

test("every gap has a market stance and the high scores are not market-confirmed", function () {
  assert.equal(m.GAPS.length, 10);
  var scores = m.GAPS.map(m.planScore).sort(function (a, b) { return b - a; });
  assert.deepEqual(scores, [10, 9, 8, 8, 8, 8, 7, 5, 5, 2]);
  m.GAPS.forEach(function (gap) {
    assert.ok(m.STANCES[gap.stance], gap.id);
    var view = m.gapView(gap);
    assert.ok(view.evidence.length > 20);
    assert.ok(view.forecast.length > 20);
  });
  var top = m.GAPS.filter(function (g) { return m.planScore(g) >= 8; });
  top.forEach(function (g) {
    assert.notEqual(g.stance, "market_baseline");
  });
});

test("falling GDP shares are not falling nominal output", function () {
  var agriVa2021 = m.nominalVa(2021, "agriculture");
  assert.ok(m.nominalVa(2025, "agriculture") > agriVa2021);
  assert.ok(m.nominalVa(2025, "education") > m.nominalVa(2021, "education"));
  assert.ok(m.nominalVa(2025, "health") > m.nominalVa(2021, "health"));
  assert.ok(m.OBSERVED.gdpShares.agriculture[2025] < m.OBSERVED.gdpShares.agriculture[2021]);
  var volume = m.agriVolumeRatio2025to2021();
  assert.ok(volume > 1.17 && volume < 1.18);
});

test("finance expanded without fixed capital in the sector", function () {
  var ratio = m.nominalVa(2025, "finance") / m.nominalVa(2021, "finance");
  assert.ok(ratio > 4.5 && ratio < 4.7);
  assert.ok(m.activityShare(2025, "finance") < 0.02);
});

test("pharma value fell while physical volume rose, so the implicit price halved", function () {
  assert.ok(m.pharmaValueRatio2024to2021() < 0.7);
  assert.ok(m.pharmaVolumeRatio2024to2021() > 1.3);
  var price = m.pharmaImplicitPriceRatio();
  assert.ok(price > 0.48 && price < 0.51);
  assert.equal(m.OBSERVED.pharmaVolume2025FactorOfficial, 1.7);
});

test("investment sources balance and the activity table does not", function () {
  var src = m.OBSERVED.investmentBySource[2025];
  var internal = src.republicanBudget + src.localBudget + src.enterprises + src.bankCredit + src.households;
  var external = src.foreignLoans + src.fdi + src.grants;
  assert.ok(Math.abs(internal + external - src.total) < 0.2);
  assert.ok(m.investmentResidual(2025) > 150000);
  assert.ok(m.sourceShare(2025, "households") > 20);
  assert.ok(m.sourceShare(2025, "republicanBudget") > 20);
});

test("gold and remittances are opposite loops in 2025", function () {
  assert.equal(m.OBSERVED.remittancesNetMlnUsd[2025], 3117.4);
  assert.ok(Math.abs(m.OBSERVED.remittancesNetMlnUsd[2023] * 1.186 - 2543.7) < 0.3);
  assert.ok(m.OBSERVED.goldExportMlnUsd[2025] < m.OBSERVED.goldExportMlnUsd[2024] / 3);
  var atFact = m.constructionProportion(21.1);
  assert.ok(Math.abs(atFact[0].scenarioPct - 35.7) < 1e-9);
  var stopped = m.constructionProportion(0);
  assert.equal(stopped[0].scenarioPct, 0);
});

test("apparel shock does not move output until the channel and the response are both named", function () {
  var a = m.OBSERVED.apparel;
  assert.equal(a.volumeGrowth2025Pct, 15.6);
  assert.equal(a.groupValue2025MlnSom, 25120);
  assert.equal(a.textileClothingExportValueIndex, 75.8);
  assert.equal(a.russiaClothingAccessoriesMlnUsd, 74.9);
  assert.equal(m.sectorResponse({}).outputIndex, null);
  assert.equal(m.sectorResponse({ channelSharePct: 40 }).outputIndex, null);
  var open = m.sectorResponse({ channelSharePct: 40, lossPct: 50 });
  assert.equal(open.exposedPct, 20);
  assert.equal(open.outputIndex, null);
  assert.equal(open.ceilingIndex, 80);
  var closed = m.sectorResponse({ channelSharePct: 40, lossPct: 50, redirectPct: 25, stockPct: 25 });
  assert.equal(closed.passThrough, 0.5);
  assert.equal(closed.outputIndex, 90);
  assert.equal(closed.salesIndex, 85);
  assert.equal(closed.inventoryPct, 5);
  assert.equal(closed.consistent, true);
  var held = m.sectorResponse({ channelSharePct: 40, lossPct: 100, redirectPct: 0, stockPct: 100 });
  assert.equal(held.outputIndex, 100);
  assert.equal(held.salesIndex, 60);
  var none = m.sectorResponse({ channelSharePct: 0, lossPct: 100 });
  assert.equal(none.outputIndex, 100);
  var broken = m.sectorResponse({ channelSharePct: 40, lossPct: 50, redirectPct: 80, stockPct: 30 });
  assert.equal(broken.consistent, false);
  assert.equal(broken.outputIndex, null);
  var gap = m.GAPS.find(function (g) { return g.id === "№7"; });
  var before = gap.productivity;
  var first = m.sectorResponse({ channelSharePct: 40, lossPct: 50, redirectPct: 0, stockPct: 0 }).outputIndex;
  gap.productivity = 1;
  assert.equal(m.sectorResponse({ channelSharePct: 40, lossPct: 50, redirectPct: 0, stockPct: 0 }).outputIndex, first);
  gap.productivity = before;
  assert.equal(first, 80);
});

test("sector reading names the conclusion and the measure that follows from the open arrow", function () {
  var empty = m.sectorReading({});
  assert.equal(empty.stage, "channel");
  assert.equal(empty.measures.length, 2);
  var split = m.sectorReading({ channelSharePct: 40, lossPct: 50 });
  assert.equal(split.stage, "split");
  assert.ok(split.conclusion.indexOf("20") >= 0);
  assert.ok(split.measures[1].indexOf("80") >= 0);
  var closed = m.sectorReading({ channelSharePct: 40, lossPct: 50, redirectPct: 25, stockPct: 25 });
  assert.equal(closed.stage, "closed");
  assert.ok(closed.conclusion.indexOf("90") >= 0);
  assert.ok(closed.measures[0].indexOf("остановка пошива") >= 0);
  var stocked = m.sectorReading({ channelSharePct: 40, lossPct: 100, redirectPct: 0, stockPct: 100 });
  assert.ok(stocked.measures[0].indexOf("запас") >= 0);
  var replaced = m.sectorReading({ channelSharePct: 40, lossPct: 100, redirectPct: 100, stockPct: 0 });
  assert.ok(replaced.measures[0].indexOf("замещ") >= 0);
  assert.equal(m.sectorReading({ channelSharePct: 0, lossPct: 80 }).stage, "none");
  assert.equal(m.sectorReading({ channelSharePct: 40, lossPct: 50, redirectPct: 80, stockPct: 30 }).stage, "broken");
});

test("coefficient registry keeps the missing behavioral links explicit", function () {
  assert.ok(m.COEFFICIENTS.length >= 8);
  assert.equal(m.STEPS.length, 7);
  var raw = m.COEFFICIENTS.find(function (c) { return c.id === "k_raw_to_drug"; });
  assert.equal(raw.status, "missing");
});
