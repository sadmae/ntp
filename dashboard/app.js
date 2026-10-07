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
      construction: 21.1,
      apparelChannel: "",
      apparelLoss: "",
      apparelRedirect: "",
      apparelStock: "",
      goldNow: "",
      goldK: "",
      cycleRemittances: "",
      cycleK: ""
    };
    try {
      var saved = JSON.parse(localStorage.getItem("ktp_ntp_closed_loop") || "null");
      if (!saved) saved = blank;
      Object.keys(blank).forEach(function (key) {
        if (saved[key] == null) saved[key] = blank[key];
      });
      var query = new URLSearchParams(location.search);
      var fromQuery = {
        apparelChannel: query.get("channel"),
        apparelLoss: query.get("loss"),
        apparelRedirect: query.get("redirect"),
        apparelStock: query.get("stock")
      };
      Object.keys(fromQuery).forEach(function (key) {
        if (fromQuery[key] != null && fromQuery[key] !== "") saved[key] = fromQuery[key];
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

  var tabAlias = { guide: "start", worked: "start", method: "start" };

  function showTab(name) {
    var id = tabAlias[name] || name;
    var button = document.querySelector(".tab[data-tab='" + id + "']");
    if (!button) return;
    document.querySelectorAll(".tab").forEach(function (tab) { tab.classList.remove("active"); });
    document.querySelectorAll(".view").forEach(function (view) { view.classList.add("hidden"); });
    button.classList.add("active");
    document.getElementById(id).classList.remove("hidden");
    var missing = document.getElementById("missingBox");
    if (name === "method" && missing) missing.open = true;
    if (history.replaceState) history.replaceState(null, "", "#" + (name || id));
  }

  document.querySelectorAll(".tab").forEach(function (button) {
    button.addEventListener("click", function () {
      showTab(button.getAttribute("data-tab"));
    });
  });
  document.body.addEventListener("click", function (event) {
    var button = event.target.closest("[data-goto]");
    if (!button) return;
    showTab(button.getAttribute("data-goto"));
    window.scrollTo(0, 0);
  });
  if (location.hash.length > 1) showTab(location.hash.slice(1));
  window.addEventListener("hashchange", function () {
    showTab(location.hash.length > 1 ? location.hash.slice(1) : "start");
  });

  var painted = false;

  function render() {
    paintHome();
    renderMarket();
    if (!painted) {
      paintWorked();
      paintSector();
      paintPharma();
      paintGold();
      paintBuild();
      paintMethod();
      painted = true;
    }
    fillSector();
    fillPharma();
    fillGold();
    fillBuild();
    fillMethod();
    saveState();
  }

  function paintHome() {
    var o = M.OBSERVED;
    document.getElementById("jobMarketFact").textContent =
      "ВВП " + signed(o.gdpRealGrowthPct[2025], 1) + "%, экспорт золота " + signed(o.goldExportGrowth2025Pct, 1) +
      "%, стройка " + signed(o.constructionVolumeGrowth2025Pct, 1) + "%.";
    document.getElementById("jobSectorFact").textContent =
      "Одежда в 2025 году " + signed(o.apparel.volumeGrowth2025Pct, 1) +
      "% к 2024. Доли маркетплейса в данных нет: пока её нет, следующий выпуск не считается.";
    document.getElementById("jobPharmaFact").textContent =
      "По докладу доля своих " + fmt(M.FACTS.pharma.share2021, 1) + "% → " + fmt(M.FACTS.pharma.share2023, 1) +
      "%. Выпуск 2025 года вырос в " + fmt(o.pharmaVolume2025FactorOfficial, 1) +
      " раза. На долю рынка этот ползунок сам не влияет.";
    var bridge = M.goldBridge(2024, 2025);
    document.getElementById("jobGoldFact").textContent =
      "Экспорт золота " + fmt(bridge.from.goldMln, 1) + " → " + fmt(bridge.to.goldMln, 1) +
      " млн долларов. На золото пришлось " + fmt(bridge.goldPartOfGoodsChangePct, 1) + "% падения товарного экспорта.";
    document.getElementById("jobBuildFact").textContent =
      "Объём стройки в 2025 году " + signed(o.constructionVolumeGrowth2025Pct, 1) +
      "%. Группа стройматериалов " + signed(o.materialsGrowth2025Pct, 1) +
      "%. Это один год, коэффициент из него не берётся.";
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
        cardLoop("demand", "Спрос внутри страны", signed(o.constructionVolumeGrowth2025Pct, 1) + "% стройка",
          "Переводы " + signed(o.remittancesGrowthPct[2025], 1) + "%, торговля " + signed(o.tradeVolumeGrowth2025Pct, 1) +
          "%, зарплата " + signed(o.realWageGrowth2025Pct, 1) + "%. Стройматериалы " + signed(o.materialsGrowth2025Pct, 1) +
          "%. Это один строительный цикл.") +
        cardLoop("budget", "Решение о деньгах", signed(budgetGrowth, 0) + "% бюджет",
          "Республиканский бюджет в инвестициях к 2024 году. Кредиты банков " + signed(creditGrowth, 0) +
          "%, иностранные кредиты " + signed(loanGrowth, 0) + "%. Это финансирование, не научный сдвиг.") +
        cardLoop("gold", "Золото и ВВП", signed(o.goldExportGrowth2025Pct, 1) + "% золото",
          "Товарный экспорт " + signed(o.goodsExportGrowth2025Pct, 1) + "%, ВВП " + signed(o.gdpRealGrowthPct[2025], 1) +
          "%, промышленность " + signed(o.industryVolumeGrowth2025Pct, 1) + "%. Заголовок ВВП этот разрыв не заменяет.") +
      "</div>" +
      technologyChart() +
      "<div class='card'><h2>Доля в экономике — не объём выпуска</h2>" +
      "<p>Сельское хозяйство: доля ВВП " + fmt(o.gdpShares.agriculture[2021], 1) + "% в 2021 году → " +
      fmt(o.gdpShares.agriculture[2025], 1) + "% в 2025-м. Физический объём за те же годы примерно " + signed(agriVolume, 0) +
      "%. Сжался вес сектора в общем итоге, не сам выпуск. Решение принимают по выпуску.</p></div>" +
      "<details class='fold'><summary>Доли и добавленная стоимость по секторам</summary>" +
      "<p class='small muted'>Добавленная стоимость в текущих ценах — это доля × ВВП. Следствие двух рядов Нацстаткома, не отдельная публикация выпуска.</p>" +
      "<table><thead><tr><th>Сектор</th><th class='num'>Доля 2021</th><th class='num'>Доля 2025</th><th class='num'>ВДС 2021, млрд</th><th class='num'>ВДС 2025, млрд</th></tr></thead><tbody>" +
      sectorRows + "</tbody></table></details>" +
      "<details class='fold'><summary>Кто дал деньги и куда сел кредит</summary>" +
      "<div class='grid two'><div><h2>Кто финансировал инвестиции</h2>" +
      "<p class='small muted'>Доля источника, %. Серая полоса — 2021, синяя — 2025. Средства населения к 2024: " + signed(householdGrowth, 1) + "%.</p>" +
      sourceBars + "</div>" +
      "<div><h2>Кредит идёт людям и торговле</h2>" +
      "<p class='kpi'>" + fmt(o.credit2025MlnSom / 1000, 1) + "</p>" +
      "<p class='small muted'>млрд сомов на конец 2025 года. Около " +
      fmt(o.credit2025SharesPct.consumer, 0) + "% — людям, " + fmt(o.credit2025SharesPct.trade, 0) +
      "% — торговле, " + fmt(o.credit2025SharesPct.mortgage, 0) + "% — ипотеке, " +
      fmt(o.credit2025SharesPct.agriculture, 1) + "% — сельскому хозяйству.</p>" +
      "<div class='callout warn'><p>В таблице инвестиций по видам деятельности за 2025 год не распределено " +
      bln(residual) + " сомов (" + fmt(residualShare, 0) + "%). Строка «строительство» там — капитал строительных организаций, не объём стройки. Остаток жильём не подписан: такой строки нет.</p></div>" +
      "<p class='small muted'>Курс на конец 2025 года " + fmt(o.usdKgsEnd2025, 2) + " сома за доллар, " +
      signed(o.usdKgsEnd2025ChangePct, 1) + "% к концу 2024.</p></div></div></details>" +
      "<details class='fold'><summary>Балл важности темы — это не прогноз</summary>" +
      "<p class='small muted'>Балл сложен из критериев доклада. Он говорит, что важно запланировать. На место недостающего коэффициента он не ставится.</p>" +
      "<table><thead><tr><th>ID</th><th>Тема</th><th class='num'>Балл</th><th>Что из этого следует для прогноза</th></tr></thead><tbody>" +
      gapRows + "</tbody></table></details>";
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
    return "<div class='card'><h2>Рост технологических процессов, %</h2>" + rows + "</div>";
  }

  function cardLoop(kind, title, kpi, text) {
    return "<div class='card'><span class='tag " + kind + "'>" + esc(title) + "</span><div class='kpi'>" +
      esc(kpi) + "</div><p class='small'>" + esc(text) + "</p></div>";
  }

  function paintWorked() {
    var pharma = M.workedPharma();
    var apparel = M.workedApparel();
    var closed = apparel.closed.response;
    var open = apparel.open.response;
    var p = pharma.input;
    var a = apparel.input;
    document.getElementById("worked").innerHTML =
      "<div class='card'><h2>Как считается ответ</h2>" +
      "<p><strong>Цифры в этом блоке примерные и только для расчёта.</strong> Это не данные Нацстаткома. Свои числа вводятся на вкладках «Швейка» и «Лекарства».</p>" +
      "<div class='grid two'>" +
        "<div class='node live'><strong>Швейка: четыре числа сошлись</strong>" +
        "<p class='small'>" + fmt(a.channelSharePct, 0) + "% выпуска шло через канал, потеряна " + fmt(a.lossPct, 0) +
        "% этого канала. Под ударом " + fmt(closed.exposedPct, 0) + "% выпуска. Из потери " + fmt(a.redirectPct, 0) +
        "% ушло другому покупателю, " + fmt(a.stockPct, 0) + "% легло в запас, остальное режет пошив.</p>" +
        "<p class='kpi'>" + fmt(closed.outputIndex, 0) + "</p>" +
        "<p class='small'>индекс выпуска. Продажи " + fmt(closed.salesIndex, 0) + ". В запас " + fmt(closed.inventoryPct, 0) + "% базы.</p>" +
        "<button type='button' class='action' id='useApparelExample'>Подставить этот пример в швейку</button></div>" +
        "<div class='node stop'><strong>Те же потери, раскладка пустая</strong>" +
        "<p class='small'>Под ударом те же " + fmt(open.exposedPct, 0) + "%, но не сказано, сколько ушло другому покупателю и сколько легло в запас.</p>" +
        "<p class='kpi'>нет ответа</p>" +
        "<p class='small'>Индекс выпуска не считается. Если резать пошив один к одному, потолок " + fmt(open.ceilingIndex, 0) + ". Это не прогноз.</p>" +
        "<p class='small'>Кредит в сомах сам по себе индекс тоже не двигает: нет числа «сколько пошива даёт один сом».</p></div>" +
      "</div>" +
      "<div class='node wait'><strong>Лекарства: связь задаётся отдельным числом</strong>" +
      "<p class='small'>Доля своих была " + fmt(p.baseShare, 1) + "%. В примере переработку подняли с " + fmt(p.processingBase, 0) +
      "% до " + fmt(p.processingNow, 0) + "%. Один пункт переработки даёт " + fmt(p.k, 1) + " пункта доли.</p>" +
      "<p class='small'>" + fmt(p.baseShare, 1) + " + " + fmt(p.k, 1) + " × (" + fmt(p.processingNow, 0) + " − " + fmt(p.processingBase, 0) +
      ") = <strong>" + fmt(pharma.share, 1) + "%</strong>. Если это число не указано, доля своих остаётся " + fmt(p.baseShare, 1) +
      "%. Сырьё без обработки при этом всё равно меняется: " + fmt(pharma.rawBefore, 0) + "% → " + fmt(pharma.rawAfter, 0) +
      "%, потому что это 100 минус переработка.</p>" +
      "<button type='button' class='action' id='usePharmaExample'>Подставить этот пример в лекарства</button></div></div>";
    document.getElementById("useApparelExample").addEventListener("click", function () {
      applyApparel(true);
      showTab("sector");
      window.scrollTo(0, 0);
    });
    document.getElementById("usePharmaExample").addEventListener("click", function () {
      applyPharmaExample(true);
      showTab("pharma");
      window.scrollTo(0, 0);
    });
  }

  function applyApparel(example) {
    var sample = M.ILLUSTRATION.apparel;
    var values = {
      apparelChannel: example ? String(sample.channelSharePct) : "",
      apparelLoss: example ? String(sample.lossPct) : "",
      apparelRedirect: example ? String(sample.redirectPct) : "",
      apparelStock: example ? String(sample.stockPct) : ""
    };
    Object.keys(values).forEach(function (id) {
      state[id] = values[id];
      var input = document.getElementById(id);
      if (input) input.value = values[id];
    });
    fillSector();
    saveState();
  }

  function applyPharmaExample(example) {
    var sample = M.ILLUSTRATION.pharma;
    state.processing = example ? sample.processingNow : M.FACTS.pharma.localProcessingMid;
    state.k = example ? String(sample.k) : "";
    var processing = document.getElementById("processing");
    var kInput = document.getElementById("kInput");
    if (processing) processing.value = state.processing;
    if (kInput) kInput.value = state.k;
    fillPharma();
    saveState();
  }

  function paintSector() {
    var a = M.OBSERVED.apparel;
    var exportMln = a.textileClothingExportThsUsd / 1000;
    var exportDrop = 100 - a.textileClothingExportValueIndex;
    document.getElementById("sector").innerHTML =
      "<div class='split'>" +
        "<div class='card'>" +
          "<h2>Четыре числа</h2>" +
          "<p class='small'>База — физический объём одежды за 2025 год, он равен 100. Темп " + signed(a.volumeGrowth2025Pct, 1) +
          "% к 2024 уже случился и на следующий год сам не переносится. Доли маркетплейса в бюллетене Нацстаткома нет.</p>" +
          "<div class='node wait' id='nodeChannel'><strong>1. Какая доля выпуска шла через маркетплейсы, %</strong>" +
          "<input id='apparelChannel' type='text' inputmode='decimal' placeholder='в данных нет'></div>" +
          "<div class='node wait' id='nodeLoss'><strong>2. Какая часть этого канала потеряна, %</strong>" +
          "<input id='apparelLoss' type='text' inputmode='decimal' placeholder='отменённые заказы и товар на складе'></div>" +
          "<div class='node wait' id='nodeExposed'><strong>Сколько выпуска задето</strong><p class='small' id='exposedText'>Доля канала × доля потерь.</p></div>" +
          "<div class='node wait' id='nodeRedirect'><strong>3. Другой покупатель, % от потери</strong>" +
          "<input id='apparelRedirect' type='text' inputmode='decimal' placeholder='пусто — ответ не считается'>" +
          "<p class='small muted'>Прямой контракт, другая страна, внутренний заказ.</p></div>" +
          "<div class='node wait' id='nodeStock'><strong>4. Запас, % от потери</strong>" +
          "<input id='apparelStock' type='text' inputmode='decimal' placeholder='пусто — ответ не считается'>" +
          "<p class='small muted'>Цех шьёт, продажа не состоялась. Вместе с пунктом 3 не больше 100%.</p></div>" +
          "<div class='actions'>" +
            "<button type='button' class='action' id='btnApparelExample'>Учебный пример</button>" +
            "<button type='button' class='action' id='btnApparelClear'>Очистить</button>" +
          "</div>" +
          "<p class='small' id='exampleNote' hidden>В полях учебный пример: 40, 50, 25 и 25. Это не факт.</p>" +
        "</div>" +
        "<div class='card answer'>" +
          "<p class='flow-label'>Ответ</p>" +
          "<p class='kpi' id='outputHeadline'>—</p>" +
          "<p class='small muted' id='outputCaption'>индекс выпуска к физическому объёму 2025 года</p>" +
          "<div class='node wait' id='nodeOutput'><strong>Выпуск</strong><p class='small' id='outputText'>Считается, когда четыре числа сойдутся.</p></div>" +
          "<div class='node wait' id='nodeSales'><strong>Продажи</strong><p class='small' id='salesText'>Запас в продажи не возвращается.</p></div>" +
          "<div class='node wait' id='nodeCut'><strong>Что режет пошив</strong><p class='small' id='cutText'>Остаток потери: 100 − покупатель − запас.</p></div>" +
          "<div class='node wait' id='nodeConclusion'><strong>Вывод</strong><p class='small' id='conclusionText'></p></div>" +
          "<div class='node wait' id='nodeMeasures'><strong>Что делать</strong><ul class='small' id='measureList'></ul></div>" +
          "<div class='node stop' id='nodeScore'><strong>Балл важности текстиля</strong><p class='small' id='scoreArrow'>На индекс выпуска не влияет.</p></div>" +
          "<div class='sr-arrows' aria-hidden='true'><div class='flow-arrow' id='arrowSplit'><span></span></div><div class='flow-arrow' id='arrowOut'><span></span></div></div>" +
        "</div>" +
      "</div>" +
      "<details class='fold'><summary>Что уже опубликовано по одежде</summary>" +
        "<div class='node live'><strong>Группа текстиль, одежда, обувь, кожа</strong><p class='small'>" + fmt(a.groupValue2025MlnSom, 0) +
        " млн сомов, " + signed(a.groupVolumeGrowth2025Pct, 1) + "%, " + fmt(a.groupShareOfManufacturingPct, 1) + "% обработки.</p></div>" +
        "<div class='node live'><strong>Экспорт «одежда текстильная», январь–ноябрь 2025</strong><p class='small'>" + fmt(exportMln, 1) +
        " млн долларов, индекс стоимости " + fmt(a.textileClothingExportValueIndex, 1) + " (" + signed(-exportDrop, 1) + "%).</p></div>" +
        "<div class='node live'><strong>В Россию — это страна, не площадка</strong><p class='small'>Одежда и принадлежности: " + fmt(a.russiaClothingAccessoriesMlnUsd, 1) +
        " млн долларов. Доли Wildberries и Ozon в бюллетене нет.</p></div>" +
        "<div class='node live'><strong>Внутри одежды ряды разные</strong><p class='small'>Верхняя мужская " + fmt(a.mensOuterwearThsPcs, 0) +
        " тыс. шт., индекс " + fmt(a.mensOuterwearIndex, 1) + ". Женская " + fmt(a.womensOuterwearThsPcs, 0) +
        " тыс. шт., индекс " + fmt(a.womensOuterwearIndex, 1) + ". Нижнее бельё " + fmt(a.underwearThsPcs, 0) +
        " тыс. шт., индекс " + fmt(a.underwearIndex, 1) + ".</p></div>" +
      "</details>" +
      "<p class='eq'>задето, % выпуска = доля канала × доля потерь / 100<br>индекс выпуска = 100 − задето × (100 − покупатель − запас) / 100<br>индекс продаж = 100 − задето × (100 − покупатель) / 100</p>";
    ["apparelChannel", "apparelLoss", "apparelRedirect", "apparelStock"].forEach(function (id) {
      var input = document.getElementById(id);
      input.value = state[id];
      input.addEventListener("input", function () {
        state[id] = input.value;
        fillSector();
        saveState();
      });
    });
    document.getElementById("btnApparelExample").addEventListener("click", function () { applyApparel(true); });
    document.getElementById("btnApparelClear").addEventListener("click", function () { applyApparel(false); });
  }

  function markNode(id, mode) {
    var node = document.getElementById(id);
    node.classList.remove("live", "wait", "stop");
    node.classList.add(mode);
  }

  function fillSector() {
    var channel = numOrNull(state.apparelChannel);
    var loss = numOrNull(state.apparelLoss);
    var redirect = numOrNull(state.apparelRedirect);
    var stock = numOrNull(state.apparelStock);
    var reading = M.sectorReading({
      channelSharePct: channel,
      lossPct: loss,
      redirectPct: redirect,
      stockPct: stock
    });
    var response = reading.response;
    markNode("nodeChannel", channel == null ? "wait" : "live");
    markNode("nodeLoss", loss == null ? "wait" : "live");
    markNode("nodeExposed", response.exposedPct == null ? "wait" : "live");
    markNode("nodeRedirect", redirect == null ? "wait" : "live");
    markNode("nodeStock", stock == null ? "wait" : "live");
    var cutMode = response.passThrough == null ? "wait" : (response.passThrough > 0 ? "stop" : "live");
    markNode("nodeCut", cutMode);
    markNode("nodeOutput", response.outputIndex == null ? "wait" : "live");
    markNode("nodeSales", response.salesIndex == null ? "wait" : "live");
    markNode("nodeConclusion", reading.stage === "closed" || reading.stage === "none" ? "live" : (reading.stage === "broken" ? "stop" : "wait"));
    markNode("nodeMeasures", reading.stage === "channel" || reading.stage === "split" ? "wait" : "live");
    document.getElementById("arrowSplit").classList.toggle("on", response.exposedPct != null);
    document.getElementById("arrowOut").classList.toggle("on", reading.stage === "closed" || reading.stage === "none");
    document.getElementById("exposedText").textContent = response.exposedPct == null
      ? "Доля канала × доля потерь."
      : fmt(response.exposedPct, 1) + "% выпуска 2025 года стоит на задетом канале.";
    document.getElementById("cutText").textContent = response.passThrough == null
      ? "Остаток потери: 100 − покупатель − запас."
      : fmt(response.passThrough * 100, 1) + "% потерянных продаж режет пошив.";
    document.getElementById("outputText").textContent = response.outputIndex == null
      ? (response.ceilingIndex == null
        ? "Считается, когда раскладка сходится."
        : "Пока пусто. Потолок при полном сокращении пошива: " + fmt(response.ceilingIndex, 1) + ".")
      : fmt(response.outputIndex, 1) + " к физическому объёму 2025 года.";
    document.getElementById("salesText").textContent = response.salesIndex == null
      ? "Запас в продажи не возвращается."
      : fmt(response.salesIndex, 1) + ". В запас уходит " + fmt(response.inventoryPct, 1) + "% базового выпуска.";
    var headline = "Ждёт числа";
    var caption = "индекс выпуска появится, когда четыре числа сойдутся";
    if (reading.stage === "closed") {
      headline = fmt(response.outputIndex, 1);
      caption = "индекс выпуска к физическому объёму 2025 года";
    } else if (reading.stage === "none") {
      headline = "100";
      caption = "индекс выпуска остаётся на уровне 2025 года";
    } else if (reading.stage === "broken") {
      headline = "Не сходится";
    } else if (reading.stage === "split") {
      headline = "Не считается";
    }
    document.getElementById("outputHeadline").textContent = headline;
    document.getElementById("outputCaption").textContent = caption;
    var exampleNote = document.getElementById("exampleNote");
    var sample = M.ILLUSTRATION.apparel;
    exampleNote.hidden = !(
      numOrNull(state.apparelChannel) === sample.channelSharePct &&
      numOrNull(state.apparelLoss) === sample.lossPct &&
      numOrNull(state.apparelRedirect) === sample.redirectPct &&
      numOrNull(state.apparelStock) === sample.stockPct
    );
    document.getElementById("conclusionText").textContent = reading.conclusion;
    document.getElementById("measureList").innerHTML = reading.measures.map(function (item) {
      return "<li>" + esc(item) + "</li>";
    }).join("");
    var gap = M.GAPS.find(function (item) { return item.id === "№7"; });
    document.getElementById("scoreArrow").textContent =
      "Стрелка обрывается. Балл " + M.planScore(gap) + " индекс выпуска не меняет.";
  }

  function paintPharma() {
    document.getElementById("pharma").innerHTML =
      "<div class='split'>" +
        "<div class='card'><h2>Два числа</h2>" +
        "<p class='small'>Факт доклада: доля своих лекарств в 2023 году 2,0%, локальная переработка около 6% (середина диапазона 5–7%). Ползунок ниже меняет переработку. Доля на рынке сдвигается только если указано, сколько пунктов доли даёт один пункт переработки.</p>" +
        "<label for='processing'>Локальная переработка сырья, %</label>" +
        "<input id='processing' type='range' min='0' max='40' step='0.5'>" +
        "<p id='processingText'></p>" +
        "<label for='kInput'>Сколько пунктов доли своих даёт 1 пункт переработки</label>" +
        "<input id='kInput' type='text' inputmode='decimal' placeholder='неизвестно — оставьте пустым'>" +
        "<div class='actions'>" +
          "<button type='button' class='action' id='pharmaExample'>Учебный пример</button>" +
          "<button type='button' class='action' id='pharmaFact'>Вернуть факт доклада</button>" +
        "</div>" +
        "<p class='small' id='pharmaExampleNote'></p>" +
        "<p class='eq'>сырьё без обработки = 100 − переработка<br>доля своих = 2,0 + коэффициент × (переработка − 6)</p></div>" +
        "<div class='card answer'><p class='flow-label'>Ответ</p>" +
        "<p class='kpi' id='pharmaAnswer'>—</p>" +
        "<p class='small muted'>доля своих готовых лекарств</p>" +
        "<p id='pharmaAnswerText'></p>" +
        "<div id='closure' class='callout'></div></div>" +
      "</div>" +
      "<div class='grid two'><div class='card'><h2>Стоимость выпуска, млн сомов</h2>" +
      "<p class='small muted'>Нацстатком. Ряд обрывается на 2024 годе.</p><div id='valueBars'></div>" +
      "<p class='small' id='priceNote'></p>" +
      "<p class='small muted' id='volume2025'></p></div>" +
      "<div class='card'><h2>Рынок готовых лекарств по докладу</h2>" +
      "<p class='small muted'>" + esc(M.FACTS.pharma.finishedExportAssumption) + "</p>" +
      "<table><thead><tr><th></th><th class='num'>2021</th><th class='num'>2023</th></tr></thead><tbody id='marketRows'></tbody></table>" +
      "<p class='small' id='marketNote'></p></div></div>" +
      "<details class='fold'><summary>Проверка для аналитика: балл и новый факт</summary>" +
      "<div class='card'><h2>Балл важности этот ответ не двигает</h2>" +
      "<label for='persistence'>Какая доля прошлого уровня остаётся, если ничего не названо</label>" +
      "<input id='persistence' type='range' min='0' max='1' step='0.05'>" +
      "<p class='small' id='behaviorText'></p>" +
      "<div class='grid two'><div><label for='prod'>Производительность, от 1 до 5</label>" +
      "<input id='prod' type='range' min='1' max='5' step='1'></div>" +
      "<div><label for='res'>Экономия сырья и энергии, от 1 до 5</label>" +
      "<input id='res' type='range' min='1' max='5' step='1'></div></div>" +
      "<p id='scoreText'></p></div>" +
      "<div class='card'><h2>Когда придёт новый факт, коэффициент пересчитается</h2>" +
      "<div class='grid two'><div><label for='factShare'>Новая доля своих, %</label>" +
      "<input id='factShare' type='text' inputmode='decimal' placeholder='ещё нет'></div>" +
      "<div><label for='factImport'>Новый импорт, млн сомов</label>" +
      "<input id='factImport' type='text' inputmode='decimal' placeholder='необязательно'></div></div>" +
      "<div id='errorBlock'></div>" +
      "<p class='small muted'>После 2023 года доли рынка лекарств в этом наборе нет. Пустое поле — честное состояние, не ноль.</p></div></details>";
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
    document.getElementById("pharmaExample").addEventListener("click", function () { applyPharmaExample(true); });
    document.getElementById("pharmaFact").addEventListener("click", function () { applyPharmaExample(false); });
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

    var illustrated = processing === M.ILLUSTRATION.pharma.processingNow && k === M.ILLUSTRATION.pharma.k;
    var closure = scenario == null
      ? "Связь не задана: переработка сырья не двигает долю своих лекарств."
      : "Связь введена вручную, коэффициент " + fmt(k, 2) + ". Это не оценка по ряду, пока на его месте не окажется факт.";

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
    document.getElementById("pharmaAnswer").textContent = fmt(scenario == null ? baseShare : scenario, 1) + "%";
    document.getElementById("pharmaAnswerText").textContent = scenario == null
      ? "Доля своих остаётся " + fmt(baseShare, 1) + "%. Ползунок меняет только сырьё: без обработки уходит " +
        fmt(exportShare, 1) + "%."
      : (illustrated
        ? "Учебный расчёт: " + fmt(baseShare, 1) + " + " + fmt(k, 1) + " × (" + fmt(processing, 0) + " − " +
          fmt(M.FACTS.pharma.localProcessingMid, 0) + "). В прогноз его ставить нельзя, пока коэффициент не взят из нового факта."
        : "Доля своих при введённом коэффициенте. Это не оценка Нацстаткома, пока коэффициент не подтверждён новым фактом.");
    document.getElementById("pharmaExampleNote").textContent = illustrated
      ? "Сейчас в полях учебный пример: переработка 16% и коэффициент 0,2. Это не данные Нацстаткома."
      : "";
    document.getElementById("behaviorText").textContent =
      "Если ничего нового не названо, доля " + fmt(inertialShare, 2) + "%. При потреблении 2023 года (" +
      fmt(consumption, 0) + " млн сомов) импорт в этом случае " + fmt(inertialMarket.importMln, 0) + " млн" +
      (scenarioMarket ? ", при введённом коэффициенте " + fmt(scenarioMarket.importMln, 0) + " млн." : ".");
    var closureNode = document.getElementById("closure");
    closureNode.className = "callout " + (scenario == null ? "crit" : "warn");
    closureNode.textContent = closure;
    document.getElementById("scoreText").textContent =
      "Балл важности: " + plan + ". Доля, если ничего не названо, остаётся " + fmt(inertialShare, 2) +
      "%. Сдвиньте оба ползунка — доля не изменится.";
    document.getElementById("errorBlock").innerHTML = errorBlock;
  }

  function paintMethod() {
    var steps = M.STEPS.map(function (step) {
      return "<li><strong>" + esc(step.title) + ".</strong> " + esc(step.text) + "</li>";
    }).join("");
    var statusLabel = { missing: "Без этого расчёт стоит", one_year: "Есть только один год", observed: "Ряд есть" };
    var coeffs = M.COEFFICIENTS.map(function (c) {
      return "<tr><td>" + esc(c.name) + "<div class='small muted'>" + esc(c.closes) + "</div></td>" +
        "<td><span class='tag " + c.status + "'>" + esc(statusLabel[c.status] || c.status) + "</span></td></tr>";
    }).join("");
    document.getElementById("method").innerHTML =
      "<div class='card callout'><p>Прогноз здесь считается двумя способами: повторить последний опубликованный факт или умножить названное изменение на коэффициент. Пустой коэффициент — не ноль. Балл важности темы на его место не ставится.</p></div>" +
      "<div class='card'><h2>Чего не хватает</h2>" +
      "<table><thead><tr><th>Какое число нужно</th><th>Состояние</th></tr></thead><tbody>" + coeffs + "</tbody></table></div>" +
      "<details class='fold'><summary>Если стройка пойдёт другим темпом</summary>" +
      "<p class='small'>Стройматериалы в 2025 году двигались вместе со стройкой. Ползунок растягивает ту же пропорцию. Один год не доказывает, что так будет всегда.</p>" +
      "<label for='construction'>Объём строительства, % к предыдущему году</label>" +
      "<input id='construction' type='range' min='-10' max='40' step='0.1'>" +
      "<p id='constructionText'></p>" +
      "<table><thead><tr><th>Технология</th><th class='num'>Факт 2025</th><th class='num'>При этом темпе</th></tr></thead><tbody id='linkedRows'></tbody></table></details>" +
      "<details class='fold'><summary>Семь правил метода</summary><ol class='steps'>" + steps + "</ol></details>" +
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
      var other = document.getElementById("constructionBuild");
      if (other) other.value = state.construction;
      fillBuild();
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

  function paintGold() {
    document.getElementById("gold").innerHTML =
      "<div class='split'>" +
        "<div class='card'><h2>Два года, которые есть в ряде</h2>" +
        "<p class='small'>Нацбанк, экспорт в млн долларов. «Без золота» — это товарный экспорт минус золото, следствие, не отдельная публикация.</p>" +
        "<table><thead><tr><th></th><th class='num'>2024</th><th class='num'>2025</th></tr></thead><tbody id='goldRows'></tbody></table>" +
        "<p class='small' id='goldLevels'></p></div>" +
        "<div class='card answer'><p class='flow-label'>Что ряд уже объясняет</p>" +
        "<p class='kpi' id='goldHeadline'>—</p>" +
        "<p class='small muted' id='goldCaption'></p>" +
        "<div class='node live' id='goldSplit'><strong>Куда делось падение экспорта</strong><p class='small' id='goldSplitText'></p></div>" +
        "<div class='node stop'><strong>Добыча — другой ряд</strong><p class='small' id='goldMining'></p></div>" +
        "<div class='node stop'><strong>ВВП от золота не пересчитывается</strong><p class='small' id='goldGdp'></p></div></div>" +
      "</div>" +
      "<div class='card'><h2>Если золото будет другим</h2>" +
      "<p class='small'>Остальной экспорт держится на последнем факте. Товарный экспорт сдвигается сам: это сумма. Темп ВВП сдвигается только если названо, сколько процентных пунктов даёт один миллион долларов.</p>" +
      "<div class='grid two'>" +
        "<div><label for='goldNow'>Экспорт золота, млн долларов</label>" +
        "<input id='goldNow' type='text' inputmode='decimal' placeholder='пусто — факт 2025 года'></div>" +
        "<div><label for='goldK'>П.п. темпа ВВП на 1 млн долларов золота</label>" +
        "<input id='goldK' type='text' inputmode='decimal' placeholder='нет в данных'></div>" +
      "</div>" +
      "<p id='goldScenarioText'></p>" +
      "<p class='small' id='goldGdpText'></p>" +
      "<button type='button' class='action' id='goldReset'>Вернуть факт</button></div>";
    ["goldNow", "goldK"].forEach(function (id) {
      var input = document.getElementById(id);
      var key = id === "goldNow" ? "goldNow" : "goldK";
      input.value = state[key];
      input.addEventListener("input", function () {
        state[key] = input.value;
        fillGold();
        saveState();
      });
    });
    document.getElementById("goldReset").addEventListener("click", function () {
      state.goldNow = "";
      state.goldK = "";
      document.getElementById("goldNow").value = "";
      document.getElementById("goldK").value = "";
      fillGold();
      saveState();
    });
  }

  function fillGold() {
    var o = M.OBSERVED;
    var bridge = M.goldBridge(2024, 2025);
    var from = bridge.from;
    var to = bridge.to;
    document.getElementById("goldRows").innerHTML =
      "<tr><td>Золото</td><td class='num'>" + fmt(from.goldMln, 1) + "</td><td class='num'>" + fmt(to.goldMln, 1) + "</td></tr>" +
      "<tr><td>Без золота, следствие</td><td class='num'>" + fmt(from.otherMln, 1) + "</td><td class='num'>" + fmt(to.otherMln, 1) + "</td></tr>" +
      "<tr><td>Весь товарный экспорт</td><td class='num'>" + fmt(from.goodsMln, 1) + "</td><td class='num'>" + fmt(to.goodsMln, 1) + "</td></tr>" +
      "<tr><td>Доля золота, %</td><td class='num'>" + fmt(from.goldSharePct, 1) + "</td><td class='num'>" + fmt(to.goldSharePct, 1) + "</td></tr>";
    document.getElementById("goldHeadline").textContent = fmt(bridge.goldPartOfGoodsChangePct, 1) + "%";
    document.getElementById("goldCaption").textContent = "падения товарного экспорта в долларах пришлось на золото";
    document.getElementById("goldSplitText").textContent =
      "Золото " + signed(bridge.deltaGold, 1) + " млн, остальной экспорт " + signed(bridge.deltaOther, 1) +
      " млн, вместе " + signed(bridge.deltaGoods, 1) + " млн. Это арифметика двух уровней, не причина спада внутри страны.";
    document.getElementById("goldLevels").textContent =
      "По двум уровням золото изменилось на " + signed(bridge.levelGoldGrowthPct, 1) +
      "% (опубликованный темп " + signed(bridge.publishedGoldGrowthPct, 1) +
      "%). Товарный экспорт по этим же уровням " + signed(bridge.levelGoodsGrowthPct, 1) +
      "%. В ряде Нацбанка темп товарного экспорта указан как " + signed(bridge.publishedGoodsGrowthPct, 1) +
      "%. Одно число другим не заменяется.";
    document.getElementById("goldMining").textContent =
      "Физический объём добычи в 2025 году " + signed(o.miningGrowth2025Pct, 1) +
      "%. Это не доллары экспорта золота и не подставляется вместо них.";
    document.getElementById("goldGdp").textContent =
      "Реальный ВВП " + signed(o.gdpRealGrowthPct[2025], 1) + "%, промышленность " + signed(o.industryVolumeGrowth2025Pct, 1) +
      "%, курс на конец года " + signed(o.usdKgsEnd2025ChangePct, 1) +
      "%. Коэффициента «миллион долларов золота → эти ряды» нет. Металлургия — около 62% обработки в докладе за один год, это не ряд экспорта.";
    var scenario = M.goldScenario(numOrNull(state.goldNow), numOrNull(state.goldK));
    document.getElementById("goldScenarioText").textContent = scenario.goodsMln == null
      ? "Товарный экспорт остаётся фактом 2025 года: " + fmt(to.goodsMln, 1) + " млн долларов. Остальной экспорт " + fmt(to.otherMln, 1) + " млн."
      : "Товарный экспорт станет " + fmt(scenario.goodsMln, 1) + " млн: золото " + fmt(scenario.goldMln, 1) +
        " плюс остальной экспорт " + fmt(scenario.otherMln, 1) + ". Доля золота " + fmt(scenario.goldSharePct, 1) +
        "%. Сдвиг золота к факту 2025 года: " + signed(scenario.deltaGold, 1) + " млн.";
    document.getElementById("goldGdpText").textContent = scenario.gdpShiftPp == null
      ? "Сдвиг темпа ВВП не считается: коэффициент пуст. Пустое поле — не ноль."
      : "При введённом коэффициенте сдвиг темпа ВВП " + signed(scenario.gdpShiftPp, 2) +
        " п.п. Это не оценка Нацбанка и не продолжение темпа " + signed(o.gdpRealGrowthPct[2025], 1) + "%.";
  }

  function paintBuild() {
    document.getElementById("build").innerHTML =
      "<div class='split'>" +
        "<div class='card'><h2>Что видно по циклу в 2025 году</h2>" +
        "<p class='small'>Числа одного года стоят рядом. Из одного года коэффициент «переводы → стройка» не оценивается.</p>" +
        "<div class='node live'><strong>Переводы</strong><p class='small' id='cycleRemit'></p></div>" +
        "<div class='node live'><strong>Зарплата и торговля</strong><p class='small' id='cycleWage'></p></div>" +
        "<div class='node live'><strong>Средства населения в инвестициях</strong><p class='small' id='cycleHouseholds'></p></div>" +
        "<div class='node stop'><strong>Бюджет — отдельное решение</strong><p class='small' id='cycleBudget'></p></div>" +
        "<div class='node live'><strong>Объём стройки</strong><p class='small' id='cycleVolume'></p></div>" +
        "<p class='small' id='cycleShare'></p></div>" +
        "<div class='card answer'><p class='flow-label'>Индекс объёма стройки</p>" +
        "<p class='kpi' id='cycleHeadline'>100</p>" +
        "<p class='small muted' id='cycleCaption'></p>" +
        "<p id='cycleAnswer'></p>" +
        "<label for='cycleRemittances'>Темп переводов, %</label>" +
        "<input id='cycleRemittances' type='text' inputmode='decimal' placeholder='пусто — объём не двигается'>" +
        "<label for='cycleK'>П.п. объёма стройки на 1 п.п. темпа переводов</label>" +
        "<input id='cycleK' type='text' inputmode='decimal' placeholder='нет в данных'>" +
        "<p class='small'>База коэффициента — темп переводов 2025 года. Индекс 100 — это последний физический объём, не повтор +21,1%.</p></div>" +
      "</div>" +
      "<div class='split'>" +
        "<div class='card'><h2>Стройматериалы едут за темпом стройки</h2>" +
        "<p class='small'>Пропорция 2025 года: темп группы делится на темп стройки. Один год — не закон. Резина отдельно и группа «резина, пластмасса и стройматериалы» — разные строки.</p>" +
        "<label for='constructionBuild'>Объём строительства, % к предыдущему году</label>" +
        "<input id='constructionBuild' type='range' min='-10' max='40' step='0.1'>" +
        "<p id='materialsNote'></p>" +
        "<table><thead><tr><th>Строка</th><th class='num'>Факт 2025</th><th class='num'>При этом темпе</th></tr></thead><tbody id='materialsRows'></tbody></table></div>" +
        "<div class='card answer'><p class='flow-label'>Группа материалов</p>" +
        "<p class='kpi' id='materialsHeadline'>—</p>" +
        "<p class='small muted'>резина, пластмасса и стройматериалы, %</p>" +
        "<p id='materialsRatio'></p>" +
        "<div class='node live'><strong>Рядом, но это не та же строка</strong><ul class='small' id='materialsParts'></ul></div></div>" +
      "</div>";
    document.getElementById("constructionBuild").value = state.construction;
    document.getElementById("constructionBuild").addEventListener("input", function (event) {
      state.construction = event.target.value;
      var other = document.getElementById("construction");
      if (other) other.value = state.construction;
      fillBuild();
      fillMethod();
      saveState();
    });
    ["cycleRemittances", "cycleK"].forEach(function (id) {
      var input = document.getElementById(id);
      input.value = state[id];
      input.addEventListener("input", function () {
        state[id] = input.value;
        fillBuild();
        saveState();
      });
    });
  }

  function fillBuild() {
    var o = M.OBSERVED;
    var household = M.sourceGrowth("households", 2024, 2025);
    var budget = M.sourceGrowth("republicanBudget", 2024, 2025);
    var cycle = M.constructionCycleScenario(numOrNull(state.cycleRemittances), numOrNull(state.cycleK));
    var growth = Number(state.construction);
    var linked = M.constructionProportion(growth);
    var ratio = M.constructionMaterialsRatio();
    var linkedNames = {};
    o.linkedToConstruction.forEach(function (row) { linkedNames[row.process] = true; });
    var parts = M.constructionComponentFacts().filter(function (row) { return !linkedNames[row.process]; });
    var va2021 = M.nominalVa(2021, "construction") / 1000;
    var va2025 = M.nominalVa(2025, "construction") / 1000;
    document.getElementById("cycleRemit").textContent =
      fmt(o.remittancesNetMlnUsd[2025], 1) + " млн долларов, " + signed(o.remittancesGrowthPct[2025], 1) + "% к 2024.";
    document.getElementById("cycleWage").textContent =
      "Реальная зарплата " + signed(o.realWageGrowth2025Pct, 1) + "%. Оборот торговли " + signed(o.tradeVolumeGrowth2025Pct, 1) + "%.";
    document.getElementById("cycleHouseholds").textContent =
      signed(household, 1) + "% к 2024 году. Это деньги семей в инвестициях, не объём стройки.";
    document.getElementById("cycleBudget").textContent =
      "Республиканский бюджет в инвестициях " + signed(budget, 0) +
      "% к 2024. Коэффициента к физическому объёму стройки нет, поэтому бюджет индекс не двигает.";
    document.getElementById("cycleVolume").textContent =
      signed(o.constructionVolumeGrowth2025Pct, 1) + "% к 2024. Стоимость продукции " + fmt(o.constructionValue2025Mln / 1000, 1) + " млрд сомов.";
    document.getElementById("cycleShare").textContent =
      "Доля стройки в ВВП " + fmt(o.gdpShares.construction[2021], 1) + "% → " + fmt(o.gdpShares.construction[2025], 1) +
      "%. Номинальная добавленная стоимость, следствие доли и ВВП: " + fmt(va2021, 1) + " → " + fmt(va2025, 1) +
      " млрд сомов. Физического объёма за 2021–2024 год в этом наборе нет, поэтому доля объёмом не считается.";
    document.getElementById("cycleHeadline").textContent = fmt(cycle.index, 1);
    document.getElementById("cycleCaption").textContent = cycle.growthPp == null
      ? "последний физический объём. Темп " + signed(o.constructionVolumeGrowth2025Pct, 1) + "% дальше сам не идёт."
      : "учебный сдвиг от темпа переводов. Это не оценка по ряду.";
    document.getElementById("cycleAnswer").textContent = cycle.growthPp == null
      ? "Индекс остаётся 100. Переводы, зарплата и бюджет сами объём не двигают, пока не назван коэффициент."
      : "Темп к уровню 2025 года: " + signed(cycle.growthPp, 1) +
        " п.п. Коэффициент введён вручную. Балл важности стройки в эту формулу не входит.";
    var group = linked[0];
    document.getElementById("materialsHeadline").textContent = fmt(group.scenarioPct, 1) + "%";
    document.getElementById("materialsNote").textContent =
      "Сейчас темп стройки " + fmt(growth, 1) + "%. Факт Нацстаткома — " + fmt(o.constructionVolumeGrowth2025Pct, 1) +
      "%." + (Math.abs(growth - o.constructionVolumeGrowth2025Pct) < 0.05
        ? " Таблица повторяет 2025 год."
        : " Строки растянуты пропорцией 2025 года. На следующий год она сама не переносится.");
    document.getElementById("materialsRows").innerHTML = linked.map(function (row) {
      return "<tr><td>" + esc(row.process) + "</td><td class='num'>" + fmt(row.factPct, 1) +
        "</td><td class='num'>" + fmt(row.scenarioPct, 1) + "</td></tr>";
    }).join("");
    document.getElementById("materialsRatio").textContent =
      "На один пункт стройки в 2025 году пришлось " + fmt(ratio[0].perPoint, 2) +
      " пункта группы материалов и " + fmt(ratio[1].perPoint, 2) +
      " пункта дерева и бумаги. Пока коэффициент строительного цикла пуст, из переводов эти темпы не выводятся.";
    document.getElementById("materialsParts").innerHTML = parts.map(function (row) {
      return "<li>" + esc(row.process) + ": " + signed(row.factPct, 1) + "%. Факт 2025 года, в пропорцию группы не входит.</li>";
    }).join("");
    var methodSlider = document.getElementById("construction");
    if (methodSlider && methodSlider.value !== String(state.construction)) methodSlider.value = state.construction;
  }

  render();
})();
