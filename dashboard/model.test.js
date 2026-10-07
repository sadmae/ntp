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

test("construction technologies move as one factor", function () {
  var calm = m.constructionScenario(100, 8);
  assert.equal(calm.length, 4);
  calm.forEach(function (row) {
    assert.equal(row.scenarioPct, 8);
    assert.ok(row.factPct > 30);
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

test("coefficient registry keeps the missing behavioral links explicit", function () {
  assert.ok(m.COEFFICIENTS.length >= 8);
  assert.equal(m.STEPS.length, 7);
  var raw = m.COEFFICIENTS.find(function (c) { return c.id === "k_raw_to_drug"; });
  assert.equal(raw.status, "missing");
});
