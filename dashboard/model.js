(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KtpModel = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Figures are taken from the inventory note (КП НТП / СТОНХ).
  // Derived values are identities under an explicit assumption, not new official statistics.
  var FACTS = {
    science: {
      rndGdpPct: 0.05,
      rndTargetPct: 0.12,
      rndTargetYear: 2030,
      budgetMlnSom: 893,
      eaeuAvgPct: 1.2,
      russiaPct: 1.8,
      chinaPct: 2.4,
      usaPct: 3.1
    },
    gdpRealGrowth2025Pct: 11.1,
    servicesSharePct: 51.2,
    goodsSharePct: 34.4,
    manufacturing: {
      gdpSharePct: 13.7,
      metallurgyPp: 8.5,
      otherPp: 5.2
    },
    gdp: [
      { sector: "Финансы и страхование", y2021: 3.9, y2025: 7.1 },
      { sector: "Торговля, ремонт", y2021: 15.6, y2025: 17.8 },
      { sector: "Обрабатывающая промышленность", y2021: 11.8, y2025: 13.7 },
      { sector: "Строительство", y2021: 7.3, y2025: 8.7 },
      { sector: "Гостиницы и рестораны", y2021: 1.2, y2025: 2.1 },
      { sector: "Сельское хозяйство", y2021: 12.4, y2025: 8.0 },
      { sector: "Операции с недвижимостью", y2021: 6.3, y2025: 4.2 },
      { sector: "Образование", y2021: 5.7, y2025: 4.3 },
      { sector: "Госуправление и оборона", y2021: 6.3, y2025: 5.0 },
      { sector: "Здравоохранение", y2021: 2.6, y2025: 2.0 }
    ],
    technologies: [
      { process: "Лекарственные средства", growthLabel: "×2", growthPct: null, driver: "low_base", note: "Эффект низкой базы, 0,1% промышленности" },
      { process: "Пищевая промышленность", growthLabel: "+30,1%", growthPct: 30.1, driver: "other", note: "Крупнейший неметаллургический блок" },
      { process: "Резина и пластмасса", growthLabel: "+35,7%", growthPct: 35.7, driver: "construction", note: "Производная строительного бума" },
      { process: "Цемент", growthLabel: "+34,1%", growthPct: 34.1, driver: "construction", note: "Производная строительного бума" },
      { process: "Изделия из бетона и гипса", growthLabel: "+40,7%", growthPct: 40.7, driver: "construction", note: "Производная строительного бума" },
      { process: "Дерево, бумага, полиграфия", growthLabel: "+30,5%", growthPct: 30.5, driver: "construction", note: "Вспомогательный для стройки" },
      { process: "Химическая продукция", growthLabel: "+17,7%", growthPct: 17.7, driver: "other", note: "Вспомогательный" },
      { process: "Текстиль и одежда", growthLabel: "+7,1–8,5%", growthPct: null, growthMin: 7.1, growthMax: 8.5, driver: "other", note: "Стагнация" },
      { process: "Нефтепродукты", growthLabel: "+5,8%", growthPct: 5.8, driver: "other", note: "Практическая стагнация" },
      { process: "Добыча полезных ископаемых", growthLabel: "+10,6–15,5%", growthPct: null, growthMin: 10.6, growthMax: 15.5, driver: "gold", note: "В основном за счёт золота" }
    ],
    pharma: {
      share2021: 5.3,
      share2023: 2.0,
      import2021: 15818.5,
      import2023: 33400.9,
      importDependenceLabel: "95–97%",
      rawExportUnprocessedLabel: "93–95%",
      localProcessingLabel: "5–7%",
      localProcessingMid: 6,
      localProcessingMin: 5,
      localProcessingMax: 7,
      industrySharePct: 0.1,
      // Assumption: finished-drug exports are small, so domestic sales ≈ consumption − import.
      finishedExportAssumption: "Экспорт готовых лекарств мал, поэтому отечественные продажи на внутреннем рынке ≈ импорт × доля / (100 − доля)."
    }
  };

  var STANCES = {
    reverse: {
      label: "Рынок воспроизводит разрыв",
      forecast: "Инерция сохраняет разрыв. Сдвиг возможен как сценарий с названным рычагом и коэффициентом."
    },
    wrong_metric: {
      label: "Доля ВВП не измеряет критерий",
      forecast: "Прогноз технологии требует выпуска, занятости и производительности. Доля в ВВП этого не заменяет."
    },
    external: {
      label: "Внешняя цена",
      forecast: "Прогноз условный: сначала драйвер (цена и физический выпуск), потом отраслевой итог."
    },
    level_trap: {
      label: "Темп не равен масштабу",
      forecast: "Прогноз вести в уровнях выпуска и в доле рынка. Высокий темп от низкой базы структуру не меняет."
    },
    common_factor: {
      label: "Общий циклический драйвер",
      forecast: "Связанные технологии прогнозируются одним фактором. Отдельный темп не является независимой ставкой."
    },
    market_baseline: {
      label: "Базовая траектория рынка",
      forecast: "Это наблюдаемая база прогноза. Перенос роста в другой сектор — сценарий, а не экстраполяция."
    }
  };

  var GAPS = [
    {
      id: "№9",
      rank: 1,
      name: "Экспорт непереработанного лекарственного сырья",
      desc: "93–95% сырья уходит без обработки",
      productivity: 5,
      resourceSaving: 5,
      stance: "reverse",
      evidence: "Доклад: 93–95% сырья уходит без обработки. Отдельного ряда НСК по этому коэффициенту нет, поэтому связь сырья с рынком готовых лекарств остаётся разомкнутой."
    },
    {
      id: "№4",
      rank: 2,
      name: "Утрата аграрного технологического ядра",
      desc: "Доля сельского хозяйства в ВВП: 12,4% → 8,0%",
      productivity: 4,
      resourceSaving: 5,
      stance: "wrong_metric",
      evidence: "Доля в ВВП 12,4% → 8,0%. Физический объём продукции сельского хозяйства с 2021 по 2025 год вырос примерно на 17% (индексы НСК). Номинальная добавленная стоимость тоже выросла. Сжалась доля, а не выпуск."
    },
    {
      id: "№8",
      rank: 3,
      name: "Фармзависимость",
      desc: "Импорт лекарств +111% за 2 года, доля своих 5,3% → 2,0%",
      productivity: 3,
      resourceSaving: 5,
      stance: "reverse",
      evidence: "По докладу доля своих на рынке 5,3% → 2,0% при росте импорта на 111%. Стоимостный выпуск фармацевтики по НСК упал с 846 млн сомов в 2021 году до 565 млн в 2024-м."
    },
    {
      id: "№10",
      rank: 3,
      name: "Дефицит НИОКР",
      desc: "0,05% ВВП при цели 0,12% к 2030 году",
      productivity: 5,
      resourceSaving: 3,
      stance: "reverse",
      evidence: "0,12% ВВП — бюджетное намерение. В данных нет рыночного механизма, который сам поднимает НИОКР даже до этой цели, тем более до 1,2% по ЕАЭС."
    },
    {
      id: "№7",
      rank: 3,
      name: "Стагнация текстиля и нефтепереработки",
      desc: "Текстиль +7,1–8,5%, нефтепродукты +5,8%",
      productivity: 4,
      resourceSaving: 4,
      stance: "reverse",
      evidence: "Индекс объёма текстиля в 2022–2024 годах рос (107, 119, 115). В 2025 году НБКР фиксирует спад экспорта готовых текстильных изделий из-за логистики. Нефтепродукты: индекс объёма 186,9 в 2024 году, затем медленный темп. Загрузки мощностей по-прежнему нет."
    },
    {
      id: "№3",
      rank: 3,
      name: "Деградация человеческого капитала",
      desc: "Образование −1,4 п.п., здравоохранение −0,6 п.п. ВВП",
      productivity: 5,
      resourceSaving: 3,
      stance: "wrong_metric",
      evidence: "Доли образования и здравоохранения в ВВП сжались, но номинальная добавленная стоимость выросла примерно вдвое. Инвестиции в образование выросли с 3,6 до 15,9 млрд сомов. Доля не равна деградации."
    },
    {
      id: "№6",
      rank: 7,
      name: "Фармацевтика — эффект низкой базы",
      desc: "Темп ×2 при доле в промышленности 0,1%",
      productivity: 3,
      resourceSaving: 4,
      stance: "level_trap",
      evidence: "НСК: физический объём в 2025 году в 1,7 раза (в докладе — ×2). За 2021–2024 стоимость выпуска упала на треть при росте физического объёма примерно на 36%. Темп 2025 года — низкая база, не масштаб."
    },
    {
      id: "№2",
      rank: 8,
      name: "Моноструктура обработки",
      desc: "Около 62% обработки — металлургия, в основном золото",
      productivity: 3,
      resourceSaving: 2,
      stance: "external",
      evidence: "НБКР: экспорт золота 2 506 млн долларов в 2024 году и 683 млн в 2025-м (−72,8%), весь экспорт −44,7%. ВВП при этом +11,1%. Золото и внутренний спрос разошлись."
    },
    {
      id: "№5",
      rank: 8,
      name: "Рост обработки как производная стройки",
      desc: "Цемент, бетон, резина, дерево: +30–41%",
      productivity: 2,
      resourceSaving: 3,
      stance: "common_factor",
      evidence: "НСК: объём строительства в 2025 году +21,1%, резинопласты и стройматериалы +35,7%, дерево и бумага +30,5%. Это один цикл, не четыре независимые технологии."
    },
    {
      id: "№1",
      rank: 10,
      name: "Рост ВВП без технологической базы",
      desc: "Финансы +3,2 п.п., торговля +2,2 п.п.",
      productivity: 1,
      resourceSaving: 1,
      stance: "market_baseline",
      evidence: "Номинальная добавленная стоимость финансов выросла примерно в 4,6 раза. Инвестиции в основной капитал самого финансового сектора в 2025 году — 43 млн сомов. Рост сектора не копит технологические мощности."
    }
  ];

  function round(n, digits) {
    var p = Math.pow(10, digits);
    return Math.round(n * p) / p;
  }

  function planScore(gap) {
    return gap.productivity + gap.resourceSaving;
  }

  function metallurgyShareOfManufacturing() {
    return FACTS.manufacturing.metallurgyPp / FACTS.manufacturing.gdpSharePct * 100;
  }

  // Identity: domestic sales on the home market, if finished-drug exports are negligible.
  function domesticSales(importMln, sharePct) {
    if (sharePct < 0 || sharePct >= 100) return null;
    return importMln * sharePct / (100 - sharePct);
  }

  function consumption(importMln, sharePct) {
    var domestic = domesticSales(importMln, sharePct);
    if (domestic == null) return null;
    return importMln + domestic;
  }

  function pharmaSnapshot(year) {
    var share = year === 2021 ? FACTS.pharma.share2021 : FACTS.pharma.share2023;
    var importMln = year === 2021 ? FACTS.pharma.import2021 : FACTS.pharma.import2023;
    var domestic = domesticSales(importMln, share);
    return {
      year: year,
      sharePct: share,
      importMln: importMln,
      domesticMln: domestic,
      consumptionMln: importMln + domestic
    };
  }

  function importGrowthPct() {
    return (FACTS.pharma.import2023 / FACTS.pharma.import2021 - 1) * 100;
  }

  function domesticChangePct() {
    var a = pharmaSnapshot(2021).domesticMln;
    var b = pharmaSnapshot(2023).domesticMln;
    return (b / a - 1) * 100;
  }

  // Complementary identity used by the inventory: processing + unprocessed export = 100.
  function unprocessedExportShare(localProcessingPct) {
    return 100 - localProcessingPct;
  }

  function processingInFactRange(localProcessingPct) {
    return localProcessingPct >= FACTS.pharma.localProcessingMin &&
      localProcessingPct <= FACTS.pharma.localProcessingMax;
  }

  // Inertial path: the observed share persists, damped. Not an estimated model.
  function inertialShare(baseShare, persistence) {
    if (persistence < 0 || persistence > 1) return null;
    return baseShare * persistence;
  }

  // Linear step using the only observed change (2021 → 2023). Can leave [0, 100).
  function linearShareStep(shareNow, shareThen) {
    return shareNow + (shareNow - shareThen);
  }

  // Behavioral link. Null k means the loop is open: processing does not move the drug market.
  function scenarioShare(baseShare, k, processingNow, processingBase) {
    if (k == null || typeof k !== "number" || !isFinite(k)) return null;
    var next = baseShare + k * (processingNow - processingBase);
    return Math.min(99.9, Math.max(0, next));
  }

  function marketFromShare(baseConsumption, sharePct) {
    if (sharePct == null) return null;
    var domestic = baseConsumption * sharePct / 100;
    return {
      sharePct: sharePct,
      domesticMln: domestic,
      importMln: baseConsumption - domestic
    };
  }

  function impliedK(factShare, baseShare, processingNow, processingBase) {
    var delta = processingNow - processingBase;
    if (Math.abs(delta) < 1e-9) return null;
    return (factShare - baseShare) / delta;
  }

  function errors(factShare, factImport, inertial, scenario) {
    return {
      inertialShare: factShare - inertial.sharePct,
      scenarioShare: scenario ? factShare - scenario.sharePct : null,
      inertialImport: factImport == null ? null : factImport - inertial.importMln,
      scenarioImport: scenario && factImport != null ? factImport - scenario.importMln : null
    };
  }

  function coolGrowth(growthPct, coolingPct, baselinePct) {
    var w = Math.min(100, Math.max(0, coolingPct)) / 100;
    return growthPct * (1 - w) + baselinePct * w;
  }

  function constructionScenario(coolingPct, baselinePct) {
    return FACTS.technologies
      .filter(function (t) { return t.driver === "construction"; })
      .map(function (t) {
        return {
          process: t.process,
          factPct: t.growthPct,
          scenarioPct: coolGrowth(t.growthPct, coolingPct, baselinePct)
        };
      });
  }

  function gapView(gap) {
    var stance = STANCES[gap.stance];
    return {
      id: gap.id,
      rank: gap.rank,
      name: gap.name,
      desc: gap.desc,
      productivity: gap.productivity,
      resourceSaving: gap.resourceSaving,
      plan: planScore(gap),
      stance: gap.stance,
      stanceLabel: stance.label,
      forecast: stance.forecast,
      evidence: gap.evidence
    };
  }

  // Observed series. stat.kg does not resolve; the NSC site is stat.gov.kg.
  // Every derived figure is produced by a function below, not typed in as a fact.
  var OBSERVED = {
    gdpMlnSom: { 2021: 782854.3, 2022: 1020744.6, 2023: 1333730, 2024: 1582791.8, 2025: 1976389.4 },
    gdpRealGrowthPct: { 2024: 9.0, 2025: 11.1 },
    realWageGrowth2025Pct: 9.9,
    gdpShares: {
      agriculture: { 2021: 12.4, 2022: 11, 2023: 9.5, 2024: 8.6, 2025: 8 },
      manufacturing: { 2021: 11.8, 2022: 13.6, 2023: 12.6, 2024: 12.7, 2025: 13.7 },
      construction: { 2021: 7.3, 2022: 7.1, 2023: 7.3, 2024: 7.7, 2025: 8.7 },
      trade: { 2021: 15.6, 2022: 15.2, 2023: 16.6, 2024: 17.3, 2025: 17.8 },
      finance: { 2021: 3.9, 2022: 6.1, 2023: 5.3, 2024: 6.8, 2025: 7.1 },
      education: { 2021: 5.7, 2022: 6.3, 2023: 5.8, 2024: 4.9, 2025: 4.3 },
      health: { 2021: 2.6, 2022: 2.5, 2023: 2.3, 2024: 2.4, 2025: 2.0 }
    },
    // Physical volume, percent of previous year. 2025 agriculture and construction are full-year NSC figures.
    agriVolumeIndex: { 2021: 95.2, 2022: 107.3, 2023: 100.6, 2024: 106.3, 2025: 102.2 },
    constructionVolumeGrowth2025Pct: 21.1,
    tradeVolumeGrowth2025Pct: 17.8,
    industryVolumeGrowth2025Pct: 10.6,
    industryValue2025Mln: 799740.6,
    constructionValue2025Mln: 438481.7,
    materialsGrowth2025Pct: 35.7,
    woodPaperGrowth2025Pct: 30.5,
    foodGrowth2025Pct: 30.1,
    chemicalsGrowth2025Pct: 19.8,
    miningGrowth2025Pct: 14.2,
    pharmaVolume2025FactorOfficial: 1.7,
    pharmaVolume2025FactorMemo: 2,
    pharmaValueMln: { 2020: 772.1, 2021: 846.1, 2022: 720.6, 2023: 616.1, 2024: 565.3 },
    pharmaVolumeIndex: { 2020: 203.4, 2021: 64.2, 2022: 83, 2023: 134.9, 2024: 121.7 },
    textileVolumeIndex: { 2022: 107.2, 2023: 119.2, 2024: 115.3 },
    oilProductsVolumeIndex2024: 186.9,
    // Net inflow of cross-border personal remittances, mln USD. 2023 is the level printed on the NBKR 2024 chart; 2543.7 / 1.186 = 2144.8.
    remittancesNetMlnUsd: { 2023: 2144.9, 2024: 2543.7, 2025: 3117.4 },
    remittancesGrowthPct: { 2024: 18.6, 2025: 22.6 },
    goldExportMlnUsd: { 2024: 2506.1, 2025: 682.9 },
    goldExportGrowth2025Pct: -72.8,
    goodsExportMlnUsd: { 2024: 4922.3, 2025: 2840.6 },
    goodsExportGrowth2025Pct: -44.7,
    exportExGoldMlnUsd: { 2024: 2416.2, 2025: 2157.7 },
    usdKgsEnd2025: 87.4177,
    usdKgsEnd2025ChangePct: 0.5,
    credit2025MlnSom: 574500,
    credit2025SharesPct: { consumer: 37, trade: 23, agriculture: 10.5, mortgage: 10 },
    investmentByActivity: {
      2021: {
        total: 122843.3,
        agriculture: 2730.3,
        mining: 26509.2,
        manufacturing: 2738.2,
        energy: 8744.3,
        water: 2265.8,
        construction: null,
        trade: 5565.3,
        transport: 10150.4,
        hotels: 1891.1,
        ict: 5138.2,
        finance: 62.7,
        realEstate: 2364.8,
        professional: 848.1,
        admin: null,
        government: 427,
        education: 3628.6,
        health: 1521,
        arts: 1150.8,
        otherServices: 838.6
      },
      2025: {
        total: 374571.4,
        agriculture: 6615.3,
        mining: 29356.7,
        manufacturing: 19207.3,
        energy: 21967.5,
        water: 13222.6,
        construction: 308.4,
        trade: 4140.7,
        transport: 65515.4,
        hotels: 5700.8,
        ict: 5422.7,
        finance: 43.4,
        realEstate: 823.5,
        professional: 489.1,
        admin: 236.7,
        government: 8325.2,
        education: 15935.7,
        health: 2935.2,
        arts: 7252.5,
        otherServices: 897.1
      }
    },
    investmentBySource: {
      2021: {
        total: 122843.3,
        republicanBudget: 4822.4,
        localBudget: 2027.8,
        enterprises: 38964.8,
        bankCredit: 1235.1,
        households: 43962.3,
        foreignLoans: 14398.3,
        fdi: 11012.7,
        grants: 6419.9
      },
      2024: {
        total: 274301.2,
        republicanBudget: 55680.9,
        localBudget: 5602.9,
        enterprises: 84668.7,
        bankCredit: 13825.8,
        households: 76045.3,
        foreignLoans: 18462.4,
        fdi: 10422.2,
        grants: 9593
      },
      2025: {
        total: 374571.4,
        republicanBudget: 90299.2,
        localBudget: 11417.9,
        enterprises: 77268,
        bankCredit: 25284.3,
        households: 91388.2,
        foreignLoans: 48711.6,
        fdi: 20128.6,
        grants: 10073.6
      }
    },
    linkedToConstruction: [
      { process: "Резина, пластмасса и стройматериалы", growth2025: 35.7, detail: "Одна строка НСК за 2025 год. В докладе цемент, бетон и резина разведены внутри этого пучка." },
      { process: "Дерево, бумага, полиграфия", growth2025: 30.5, detail: "НСК, итоги 2025 года." }
    ]
  };

  var ACTIVITY_LABELS = {
    agriculture: "Сельское хозяйство",
    mining: "Добыча",
    manufacturing: "Обрабатывающие производства",
    energy: "Энергия",
    water: "Водоснабжение и отходы",
    construction: "Строительство как отрасль",
    trade: "Торговля",
    transport: "Транспорт",
    hotels: "Гостиницы и рестораны",
    ict: "Информация и связь",
    finance: "Финансы и страхование",
    realEstate: "Недвижимость",
    professional: "Профессиональная и научная деятельность",
    admin: "Административная деятельность",
    government: "Госуправление и оборона",
    education: "Образование",
    health: "Здравоохранение",
    arts: "Искусство и отдых",
    otherServices: "Прочие услуги"
  };

  function nominalVa(year, sector) {
    return OBSERVED.gdpMlnSom[year] * OBSERVED.gdpShares[sector][year] / 100;
  }

  function chainIndex(yearlyPct) {
    return yearlyPct.reduce(function (acc, pct) { return acc * pct / 100; }, 1);
  }

  function agriVolumeRatio2025to2021() {
    var v = OBSERVED.agriVolumeIndex;
    return chainIndex([v[2022], v[2023], v[2024], v[2025]]);
  }

  function pharmaVolumeRatio2024to2021() {
    var v = OBSERVED.pharmaVolumeIndex;
    return chainIndex([v[2022], v[2023], v[2024]]);
  }

  function pharmaValueRatio2024to2021() {
    return OBSERVED.pharmaValueMln[2024] / OBSERVED.pharmaValueMln[2021];
  }

  function pharmaImplicitPriceRatio() {
    return pharmaValueRatio2024to2021() / pharmaVolumeRatio2024to2021();
  }

  function investmentListedSum(year) {
    var row = OBSERVED.investmentByActivity[year];
    return Object.keys(row).reduce(function (acc, key) {
      if (key === "total" || row[key] == null) return acc;
      return acc + row[key];
    }, 0);
  }

  function investmentResidual(year) {
    var row = OBSERVED.investmentByActivity[year];
    return row.total - investmentListedSum(year);
  }

  function sourceShare(year, key) {
    var row = OBSERVED.investmentBySource[year];
    return row[key] / row.total * 100;
  }

  function sourceGrowth(key, fromYear, toYear) {
    var a = OBSERVED.investmentBySource[fromYear][key];
    var b = OBSERVED.investmentBySource[toYear][key];
    return (b / a - 1) * 100;
  }

  function activityShare(year, key) {
    var row = OBSERVED.investmentByActivity[year];
    if (row[key] == null) return null;
    return row[key] / row.total * 100;
  }

  // Keeps the 2025 ratio of each technology to construction volume.
  // One year is a proportion, not an estimated elasticity.
  function constructionProportion(constructionGrowthPct) {
    var base = OBSERVED.constructionVolumeGrowth2025Pct;
    return OBSERVED.linkedToConstruction.map(function (row) {
      return {
        process: row.process,
        factPct: row.growth2025,
        scenarioPct: base === 0 ? null : row.growth2025 * constructionGrowthPct / base,
        detail: row.detail
      };
    });
  }

  var COEFFICIENTS = [
    {
      id: "k_raw_to_drug",
      name: "П.п. доли рынка лекарств на 1 п.п. локальной переработки сырья",
      status: "missing",
      closes: "Связь разрыва №9 с разрывом №8"
    },
    {
      id: "price_wedge",
      name: "Соотношение цены экспортируемого сырья и цены импортного лекарства",
      status: "missing",
      closes: "Есть ли частная маржа у переработки"
    },
    {
      id: "utilization",
      name: "Загрузка мощностей текстиля и нефтепереработки",
      status: "missing",
      closes: "Проверка тезиса о росте почти без капвложений (№7)"
    },
    {
      id: "profit",
      name: "Рентабельность и инвестиции по отраслям",
      status: "missing",
      closes: "Поведенческая реакция капитала"
    },
    {
      id: "labor_productivity",
      name: "Производительность труда по отраслям и технологиям",
      status: "missing",
      closes: "Собственный критерий КП НТП, которого нет в ранжировании"
    },
    {
      id: "construction_beta",
      name: "Пропорция стройматериалов к объёму строительства",
      status: "one_year",
      closes: "В 2025 году строительство +21,1%, стройматериалы +35,7%. Это пропорция одного года, не эластичность"
    },
    {
      id: "gold",
      name: "Экспорт золота как внешний контур обработки и экспорта",
      status: "observed",
      closes: "2024: 2 506 млн долларов, 2025: 683 млн. Контур наблюдаем, коэффициент к ВВП ещё не оценён"
    },
    {
      id: "remittances",
      name: "Переводы, средства населения и строительный цикл",
      status: "one_year",
      closes: "Сравните темп переводов 2025 года, темп средств населения в инвестициях 2024–2025 и объём строительства. Совпадение одного года ещё не коэффициент"
    },
    {
      id: "rnd_lag",
      name: "Лаг и отдача НИОКР в производительности",
      status: "missing",
      closes: "Разрыв №10 нельзя вставлять в краткосрочный прогноз как мгновенный эффект"
    }
  ];

  var STEPS = [
    {
      n: 1,
      title: "Оставить СТОНХ инвентаризацией",
      text: "Четыре уровня — наука, отрасли, укрупнённые технологии, ресурсы — остаются картой технологической структуры. Балл производительности и экономии ресурсов остаётся общественным критерием отбора, а не прогнозом."
    },
    {
      n: 2,
      title: "Собрать вектор рынка по каждой технологии",
      text: "Объём, цена, доля импорта, доля сырья без переработки, рентабельность, инвестиции, занятость, загрузка. Пока компонента нет, у прогноза стоит пометка «нет сигнала», а не экспертная цифра."
    },
    {
      n: 3,
      title: "Замкнуть тождества",
      text: "Сырьё = переработка + экспорт без обработки. Потребление = отечественные продажи + импорт − экспорт. Тождество показывает масштаб, оно ещё не говорит, что агенты так поступят."
    },
    {
      n: 4,
      title: "Привязать технологии к внешним драйверам",
      text: "Для Кыргызстана базовый прогноз идёт от золота, строительного цикла, денежных переводов и курса. Отраслевой темп без драйвера описывает прошлое."
    },
    {
      n: 5,
      title: "Сценарий только от названного рычага",
      text: "Рычаг меняет частную отдачу: закупка, регистрация, кредит, тариф, бюджет НИОКР. Нет рычага и коэффициента — нет сценария, остаётся инерция."
    },
    {
      n: 6,
      title: "Раз в наблюдение записывать ошибку",
      text: "Факт минус инерция и факт минус сценарий. Коэффициент, который систематически расходится с фактом, заменяется на коэффициент, вычисленный из факта. Приоритет, который не двигает факт, остаётся политическим намерением."
    },
    {
      n: 7,
      title: "Пускать в прогноз только то, что переживает реакцию рынка",
      text: "Высокий балл плана попадает в прогноз, если инерция уже ведёт в нужную сторону или если сценарий привязан к рычагу. Внешняя цена, общий цикл и чужой измеритель прогнозируются своими рядами."
    }
  ];

  return {
    FACTS: FACTS,
    STANCES: STANCES,
    GAPS: GAPS,
    OBSERVED: OBSERVED,
    ACTIVITY_LABELS: ACTIVITY_LABELS,
    COEFFICIENTS: COEFFICIENTS,
    STEPS: STEPS,
    round: round,
    planScore: planScore,
    metallurgyShareOfManufacturing: metallurgyShareOfManufacturing,
    domesticSales: domesticSales,
    consumption: consumption,
    pharmaSnapshot: pharmaSnapshot,
    importGrowthPct: importGrowthPct,
    domesticChangePct: domesticChangePct,
    unprocessedExportShare: unprocessedExportShare,
    processingInFactRange: processingInFactRange,
    inertialShare: inertialShare,
    linearShareStep: linearShareStep,
    scenarioShare: scenarioShare,
    marketFromShare: marketFromShare,
    impliedK: impliedK,
    errors: errors,
    coolGrowth: coolGrowth,
    constructionScenario: constructionScenario,
    gapView: gapView,
    nominalVa: nominalVa,
    chainIndex: chainIndex,
    agriVolumeRatio2025to2021: agriVolumeRatio2025to2021,
    pharmaVolumeRatio2024to2021: pharmaVolumeRatio2024to2021,
    pharmaValueRatio2024to2021: pharmaValueRatio2024to2021,
    pharmaImplicitPriceRatio: pharmaImplicitPriceRatio,
    investmentListedSum: investmentListedSum,
    investmentResidual: investmentResidual,
    sourceShare: sourceShare,
    sourceGrowth: sourceGrowth,
    activityShare: activityShare,
    constructionProportion: constructionProportion
  };
});
