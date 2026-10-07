(function () {
  "use strict";

  var M = window.KtpModel;
  var O = M.OBSERVED;

  function fmt(n, d) {
    if (n == null || !isFinite(n)) return "—";
    return n.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function signed(n, d) { return (n > 0 ? "+" : "") + fmt(n, d); }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // ---------- Главное: три вывода ----------
  var agriVolume = (M.agriVolumeRatio2025to2021() - 1) * 100;
  var pharma = M.FACTS.pharma;

  var cards = [
    {
      tag: "demand",
      title: "Рост ВВП не описывает экспорт",
      big: signed(O.gdpRealGrowthPct[2025], 1) + "% ВВП при " + signed(O.goldExportGrowth2025Pct, 1) + "% экспорта золота",
      fact: "ВВП 2025 года вырос на " + fmt(O.gdpRealGrowthPct[2025], 1) + "%. Экспорт золота упал с " + fmt(O.goldExportMlnUsd[2024], 1) +
        " до " + fmt(O.goldExportMlnUsd[2025], 1) + " млн долларов, весь товарный экспорт снизился на " + fmt(Math.abs(O.goodsExportGrowth2025Pct), 1) + "%. Промышленность при этом выросла на " + fmt(O.industryVolumeGrowth2025Pct, 1) + "%.",
      meaning: "Рост держится на внутреннем спросе: переводы " + signed(O.remittancesGrowthPct[2025], 1) + "%, стройка " +
        signed(O.constructionVolumeGrowth2025Pct, 1) + "%, торговля " + signed(O.tradeVolumeGrowth2025Pct, 1) +
        "%. Это один цикл, а не технологический сдвиг.",
      action: "Прогноз промышленности строить отдельно по золоту, строительству и переводам, а не по заголовку про ВВП."
    },
    {
      tag: "gold",
      title: "Лекарства: рост есть, своих лекарств на рынке меньше",
      big: pharma.rawExportUnprocessedLabel + " сырья уходит без переработки",
      fact: "По докладу доля своих лекарств на рынке " + fmt(pharma.share2021, 1) + "% → " + fmt(pharma.share2023, 1) + "% (2021 → 2023), импорт вырос на " +
        fmt(M.importGrowthPct(), 0) + "%. По Нацстаткому физический выпуск в 2025 году вырос в " + fmt(O.pharmaVolume2025FactorOfficial, 1) + " раза. Доли рынка за 2025 год в этих данных нет.",
      meaning: "Рост выпуска 2025 года идёт от низкой базы. Падение доли своих лекарств видно только до 2023 года. Связь «больше переработки сырья — больше своих лекарств» этими рядами не доказана.",
      action: "Запросить цену сырья и цену готового лекарства, а также долю рынка после 2023 года. Пока этого нет, переработку не называть ростом доли своих лекарств."
    },
    {
      tag: "budget",
      title: "Падение доли в ВВП — не падение производства",
      big: "Сельское хозяйство: доля " + fmt(O.gdpShares.agriculture[2021], 1) + "% → " + fmt(O.gdpShares.agriculture[2025], 1) + "%",
      fact: "Физический объём сельского хозяйства с 2021 по 2025 год вырос примерно на " + fmt(agriVolume, 0) + "%.",
      meaning: "Уменьшился вес сектора в экономике, а не сам выпуск. То же с образованием и здравоохранением: доли сжались, добавленная стоимость выросла.",
      action: "Решения по этим отраслям принимать по выпуску, занятости и производительности труда, а не по доле в ВВП."
    }
  ];

  function renderCards() {
    document.getElementById("homeCards").innerHTML = cards.map(function (c, i) {
      return "<div class='card home-card'><span class='tag " + c.tag + "'>Вывод " + (i + 1) + "</span>" +
        "<h3>" + esc(c.title) + "</h3><div class='kpi'>" + esc(c.big) + "</div>" +
        "<div class='step'><p class='step-label'>Что видно по данным</p><p>" + esc(c.fact) + "</p></div>" +
        "<div class='step'><p class='step-label'>Что это значит</p><p>" + esc(c.meaning) + "</p></div>" +
        "<div class='step act'><p class='step-label'>Что делать</p><p>" + esc(c.action) + "</p></div></div>";
    }).join("");
  }

  // ---------- Чему можно верить ----------
  function renderTrust() {
    var rows = [
      ["observed", "Подтверждено данными",
        "Рост строительства (" + signed(O.constructionVolumeGrowth2025Pct, 1) + "%), торговли (" + signed(O.tradeVolumeGrowth2025Pct, 1) +
        "%) и переводов (" + signed(O.remittancesGrowthPct[2025], 1) + "%) в 2025 году. Падение экспорта золота (" + signed(O.goldExportGrowth2025Pct, 1) +
        "%). Это ряды Нацстаткома и Нацбанка. Доли рынка лекарств — из доклада, не из открытого ряда Нацстаткома."],
      ["one_year", "Только сценарий",
        "Что будет с пошивом одежды после потери канала сбыта. Что даст рост переработки лекарственного сырья. Цифры на вкладке «Сценарии» — учебный пример."],
      ["missing", "Данных нет",
        "Какая доля выпуска одежды идёт через маркетплейсы. Как переработка сырья связана с долей своих лекарств. Производительность труда по отраслям."]
    ];
    document.getElementById("trustTable").innerHTML = rows.map(function (r) {
      return "<div class='trust-row'><div><span class='tag " + r[0] + "'>" + esc(r[1]) + "</span></div><div><p>" + esc(r[2]) + "</p></div></div>";
    }).join("");
  }

  // ---------- План сбора данных ----------
  var REG_KEY = "ktp_registry";
  var WHO = {
    k_raw_to_drug: "Нацстатком; ведомство по лекарственному обеспечению (уточнить)",
    price_wedge: "Нацстатком (цены), таможенная статистика",
    utilization: "Нацстатком, опрос предприятий",
    apparel_channel: "Нацстатком или опрос предприятий",
    apparel_passthrough: "Опрос швейных предприятий",
    profit: "Нацстатком, Минфин",
    labor_productivity: "Нацстатком",
    construction_beta: "Нацстатком (ряд за несколько лет)",
    gold: "Нацбанк, Нацстатком",
    remittances: "Нацбанк",
    rnd_lag: "Орган по науке, Нацстатком (уточнить)"
  };
  var STATUS = [
    ["not", "Не запрошено"],
    ["asked", "Запрошено"],
    ["partial", "Есть за один год"],
    ["done", "Получено"]
  ];

  function loadReg() {
    try { return JSON.parse(localStorage.getItem(REG_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveReg(reg) {
    try { localStorage.setItem(REG_KEY, JSON.stringify(reg)); } catch (e) {}
  }
  function defaultStatus(c) {
    return c.status === "missing" ? "not" : (c.status === "one_year" ? "partial" : "done");
  }

  function renderRegistry(containerId, onlyMissing) {
    var reg = loadReg();
    var items = M.COEFFICIENTS.filter(function (c) { return !onlyMissing || c.status === "missing"; });
    var body = items.map(function (c) {
      var saved = reg[c.id] || {};
      var status = saved.status || defaultStatus(c);
      var options = STATUS.map(function (s) {
        return "<option value='" + s[0] + "'" + (s[0] === status ? " selected" : "") + ">" + s[1] + "</option>";
      }).join("");
      return "<tr><td>" + esc(c.name) + "</td><td>" + esc(c.closes) + "</td><td>" + esc(WHO[c.id] || "Уточнить") + "</td>" +
        "<td><input type='date' data-id='" + esc(c.id) + "' data-field='due' value='" + esc(saved.due || "") + "' aria-label='Срок'></td>" +
        "<td><select data-id='" + esc(c.id) + "' data-field='status' aria-label='Статус'>" + options + "</select></td></tr>";
    }).join("");
    var box = document.getElementById(containerId);
    box.innerHTML = "<div class='reg-wrap'><table class='reg'><thead><tr><th>Какие данные нужны</th><th>Что они позволят понять</th>" +
      "<th>Кто может дать (предложение)</th><th>Срок</th><th>Статус</th></tr></thead><tbody>" + body + "</tbody></table></div>";
    var fields = box.querySelectorAll("[data-id]");
    for (var i = 0; i < fields.length; i++) {
      fields[i].addEventListener("change", function (e) {
        var id = e.target.getAttribute("data-id");
        var field = e.target.getAttribute("data-field");
        var data = loadReg();
        data[id] = data[id] || {};
        data[id][field] = e.target.value;
        saveReg(data);
        renderRegistry("askRegistry", true);
        renderRegistry("fullRegistry", false);
      });
    }
  }

  // ---------- Сценарии: учебный пример / свои числа ----------
  var EXAMPLE = { apparelChannel: "40", apparelLoss: "50", apparelRedirect: "25", apparelStock: "25", kInput: "0.2", processing: "16" };
  var OWN = { apparelChannel: "", apparelLoss: "", apparelRedirect: "", apparelStock: "", kInput: "", factShare: "", factImport: "", processing: "6" };
  var programmatic = false;

  function setValues(map) {
    programmatic = true;
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.value = map[id];
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    programmatic = false;
  }
  function setBanner(mode) {
    var title = document.getElementById("bannerTitle");
    var text = document.getElementById("bannerText");
    if (mode === "example") {
      title.textContent = "Учебный пример.";
      text.textContent = "Цифры в полях — учебный пример для расчёта. Это не прогноз и не данные Нацстаткома.";
    } else {
      title.textContent = "Режим «ваши числа».";
      text.textContent = "Пустое поле значит «данных пока нет»: расчёт по нему не делается. Заполните поля своими оценками или фактами.";
    }
  }
  function detectMode() {
    var ch = document.getElementById("apparelChannel");
    var k = document.getElementById("kInput");
    if (ch && k && ch.value === EXAMPLE.apparelChannel && k.value === EXAMPLE.kInput) return "example";
    return "own";
  }

  document.getElementById("btnOwn").addEventListener("click", function () { setValues(OWN); setBanner("own"); });
  document.getElementById("btnExample").addEventListener("click", function () { setValues(EXAMPLE); setBanner("example"); });
  document.getElementById("scenarios").addEventListener("input", function () {
    if (!programmatic) setBanner(detectMode());
  });

  // ---------- Простые слова вместо терминов (вкладка «Сценарии») ----------
  var PHRASES = [
    ["Контур разомкнут: переработка сырья не двигает рынок готовых лекарств, потому что коэффициент k не задан.",
     "Связь пока не доказана данными: переработка сырья не двигает рынок готовых лекарств, пока не задано, насколько сильно она срабатывает."],
    ["Контур замкнут допущением k = ", "Связь задана допущением: сила эффекта k = "],
    ["Это не оценка по ряду, пока вместо допущения не подставлен факт.", "Это не оценка по данным, пока вместо допущения не подставлен факт."],
    ["Рынок лекарств — поведение", "Рынок лекарств: как он отреагирует"],
    ["k: пунктов доли рынка на 1 пункт переработки", "Насколько сильно сработает: пунктов доли рынка на 1 пункт переработки"],
    ["Инерция: какая доля остаётся через шаг", "Если ничего не менять: какая доля остаётся через шаг"],
    ["Инерционная доля", "Доля, если ничего не менять"],
    ["инерционный импорт", "импорт, если ничего не менять"],
    ["Сценарная доля", "Доля по сценарию"],
    ["сценарный импорт", "импорт по сценарию"],
    ["Баланс сырья — тождество", "Баланс сырья: простая арифметика"],
    ["Ошибка инерции по доле", "Ошибка прогноза «если ничего не менять» по доле"],
    ["Новое наблюдение пересчитывает коэффициент", "Новый факт пересчитывает силу эффекта"],
    ["Коэффициент, который согласует", "Сила эффекта, которая согласует"],
    ["Балл плана", "Важность по методике КП НТП"]
  ];

  function simplify(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue;
      var out = text;
      for (var i = 0; i < PHRASES.length; i++) {
        if (out.indexOf(PHRASES[i][0]) !== -1) out = out.split(PHRASES[i][0]).join(PHRASES[i][1]);
      }
      if (out !== text) node.nodeValue = out;
    }
  }
  function watch(id) {
    var root = document.getElementById(id);
    var observer = new MutationObserver(function () {
      observer.disconnect();
      simplify(root);
      observer.observe(root, { subtree: true, childList: true, characterData: true });
    });
    simplify(root);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
  }

  // ---------- Подсказка, печать, старые ссылки ----------
  var legendBtn = document.getElementById("legendBtn");
  legendBtn.addEventListener("click", function () {
    var legend = document.getElementById("legend");
    var open = legend.classList.toggle("hidden") === false;
    legendBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

  var tabBeforePrint = null;
  window.addEventListener("beforeprint", function () {
    var active = document.querySelector(".tab.active");
    tabBeforePrint = active ? active.getAttribute("data-tab") : null;
    var home = document.querySelector(".tab[data-tab='home']");
    if (home) home.click();
  });
  window.addEventListener("afterprint", function () {
    if (!tabBeforePrint) return;
    var back = document.querySelector(".tab[data-tab='" + tabBeforePrint + "']");
    if (back) back.click();
  });

  var legacy = { guide: "home", worked: "data", market: "data", method: "data", sector: "scenarios", pharma: "scenarios" };
  var hash = location.hash.slice(1);
  if (legacy[hash]) {
    var target = document.querySelector(".tab[data-tab='" + legacy[hash] + "']");
    if (target) target.click();
  }

  renderCards();
  renderTrust();
  renderRegistry("askRegistry", true);
  renderRegistry("fullRegistry", false);
  watch("sector");
  watch("pharma");
  setBanner(detectMode());
})();
