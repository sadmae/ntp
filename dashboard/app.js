(function () {
  "use strict";

  var M = window.KtpModel;
  var state = loadState();

  function loadState() {
    var blank = {
      processing: 6,
      k: "",
      persistence: 0.5,
      productivity: 5,
      resource: 5,
      factShare: "",
      factImport: "",
      construction: 21.1
    };
    try {
      var saved = JSON.parse(localStorage.getItem("ktp_ntp_closed_loop") || "null");
      if (!saved) return blank;
      Object.keys(blank).forEach(function (key) {
        if (saved[key] == null) saved[key] = blank[key];
      });
      return saved;
    } catch (e) {
      return blank;
    }
  }

  function saveState() {
    try { localStorage.setItem("ktp_ntp_closed_loop", JSON.stringify(state)); } catch (e) {}
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function fmt(n, digits) {
    if (n == null || !isFinite(n)) return "—";
    return n.toLocaleString("ru-RU", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function bln(mln) {
    return fmt(mln / 1000, 1) + " млрд";
  }

  function signed(n, digits) {
    if (n == null || !isFinite(n)) return "—";
    return (n > 0 ? "+" : "") + fmt(n, digits);
  }

  function numOrNull(value) {
    if (value === "" || value == null) return null;
    var n = Number(String(value).replace(",", "."));
    return isFinite(n) ? n : null;
  }

  document.querySelectorAll(".tab").forEach(function (button) {
    button.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (tab) { tab.classList.remove("active"); });
      document.querySelectorAll(".view").forEach(function (view) { view.classList.add("hidden"); });
      button.classList.add("active");
      document.getElementById(button.getAttribute("data-tab")).classList.remove("hidden");
    });
  });

  var painted = false;

  function render() {
    renderMarket();
    if (!painted) {
      paintPharma();
      paintMethod();
      painted = true;
    }
    fillPharma();
    fillMethod();
    saveState();
  }

  function renderMarket() {
    var o = M.OBSERVED;
    var householdGrowth = M.sourceGrowth("households", 2024, 2025);
    var budgetGrowth = M.sourceGrowth("republicanBudget", 2024, 2025);
    var loanGrowth = M.sourceGrowth("foreignLoans", 2024, 2025);
    var creditGrowth = M.sourceGrowth("bankCredit", 2024, 2025);
    var agriVolume = (M.agriVolumeRatio2025to2021() - 1) * 100;
    var financeRatio = M.nominalVa(2025, "finance") / M.nominalVa(2021, "finance");
    var residual = M.investmentResidual(2025);
    var residualShare = residual / o.investmentByActivity[2025].total * 100;

    var sectors = [
      ["agriculture", "Сельское хозяйство", "Физический объём 2025 к 2021: " + signed(agriVolume, 1) + "%"],
      ["education", "Образование", "Инвестиции: " + bln(o.investmentByActivity[2021].education) + " → " + bln(o.investmentByActivity[2025].education) + " сомов"],
      ["health", "Здравоохранение", "Инвестиции: " + bln(o.investmentByActivity[2021].health) + " → " + bln(o.investmentByActivity[2025].health) + " сомов"],
      ["finance", "Финансы", "Добавленная стоимость ×" + fmt(financeRatio, 1) + ". Инвестиции сектора в 2025: " + fmt(o.investmentByActivity[2025].finance, 1) + " млн сомов"],
      ["manufacturing", "Обработка", "Доля выросла слабо относительно номинального ВВП"],
      ["trade", "Торговля", "Объём оборота в 2025: " + signed(o.tradeVolumeGrowth2025Pct, 1) + "%"],
      ["construction", "Строительство", "Объём продукции в 2025: " + signed(o.constructionVolumeGrowth2025Pct, 1) + "%"]
    ];

    var sectorRows = sectors.map(function (row) {
      var va2021 = M.nominalVa(2021, row[0]);
      var va2025 = M.nominalVa(2025, row[0]);
      var share2021 = o.gdpShares[row[0]][2021];
      var share2025 = o.gdpShares[row[0]][2025];
      var shareClass = share2025 < share2021 ? "down" : "up";
      var vaClass = va2025 > va2021 ? "up" : "down";
      return "<tr><td>" + esc(row[1]) + "<div class='small muted'>" + esc(row[2]) + "</div></td>" +
        "<td class='num'>" + fmt(share2021, 1) + "</td>" +
        "<td class='num " + shareClass + "'>" + fmt(share2025, 1) + "</td>" +
        "<td class='num'>" + fmt(va2021 / 1000, 1) + "</td>" +
        "<td class='num " + vaClass + "'>" + fmt(va2025 / 1000, 1) + "</td></tr>";
    }).join("");

    var sources = [
      ["households", "Средства населения"],
      ["republicanBudget", "Республиканский бюджет"],
      ["enterprises", "Предприятия"],
      ["bankCredit", "Кредиты банков"],
      ["foreignLoans", "Иностранные кредиты"],
      ["fdi", "Прямые иностранные"],
      ["grants", "Гранты"],
      ["localBudget", "Местный бюджет"]
    ];
    var maxSource = Math.max.apply(null, sources.map(function (s) {
      return Math.max(M.sourceShare(2021, s[0]), M.sourceShare(2025, s[0]));
    }));
    var sourceBars = sources.map(function (s) {
      var a = M.sourceShare(2021, s[0]);
      var b = M.sourceShare(2025, s[0]);
      return "<div class='bar-row'><div class='bar-label'>" + esc(s[1]) + "</div>" +
        "<div class='bar-track' title='2021'><div class='bar-fill' style='width:" + (a / maxSource * 100) + "%;background:#8a93a6'></div></div>" +
        "<div class='num' style='width:52px'>" + fmt(a, 0) + "</div></div>" +
        "<div class='bar-row'><div class='bar-label muted'>2025</div>" +
        "<div class='bar-track'><div class='bar-fill' style='width:" + (b / maxSource * 100) + "%;background:#5b9bff'></div></div>" +
        "<div class='num' style='width:52px'>" + fmt(b, 0) + "</div></div>";
    }).join("");

    var gaps = M.GAPS.map(M.gapView).sort(function (a, b) { return b.plan - a.plan || a.rank - b.rank; });
    var gapRows = gaps.map(function (g) {
      return "<tr><td>" + esc(g.id) + "</td><td>" + esc(g.name) +
        "<div class='small muted'>" + esc(g.evidence) + "</div></td>" +
        "<td class='num'>" + g.plan + "</td><td>" + esc(g.stanceLabel) +
        "<div class='small muted'>" + esc(g.forecast) + "</div></td></tr>";
    }).join("");

    document.getElementById("market").innerHTML =
      "<div class='grid three'>" +
        cardLoop("demand", "Контур спроса", fmt(o.remittancesNetMlnUsd[2025], 1) + " млн $",
          "Чистый приток переводов в 2025, " + signed(o.remittancesGrowthPct[2025], 1) + "%. Реальная зарплата " +
          signed(o.realWageGrowth2025Pct, 1) + "%. Стройка " + signed(o.constructionVolumeGrowth2025Pct, 1) +
          "%, торговля " + signed(o.tradeVolumeGrowth2025Pct, 1) + "%. Средства населения в инвестициях " +
          signed(householdGrowth, 1) + "% к 2024. Стройматериалы " + signed(o.materialsGrowth2025Pct, 1) + "%.") +
        cardLoop("budget", "Контур бюджета и кредита", signed(budgetGrowth, 0) + "%",
          "Республиканский бюджет в инвестициях к 2024 году. Иностранные кредиты " + signed(loanGrowth, 0) +
          "%, кредиты банков " + signed(creditGrowth, 0) + "%. Это рычаг финансирования, его нельзя подписывать как научно-технический прогресс.") +
        cardLoop("gold", "Контур золота", fmt(o.goldExportMlnUsd[2025], 1) + " млн $",
          "Экспорт золота после " + fmt(o.goldExportMlnUsd[2024], 1) + " млн в 2024 (" + signed(o.goldExportGrowth2025Pct, 1) +
          "%). Весь товарный экспорт " + signed(o.goodsExportGrowth2025Pct, 1) + "%. ВВП при этом " +
          signed(o.gdpRealGrowthPct[2025], 1) + "%. Внутренний бум и внешняя цена разошлись.") +
      "</div>" +
      technologyChart() +
      "<div class='card'><h2>Доля в ВВП и выпуск — разные величины</h2>" +
      "<p class='small muted'>Добавленная стоимость в текущих ценах посчитана как доля × ВВП. Это следствие двух рядов НСК, не отдельная публикация отраслевого выпуска.</p>" +
      "<table><thead><tr><th>Сектор</th><th class='num'>Доля 2021</th><th class='num'>Доля 2025</th><th class='num'>ВДС 2021, млрд</th><th class='num'>ВДС 2025, млрд</th></tr></thead><tbody>" +
      sectorRows + "</tbody></table></div>" +
      "<div class='grid two'><div class='card'><h2>Кто финансировал инвестиции</h2>" +
      "<p class='small muted'>Доля источника в инвестициях в основной капитал, %. Серая полоса — 2021, синяя — 2025.</p>" +
      sourceBars + "</div>" +
      "<div class='card'><h2>Кредит идёт в потребление и торговлю</h2>" +
      "<p class='kpi'>" + fmt(o.credit2025MlnSom / 1000, 1) + "</p>" +
      "<p class='small muted'>млрд сомов кредитов банков и небанковских организаций на конец 2025 года, сообщение НСК. Около " +
      fmt(o.credit2025SharesPct.consumer, 0) + "% — потребительские, " + fmt(o.credit2025SharesPct.trade, 0) +
      "% — торговля, " + fmt(o.credit2025SharesPct.mortgage, 0) + "% — ипотека, " +
      fmt(o.credit2025SharesPct.agriculture, 1) + "% — сельское хозяйство.</p>" +
      "<div class='callout warn'><p>Таблица инвестиций по видам деятельности не сходится с итогом: в 2025 году не распределено " +
      bln(residual) + " сомов (" + fmt(residualShare, 0) + "%). Строки «строительство» в ней — капитал строительных организаций, а не объём стройки. Остаток не подписан жильём: такой строки в таблице нет.</p></div>" +
      "<p class='small muted'>Курс на конец 2025 года " + fmt(o.usdKgsEnd2025, 2) + " сома за доллар, " +
      signed(o.usdKgsEnd2025ChangePct, 1) + "% к концу 2024. Год бума прошёл без курсового скачка.</p></div></div>" +
      "<div class='card'><h2>Балл плана рядом с реакцией реальности</h2>" +
      "<p class='small muted'>Балл — сумма критериев доклада. Реакция взята из рядов НСК и НБКР там, где ряд есть.</p>" +
      "<table><thead><tr><th>ID</th><th>Разрыв</th><th class='num'>Балл</th><th>Что из этого следует для прогноза</th></tr></thead><tbody>" +
      gapRows + "</tbody></table></div>";
  }

  function technologyChart() {
    var bars = M.legacyTechnologyBars();
    var maxVal = Math.max.apply(null, bars.map(function (row) { return row.growthPct; })) * 1.08;
    var rows = bars.map(function (row) {
      var color = row.growthPct > 25 ? "#f4b942" : (row.growthPct < 10 ? "#ff5d6c" : "#3ecf8e");
      var width = (row.growthPct / maxVal * 100).toFixed(1);
      var label = String(row.growthPct) + "%";
      return "<div class='bar-row'><div class='bar-label' title='" + esc(row.note) + "'>" + esc(row.process) + "</div>" +
        "<div class='bar-track'><div class='bar-fill' style='width:" + width + "%;background:" + color +
        ";color:#0f1420;font-size:11px;font-weight:700;line-height:16px;padding-left:6px;'>" + label + "</div></div></div>";
    }).join("");
    return "<div class='card'><h2>Рост технологических процессов, %</h2>" +
      "<p class='small muted'>Тот же блок, что на прежнем дашборде. Он перенесён на эту вкладку, а не оставлен отдельной страницей. Жёлтым отмечен рост выше 25%, красным — ниже 10%.</p>" +
      rows +
      "<p class='small muted'>Лекарства здесь нарисованы как 100%, потому что доклад пишет темп ×2. НСК за 2025 год даёт рост физического объёма в 1,7 раза. Химия в том сообщении +19,8%, добыча +14,2%. Цемент, бетон, резина и дерево на графике выглядят отдельными процессами, а двигаются вместе со стройкой.</p></div>";
  }

  function cardLoop(kind, title, kpi, text) {
    return "<div class='card'><span class='tag " + kind + "'>" + esc(title) + "</span><div class='kpi'>" +
      esc(kpi) + "</div><p class='small'>" + esc(text) + "</p></div>";
  }

  function paintPharma() {
    document.getElementById("pharma").innerHTML =
      "<div class='grid two'><div class='card'><h2>Стоимость выпуска, млн сомов</h2>" +
      "<p class='small muted'>НСК, открытые данные. Ряд обрывается на 2024 годе.</p><div id='valueBars'></div>" +
      "<p class='small' id='priceNote'></p>" +
      "<p class='small muted' id='volume2025'></p></div>" +
      "<div class='card'><h2>Внутренний рынок готовых лекарств</h2>" +
      "<p class='small muted'>" + esc(M.FACTS.pharma.finishedExportAssumption) + "</p>" +
      "<table><thead><tr><th></th><th class='num'>2021</th><th class='num'>2023</th></tr></thead><tbody id='marketRows'></tbody></table>" +
      "<p class='small' id='marketNote'></p></div></div>" +
      "<div class='grid two'><div class='card'><h2>Баланс сырья — тождество</h2>" +
      "<label for='processing'>Локальная переработка, %</label>" +
      "<input id='processing' type='range' min='0' max='40' step='0.5'>" +
      "<p id='processingText'></p><p class='eq'>экспорт без обработки = 100 − локальная переработка</p></div>" +
      "<div class='card'><h2>Рынок лекарств — поведение</h2>" +
      "<label for='kInput'>k: пунктов доли рынка на 1 пункт переработки</label>" +
      "<input id='kInput' type='text' inputmode='decimal' placeholder='нет в данных'>" +
      "<label for='persistence'>Инерция: какая доля остаётся через шаг</label>" +
      "<input id='persistence' type='range' min='0' max='1' step='0.05'>" +
      "<p class='small' id='behaviorText'></p>" +
      "<div id='closure' class='callout'></div>" +
      "<p class='eq'>доля сценария = 2,0 + k × (переработка − 6)</p></div></div>" +
      "<div class='card'><h2>Балл плана этот прогноз не двигает</h2>" +
      "<div class='grid two'><div><label for='prod'>Производительность, разрыв №9</label>" +
      "<input id='prod' type='range' min='1' max='5' step='1'></div>" +
      "<div><label for='res'>Экономия ресурсов</label>" +
      "<input id='res' type='range' min='1' max='5' step='1'></div></div>" +
      "<p id='scoreText'></p></div>" +
      "<div class='card'><h2>Новое наблюдение пересчитывает коэффициент</h2>" +
      "<div class='grid two'><div><label for='factShare'>Факт доли своих, %</label>" +
      "<input id='factShare' type='text' inputmode='decimal' placeholder='ещё нет'></div>" +
      "<div><label for='factImport'>Факт импорта, млн сомов</label>" +
      "<input id='factImport' type='text' inputmode='decimal' placeholder='необязательно'></div></div>" +
      "<div id='errorBlock'></div>" +
      "<p class='small muted'>Пустые поля — честное состояние: ряда после 2023 года в докладе нет, открытые данные НСК долю рынка лекарств не публикуют в этом наборе.</p></div>";
    ["processing", "persistence", "prod", "res"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function (event) {
        state[event.target.id === "prod" ? "productivity" : event.target.id === "res" ? "resource" : event.target.id] = event.target.value;
        fillPharma();
        saveState();
      });
    });
    ["kInput", "factShare", "factImport"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function (event) {
        var key = id === "kInput" ? "k" : id;
        state[key] = event.target.value;
        fillPharma();
        saveState();
      });
    });
    document.getElementById("processing").value = state.processing;
    document.getElementById("persistence").value = state.persistence;
    document.getElementById("prod").value = state.productivity;
    document.getElementById("res").value = state.resource;
    document.getElementById("kInput").value = state.k;
    document.getElementById("factShare").value = state.factShare;
    document.getElementById("factImport").value = state.factImport;
  }

  function fillPharma() {
    var o = M.OBSERVED;
    var processing = Number(state.processing);
    var k = numOrNull(state.k);
    var persistence = Number(state.persistence);
    var baseShare = M.FACTS.pharma.share2023;
    var exportShare = M.unprocessedExportShare(processing);
    var inFact = M.processingInFactRange(processing);
    var inertialShare = M.inertialShare(baseShare, persistence);
    var scenario = M.scenarioShare(baseShare, k, processing, M.FACTS.pharma.localProcessingMid);
    var consumption = M.pharmaSnapshot(2023).consumptionMln;
    var inertialMarket = M.marketFromShare(consumption, inertialShare);
    var scenarioMarket = M.marketFromShare(consumption, scenario);
    var factShare = numOrNull(state.factShare);
    var factImport = numOrNull(state.factImport);
    var err = factShare == null ? null : M.errors(factShare, factImport, inertialMarket, scenarioMarket);
    var implied = factShare == null ? null : M.impliedK(factShare, baseShare, processing, M.FACTS.pharma.localProcessingMid);
    var plan = Number(state.productivity) + Number(state.resource);
    var valueRatio = (M.pharmaValueRatio2024to2021() - 1) * 100;
    var volumeRatio = (M.pharmaVolumeRatio2024to2021() - 1) * 100;
    var priceRatio = (M.pharmaImplicitPriceRatio() - 1) * 100;
    var snap21 = M.pharmaSnapshot(2021);
    var snap23 = M.pharmaSnapshot(2023);

    var years = [2020, 2021, 2022, 2023, 2024];
    var maxValue = Math.max.apply(null, years.map(function (y) { return o.pharmaValueMln[y]; }));
    var valueBars = years.map(function (y) {
      var v = o.pharmaValueMln[y];
      return "<div class='bar-row'><div class='bar-label'>" + y + "</div><div class='bar-track'><div class='bar-fill' style='width:" +
        (v / maxValue * 100) + "%;background:" + (y === 2021 ? "#3ecf8e" : "#ff5d6c") + "'></div></div><div class='num' style='width:64px'>" +
        fmt(v, 1) + "</div></div>";
    }).join("");

    var closure = scenario == null
      ? "Контур разомкнут: переработка сырья не двигает рынок готовых лекарств, потому что коэффициент k не задан."
      : "Контур замкнут допущением k = " + fmt(k, 2) + ". Это не оценка по ряду, пока вместо допущения не подставлен факт.";

    var errorBlock = "";
    if (err) {
      errorBlock = "<div class='callout'><p>Ошибка инерции по доле: " + signed(err.inertialShare, 2) + " п.п. " +
        (err.scenarioShare == null ? "Ошибки сценария нет: сценарий не задан." : "Ошибка сценария по доле: " + signed(err.scenarioShare, 2) + " п.п.") +
        "</p><p>" + (implied == null
          ? "Переработка не сдвинута относительно 6%, поэтому факт не пересчитывает k."
          : "Коэффициент, который согласует этот факт с базой 2023 года: k = " + fmt(implied, 3) + ".") +
        "</p></div>";
    }

    document.getElementById("valueBars").innerHTML = valueBars;
    document.getElementById("priceNote").textContent =
      "К 2021 году стоимость " + signed(valueRatio, 1) + "%, физический объём " + signed(volumeRatio, 1) +
      "%, неявная цена выпуска " + signed(priceRatio, 0) + "%. Следствие деления двух индексов, не отдельный дефлятор НСК.";
    document.getElementById("volume2025").textContent =
      "2025: НСК сообщает рост физического объёма в " + fmt(o.pharmaVolume2025FactorOfficial, 1) +
      " раза. В докладе указано ×" + fmt(o.pharmaVolume2025FactorMemo, 0) + ". Стоимости 2025 года в открытых данных ещё нет.";
    document.getElementById("marketRows").innerHTML =
      "<tr><td>Доля своих, % доклада</td><td class='num'>" + fmt(snap21.sharePct, 1) + "</td><td class='num'>" + fmt(snap23.sharePct, 1) + "</td></tr>" +
      "<tr><td>Импорт, млн сомов</td><td class='num'>" + fmt(snap21.importMln, 1) + "</td><td class='num'>" + fmt(snap23.importMln, 1) + "</td></tr>" +
      "<tr><td>Отечественные продажи, следствие</td><td class='num'>" + fmt(snap21.domesticMln, 1) + "</td><td class='num'>" + fmt(snap23.domesticMln, 1) + "</td></tr>";
    document.getElementById("marketNote").textContent =
      "Импорт " + signed(M.importGrowthPct(), 1) + "%. Отечественные продажи, если верить тождеству, " +
      signed(M.domesticChangePct(), 1) + "%. Индекс валового выпуска и доля на рынке — разные объекты.";
    document.getElementById("processingText").textContent =
      "Сейчас " + fmt(processing, 1) + "%. Экспорт без обработки " + fmt(exportShare, 1) + "%. " +
      (inFact ? "Это внутри факта доклада 5–7%." : "Это уже сценарий, не факт доклада.");
    document.getElementById("behaviorText").textContent =
      "Инерционная доля " + fmt(inertialShare, 2) + "%. Сценарная доля " +
      (scenario == null ? "не задана" : fmt(scenario, 2) + "%") + ". При потреблении 2023 года (" +
      fmt(consumption, 0) + " млн) инерционный импорт " + fmt(inertialMarket.importMln, 0) + " млн" +
      (scenarioMarket ? ", сценарный импорт " + fmt(scenarioMarket.importMln, 0) + " млн." : ".");
    var closureNode = document.getElementById("closure");
    closureNode.className = "callout " + (scenario == null ? "crit" : "warn");
    closureNode.textContent = closure;
    document.getElementById("scoreText").textContent =
      "Балл плана: " + plan + ". Инерционная доля остаётся " + fmt(inertialShare, 2) +
      "%. Сдвиньте балл — доля не изменится.";
    document.getElementById("errorBlock").innerHTML = errorBlock;
  }

  function paintMethod() {
    var steps = M.STEPS.map(function (step) {
      return "<li><strong>" + esc(step.title) + ".</strong> " + esc(step.text) + "</li>";
    }).join("");
    var statusLabel = { missing: "Нет ряда", one_year: "Один год", observed: "Наблюдается" };
    var coeffs = M.COEFFICIENTS.map(function (c) {
      return "<tr><td>" + esc(c.name) + "<div class='small muted'>" + esc(c.closes) + "</div></td>" +
        "<td><span class='tag " + c.status + "'>" + esc(statusLabel[c.status] || c.status) + "</span></td></tr>";
    }).join("");
    document.getElementById("method").innerHTML =
      "<div class='card callout'><p>Правило допуска в прогноз. Высокий балл плана остаётся общественным критерием. В прогноз он попадает, если инерция уже ведёт в ту же сторону или если назван рычаг и коэффициент. Внешняя цена, общий цикл и доля ВВП прогнозируются своими рядами.</p></div>" +
      "<div class='card'><h2>Семь шагов</h2><ol class='steps'>" + steps + "</ol></div>" +
      "<div class='card'><h2>Пропорция стройки 2025 года</h2>" +
      "<label for='construction'>Объём строительства, % к предыдущему году</label>" +
      "<input id='construction' type='range' min='-10' max='40' step='0.1'>" +
      "<p id='constructionText'></p>" +
      "<table><thead><tr><th>Технология</th><th class='num'>Факт 2025</th><th class='num'>При этом темпе стройки</th></tr></thead><tbody id='linkedRows'></tbody></table></div>" +
      "<div class='card'><h2>Реестр коэффициентов</h2>" +
      "<table><thead><tr><th>Связка</th><th>Состояние</th></tr></thead><tbody>" + coeffs + "</tbody></table></div>" +
      "<div class='card sources'><h2>Откуда ряды</h2><ul class='small'>" +
      "<li><a href='https://stat.gov.kg/ru/opendata/category/4752/'>ВВП, млн сомов</a> и <a href='https://stat.gov.kg/ru/opendata/category/2314/'>структура по видам деятельности</a></li>" +
      "<li><a href='https://stat.gov.kg/ru/opendata/category/361/'>Объём промышленной продукции</a> и <a href='https://stat.gov.kg/ru/opendata/category/628/'>индексы физического объёма</a></li>" +
      "<li><a href='https://stat.gov.kg/ru/opendata/category/4591/'>Инвестиции по видам деятельности</a> и <a href='https://stat.gov.kg/ru/opendata/category/168/'>по источникам финансирования</a></li>" +
      "<li><a href='https://stat.gov.kg/ru/opendata/category/5928/'>Индекс физического объёма сельского хозяйства</a> до 2024 года; 2025 год — из оперативного бюллетеня НСК, 102,2%</li>" +
      "<li><a href='https://stat.gov.kg/ru/news/po-itogam-2025-goda-rost-vvp-sostavil-111-procenta/'>Итоги 2025 года</a>: ВВП +11,1%, промышленность +10,6%, стройка +21,1%, торговля +17,8%, сельское хозяйство +2,2%, фармацевтика в 1,7 раза, стройматериалы +35,7%</li>" +
      "<li><a href='https://stat.gov.kg/ru/news/kapital-organizacij-finansovogo-sektora-uvelichilsya-pochti-vdvoe/'>Кредитный портфель на конец 2025</a></li>" +
      "<li>НБКР, годовой отчёт за 2024 и за 2025: переводы, золото, экспорт, реальная зарплата, курс</li>" +
      "</ul></div>";
    var slider = document.getElementById("construction");
    slider.value = state.construction;
    slider.addEventListener("input", function () {
      state.construction = slider.value;
      fillMethod();
      saveState();
    });
  }

  function fillMethod() {
    var growth = Number(state.construction);
    var linked = M.constructionProportion(growth);
    document.getElementById("constructionText").textContent =
      "Сейчас " + fmt(growth, 1) + "%. Факт НСК — 21,1%. При факте таблица повторяет 2025 год. При другом темпе технологии масштабируются той же пропорцией. Один год не оценивает эластичность.";
    document.getElementById("linkedRows").innerHTML = linked.map(function (row) {
      return "<tr><td>" + esc(row.process) + "<div class='small muted'>" + esc(row.detail) + "</div></td>" +
        "<td class='num'>" + fmt(row.factPct, 1) + "</td><td class='num'>" + fmt(row.scenarioPct, 1) + "</td></tr>";
    }).join("");
  }

  render();
})();
