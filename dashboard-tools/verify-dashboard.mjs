import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appDir = path.join(repoRoot, "india-ai-dashboard");
const require = createRequire(path.join(appDir, "package.json"));
const { chromium, firefox } = require("playwright");

const outputDir = process.env.DASHBOARD_SNAPSHOT_DIR || path.join("/tmp", "india-ai-dashboard-snapshots");
const url = process.argv[2] || "http://127.0.0.1:3000";

await fs.mkdir(outputDir, { recursive: true });

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.setDefaultNavigationTimeout(15000);
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outputDir, "dashboard-desktop.png"), fullPage: true });

  const initial = await page.evaluate(() => {
    const charts = Array.from(document.querySelectorAll(".chart-frame .chart-graphic")).map((chart) => {
      const box = chart.getBoundingClientRect();
      const drawn = chart.querySelectorAll("path, circle, rect, line, polyline").length > 0;
      return {
        width: box.width,
        height: box.height,
        drawn,
      };
    });
    const heroCanvas = document.querySelector("canvas.mission-canvas");
    const heroCanvasBox = heroCanvas?.getBoundingClientRect();
    const heroCanvasDrawn = (() => {
      if (!(heroCanvas instanceof HTMLCanvasElement)) return false;
      const context = heroCanvas.getContext("2d");
      if (!context || !heroCanvas.width || !heroCanvas.height) return false;
      const sample = context.getImageData(0, 0, Math.min(40, heroCanvas.width), Math.min(40, heroCanvas.height)).data;
      return Array.from(sample).some((value) => value !== 0);
    })();
    return {
      title: document.title,
      heading: document.querySelector("h1")?.textContent?.trim(),
      eyebrow: document.querySelector(".eyebrow")?.textContent?.trim().replace(/\s+/g, " "),
      bodyLength: document.body.innerText.trim().length,
      hero: Boolean(document.querySelector(".hero-section")),
      heroCanvas: heroCanvasBox ? { width: heroCanvasBox.width, height: heroCanvasBox.height, drawn: heroCanvasDrawn } : null,
      heroProof: document.querySelectorAll(".hero-proof span").length,
      kpiCards: document.querySelectorAll(".kpi-card").length,
      panels: document.querySelectorAll(".panel").length,
      filterGroups: document.querySelectorAll(".filter-group").length,
      stateButtons: document.querySelectorAll(".state-buttons button").length,
      orbitNodes: document.querySelectorAll(".india-ai-orbit .orbit-node[data-label]").length,
      stateDetail: document.querySelector(".state-detail-head h2")?.textContent?.trim(),
      activityRows: document.querySelectorAll(".activity-list a").length,
      heatmapCells: document.querySelectorAll(".heatmap-cell").length,
      evidenceTotal: Number(document.querySelector(".evidence-total")?.getAttribute("data-total") || 0),
      evidenceCards: document.querySelectorAll(".evidence-card").length,
      evidenceLinks: document.querySelectorAll(".evidence-card[href^='http']").length,
      evidenceTableRows: document.querySelectorAll(".evidence-table tbody tr").length,
      evidenceTableVisible: (() => {
        const table = document.querySelector(".evidence-table-wrap");
        if (!(table instanceof HTMLElement)) return false;
        const style = getComputedStyle(table);
        return style.display !== "none" && Number(style.opacity || 1) > 0.9 && table.getBoundingClientRect().width > 300;
      })(),
      charts,
      heroActions: Array.from(document.querySelectorAll(".hero-actions a, .hero-actions button")).map((element) => element.textContent?.trim() || ""),
      sourceSheetActions: document.querySelectorAll(".hero-actions a[href*='docs.google.com/spreadsheets']").length,
      exportActions: Array.from(document.querySelectorAll(".hero-actions button")).filter((element) => /export csv/i.test(element.textContent || "")).length,
      hasNoOverlay: !document.querySelector("[data-nextjs-dialog]"),
      horizontalOverflow: document.body.scrollWidth > window.innerWidth + 2,
    };
  });

  const chartGraphics = page.locator(".chart-frame .chart-graphic");
  const chartGraphicCount = await chartGraphics.count();
  for (let index = 0; index < chartGraphicCount; index += 1) {
    const box = await chartGraphics.nth(index).boundingBox();
    if (!box) continue;
    const points = [
      [box.x + box.width * 0.25, box.y + box.height * 0.35],
      [box.x + box.width * 0.5, box.y + box.height * 0.5],
      [box.x + box.width * 0.75, box.y + box.height * 0.65],
    ];
    for (const [x, y] of points) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(120);
    }
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(120);
    await page.getByRole("button", { name: "Reset" }).click();
    await page.waitForTimeout(180);
  }

  const stateChartBox = await chartGraphics.nth(0).boundingBox();
  const stateChartToggle = { selectedTotal: 0, clearedTotal: 0 };
  if (stateChartBox) {
    const attempts = [
      [0.18, 0.52],
      [0.2, 0.48],
      [0.23, 0.44],
      [0.16, 0.58],
      [0.26, 0.5],
    ];
    for (const [xRatio, yRatio] of attempts) {
      const x = stateChartBox.x + stateChartBox.width * xRatio;
      const y = stateChartBox.y + stateChartBox.height * yRatio;
      await page.mouse.click(x, y);
      await page.waitForTimeout(450);
      stateChartToggle.selectedTotal = await page.evaluate(() => Number(document.querySelector(".evidence-total")?.getAttribute("data-total") || 0));
      if (stateChartToggle.selectedTotal > 0 && stateChartToggle.selectedTotal < initial.evidenceTotal) {
        await page.mouse.click(stateChartBox.x + stateChartBox.width * 0.5, y);
        await page.waitForTimeout(450);
        stateChartToggle.clearedTotal = await page.evaluate(() => Number(document.querySelector(".evidence-total")?.getAttribute("data-total") || 0));
        break;
      }
      await page.getByRole("button", { name: "Reset" }).click();
      await page.waitForTimeout(250);
    }
    await page.getByRole("button", { name: "Reset" }).click();
    await page.waitForTimeout(300);
  }

  const tooltipOverflow = await page.evaluate(() => {
    const tooltips = Array.from(document.querySelectorAll(".chart-tooltip"));
    return tooltips
      .map((tooltip) => tooltip.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0)
      .some((box) => box.width > 260 || box.left < -1 || box.right > window.innerWidth + 1);
  });

  await page.getByRole("button", { name: "USD" }).click();
  await page.waitForTimeout(450);
  const usdMetricActive = await page.evaluate(() => document.querySelector(".metric-tabs button.active")?.textContent?.trim() === "USD");

  const stateFilter = page.locator(".filter-group").first();
  await stateFilter.hover();
  await page.waitForTimeout(200);
  const filterHover = await page.evaluate(() => {
    const firstGroup = document.querySelector(".filter-group");
    const options = firstGroup?.querySelector(".filter-options");
    const style = options ? getComputedStyle(options) : null;
    return {
      visible: Boolean(style && style.visibility === "visible" && Number(style.opacity) > 0.9),
      allOptions: document.querySelectorAll(".filter-option.all-option").length,
      firstAllText: firstGroup?.querySelector(".all-option")?.textContent?.trim() || "",
    };
  });
  await stateFilter.getByLabel("Delhi").click();
  await page.waitForTimeout(400);
  const stateFilterSelected = await page.evaluate(() => ({
    trigger: document.querySelector(".filter-group .filter-trigger strong")?.textContent?.trim(),
    evidenceTotal: Number(document.querySelector(".evidence-total")?.getAttribute("data-total") || 0),
  }));
  await stateFilter.hover();
  await stateFilter.locator(".all-option").click();
  await page.waitForTimeout(400);
  const stateFilterCleared = await page.evaluate(() => ({
    trigger: document.querySelector(".filter-group .filter-trigger strong")?.textContent?.trim(),
    evidenceTotal: Number(document.querySelector(".evidence-total")?.getAttribute("data-total") || 0),
  }));

  const subdomainFilter = page.locator(".subdomain-filter");
  await subdomainFilter.hover();
  await page.waitForTimeout(200);
  const subdomainFilterMenu = await page.evaluate(() => {
    const group = document.querySelector(".subdomain-filter");
    const options = group?.querySelector(".filter-options");
    if (!(options instanceof HTMLElement)) return { visible: false, allItemsAvailable: false, optionCount: 0 };
    const style = getComputedStyle(options);
    const optionCount = options.querySelectorAll("label").length;
    return {
      visible: style.visibility === "visible" && Number(style.opacity) > 0.9,
      allItemsAvailable: style.maxHeight === "none" && style.overflow === "visible",
      optionCount,
    };
  });

  const dependencyTargets = await page.evaluate(async () => {
    const dataset = await fetch("/api/dashboard").then((response) => response.json());
    const records = dataset.records || [];
    const domains = [...new Set(records.map((record) => record.domain))].sort();
    const subdomains = [...new Set(records.map((record) => record.subdomain))].sort();
    const domain = domains.find((name) => {
      const scopedSubdomains = new Set(records.filter((record) => record.domain === name).map((record) => record.subdomain));
      return scopedSubdomains.size > 0 && scopedSubdomains.size < subdomains.length;
    });
    const subdomain = subdomains.find((name) => {
      const scopedDomains = new Set(records.filter((record) => record.subdomain === name).map((record) => record.domain));
      return scopedDomains.size > 0 && scopedDomains.size < domains.length;
    });
    return { domain, subdomain, domainCount: domains.length, subdomainCount: subdomains.length };
  });
  if (!dependencyTargets.domain || !dependencyTargets.subdomain) {
    throw new Error(`Could not find dependency filter targets: ${JSON.stringify(dependencyTargets)}`);
  }

  const domainFilter = page.locator(".domain-filter");
  await domainFilter.hover();
  await domainFilter.locator("label").filter({ hasText: dependencyTargets.domain }).first().click();
  await page.waitForTimeout(400);
  const domainDependency = await page.evaluate((target) => ({
    selected: document.querySelector(".domain-filter .filter-trigger strong")?.textContent?.trim(),
    subdomainOptionCount: document.querySelectorAll(".subdomain-filter label").length,
    initialSubdomainCount: target.subdomainCount,
  }), dependencyTargets);
  await domainFilter.hover();
  await domainFilter.locator(".all-option").click();
  await page.waitForTimeout(400);

  await subdomainFilter.hover();
  await subdomainFilter.locator("label").filter({ hasText: dependencyTargets.subdomain }).first().click();
  await page.waitForTimeout(400);
  const subdomainDependency = await page.evaluate((target) => ({
    selected: document.querySelector(".subdomain-filter .filter-trigger strong")?.textContent?.trim(),
    domainOptionCount: document.querySelectorAll(".domain-filter label").length,
    initialDomainCount: target.domainCount,
  }), dependencyTargets);
  await subdomainFilter.hover();
  await subdomainFilter.locator(".all-option").click();
  await page.waitForTimeout(400);

  await page.getByPlaceholder(/Search organization, initiative/i).fill("data centre");
  await page.waitForTimeout(700);
  const searchEvidence = await page.evaluate(() => ({
    total: Number(document.querySelector(".evidence-total")?.getAttribute("data-total") || 0),
    visible: document.querySelectorAll(".evidence-card").length,
  }));

  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Karnataka/i }).first().click();
  await page.waitForTimeout(650);
  const stateFocus = await page.evaluate(() => ({
    selected: document.querySelector(".state-detail-head h2")?.textContent?.trim(),
    evidenceTotal: Number(document.querySelector(".evidence-total")?.getAttribute("data-total") || 0),
    evidenceCards: document.querySelectorAll(".evidence-card").length,
    activityRows: document.querySelectorAll(".activity-list a").length,
  }));

  await page.getByRole("button", { name: /Karnataka/i }).first().click();
  await page.waitForTimeout(500);
  const stateToggleCleared = await page.evaluate(() => ({
    selected: document.querySelector(".state-detail-head h2")?.textContent?.trim(),
    evidenceTotal: Number(document.querySelector(".evidence-total")?.getAttribute("data-total") || 0),
    activeButtons: document.querySelectorAll(".state-buttons button.active").length,
  }));

  await page.getByRole("button", { name: /Investment/i }).click();
  await page.waitForTimeout(350);
  const sortedByInvestment = await page.evaluate(() => document.querySelector(".evidence-sort button.active span")?.textContent?.trim() === "desc");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outputDir, "dashboard-mobile.png"), fullPage: true });
  const mobile = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    horizontalOverflow: document.body.scrollWidth > window.innerWidth + 2,
    heading: document.querySelector("h1")?.textContent?.trim(),
    hero: Boolean(document.querySelector(".hero-section")),
    kpis: document.querySelectorAll(".kpi-card").length,
    panels: document.querySelectorAll(".panel").length,
    evidenceCardsVisible: (() => {
      const card = document.querySelector(".evidence-card");
      if (!(card instanceof HTMLElement)) return false;
      const style = getComputedStyle(card);
      return style.display !== "none" && card.getBoundingClientRect().width > 100;
    })(),
    evidenceTableHidden: (() => {
      const table = document.querySelector(".evidence-table-wrap");
      if (!(table instanceof HTMLElement)) return false;
      return getComputedStyle(table).display === "none";
    })(),
  }));

  const result = {
    initial,
    usdMetricActive,
    filterHover,
    stateChartToggle,
    stateFilterSelected,
    stateFilterCleared,
    subdomainFilterMenu,
    domainDependency,
    subdomainDependency,
    searchEvidence,
    tooltipOverflow,
    stateFocus,
    stateToggleCleared,
    sortedByInvestment,
    mobile,
    consoleErrors,
  };

  console.log(JSON.stringify(result, null, 2));

  const failures = [];
  if (initial.title !== "India AI Policy Stack") failures.push("wrong page title");
  if (initial.heading !== "India AI Policy Stack") failures.push("wrong heading");
  if (initial.eyebrow !== "Public AI Intelligence") failures.push(`wrong eyebrow text: ${initial.eyebrow}`);
  if (initial.bodyLength < 4000) failures.push("dashboard copy appears incomplete");
  if (!initial.hero) failures.push("mission hero missing");
  if (!initial.heroCanvas || initial.heroCanvas.width < 300 || initial.heroCanvas.height < 300 || !initial.heroCanvas.drawn) failures.push("mission canvas appears blank");
  if (initial.heroProof !== 2) failures.push(`expected 2 hero proof stats, saw ${initial.heroProof}`);
  if (initial.kpiCards !== 5) failures.push(`expected 5 KPI cards, saw ${initial.kpiCards}`);
  if (initial.panels < 8) failures.push(`expected at least 8 panels, saw ${initial.panels}`);
  if (initial.filterGroups !== 4) failures.push(`expected 4 filter groups, saw ${initial.filterGroups}`);
  if (initial.stateButtons < 4) failures.push(`expected at least 4 state buttons, saw ${initial.stateButtons}`);
  if (initial.orbitNodes !== initial.stateButtons) failures.push(`expected India animation to include ${initial.stateButtons} state nodes, saw ${initial.orbitNodes}`);
  if (initial.stateDetail !== "Maharashtra") failures.push(`expected Maharashtra default drill-down, saw ${initial.stateDetail}`);
  if (initial.activityRows < 1) failures.push("state activity drill-down missing");
  if (initial.heatmapCells < 12) failures.push("heatmap cells missing");
  if (initial.evidenceTotal < 62) failures.push(`expected at least 62 evidence records, saw ${initial.evidenceTotal}`);
  if (initial.evidenceCards !== 12) failures.push(`expected compact evidence view with 12 cards, saw ${initial.evidenceCards}`);
  if (initial.evidenceLinks !== initial.evidenceCards) failures.push("evidence source links missing");
  if (initial.evidenceTableRows !== 12) failures.push(`expected responsive evidence table with 12 rows, saw ${initial.evidenceTableRows}`);
  if (!initial.evidenceTableVisible) failures.push("desktop evidence table is not visible");
  if (initial.charts.length < 6) failures.push("expected at least six dashboard chart graphics");
  if (!initial.charts.every((chart) => chart.width > 100 && chart.height > 100 && chart.drawn)) failures.push("one or more charts appear blank");
  if (tooltipOverflow) failures.push("chart tooltip overflow detected");
  if (initial.heroActions.length !== 1 || initial.heroActions[0] !== "Explore data") failures.push(`expected only Explore data hero action, saw ${JSON.stringify(initial.heroActions)}`);
  if (initial.sourceSheetActions !== 0) failures.push("source sheet hero action should be removed");
  if (initial.exportActions !== 0) failures.push("export CSV hero action should be removed");
  if (!initial.hasNoOverlay) failures.push("framework error overlay detected");
  if (initial.horizontalOverflow) failures.push("desktop horizontal overflow");
  if (!usdMetricActive) failures.push("metric control did not switch to USD");
  if (!filterHover.visible) failures.push("state filter did not open on hover");
  if (stateChartToggle.selectedTotal < 1 || stateChartToggle.selectedTotal >= initial.evidenceTotal || stateChartToggle.clearedTotal !== initial.evidenceTotal) {
    failures.push(`state comparison chart toggle failed: ${JSON.stringify(stateChartToggle)}`);
  }
  if (filterHover.allOptions !== 4) failures.push(`expected All option in each filter, saw ${filterHover.allOptions}`);
  if (filterHover.firstAllText !== "All State") failures.push(`unexpected state All option text: ${filterHover.firstAllText}`);
  if (!subdomainFilterMenu.visible) failures.push("subdomain filter did not open on hover");
  if (!subdomainFilterMenu.allItemsAvailable) failures.push(`subdomain filter should show all options without internal clipping: ${JSON.stringify(subdomainFilterMenu)}`);
  if (subdomainFilterMenu.optionCount < 10) failures.push(`expected a broad subdomain filter list, saw ${subdomainFilterMenu.optionCount}`);
  if (domainDependency.selected !== "1 selected" || domainDependency.subdomainOptionCount >= domainDependency.initialSubdomainCount) {
    failures.push(`domain filter did not narrow subdomain options: ${JSON.stringify(domainDependency)}`);
  }
  if (subdomainDependency.selected !== "1 selected" || subdomainDependency.domainOptionCount >= subdomainDependency.initialDomainCount) {
    failures.push(`subdomain filter did not narrow domain options: ${JSON.stringify(subdomainDependency)}`);
  }
  if (stateFilterSelected.trigger !== "1 selected" || stateFilterSelected.evidenceTotal < 1 || stateFilterSelected.evidenceTotal >= initial.evidenceTotal) {
    failures.push(`state filter selection failed: ${JSON.stringify(stateFilterSelected)}`);
  }
  if (stateFilterCleared.trigger !== "All" || stateFilterCleared.evidenceTotal !== initial.evidenceTotal) failures.push(`state filter All option failed: ${JSON.stringify(stateFilterCleared)}`);
  if (searchEvidence.total < 1 || searchEvidence.total >= initial.evidenceTotal || searchEvidence.visible !== Math.min(12, searchEvidence.total)) failures.push(`search did not narrow evidence correctly, saw ${JSON.stringify(searchEvidence)}`);
  if (stateFocus.selected !== "Karnataka") failures.push(`state drill-down did not switch to Karnataka, saw ${stateFocus.selected}`);
  if (stateFocus.evidenceTotal < 1) failures.push(`Karnataka state focus expected matching evidence records, saw ${stateFocus.evidenceTotal}`);
  if (stateFocus.evidenceCards !== 12) failures.push(`Karnataka compact evidence expected 12 visible cards, saw ${stateFocus.evidenceCards}`);
  if (stateFocus.activityRows < 1) failures.push("Karnataka activity drill-down missing");
  if (stateToggleCleared.selected !== "All States") failures.push(`second portfolio click did not clear to All States, saw ${stateToggleCleared.selected}`);
  if (stateToggleCleared.evidenceTotal !== initial.evidenceTotal) failures.push(`second portfolio click expected ${initial.evidenceTotal} evidence records, saw ${stateToggleCleared.evidenceTotal}`);
  if (stateToggleCleared.activeButtons !== 0) failures.push(`second portfolio click should leave no active state buttons, saw ${stateToggleCleared.activeButtons}`);
  if (!sortedByInvestment) failures.push("evidence sort indicator did not update");
  if (mobile.horizontalOverflow) failures.push("mobile horizontal overflow");
  if (mobile.heading !== "India AI Policy Stack") failures.push("mobile heading missing");
  if (!mobile.hero) failures.push("mobile hero missing");
  if (mobile.kpis !== 5) failures.push("mobile KPI cards missing");
  if (mobile.panels < 8) failures.push("mobile panels missing");
  if (!mobile.evidenceCardsVisible) failures.push("mobile evidence cards are not visible");
  if (!mobile.evidenceTableHidden) failures.push("mobile evidence table should be hidden in favor of cards");
  if (consoleErrors.length) failures.push("console errors detected");

  if (failures.length) {
    throw new Error(failures.join("; "));
  }
} finally {
  await context.close();
  await browser.close();
}

async function launchBrowser() {
  const chromiumArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-crash-reporter",
    "--disable-crashpad",
    "--disable-breakpad",
    "--no-zygote",
  ];
  const bundledChromium = "/tmp/ms-playwright/chromium-1228/chrome-linux64/chrome";

  try {
    return await chromium.launch({ headless: true, args: chromiumArgs, timeout: 15000 });
  } catch (error) {
    const firstError = error;
    try {
      await fs.access(bundledChromium);
      return await chromium.launch({ executablePath: bundledChromium, headless: true, args: chromiumArgs, timeout: 15000 });
    } catch {
      if (!String(firstError?.message || firstError).includes("Executable doesn't exist")) {
        console.warn(`Chromium launch failed; trying Firefox fallback.\n${String(firstError?.message || firstError)}`);
      }
      return firefox.launch({ headless: true, executablePath: "/usr/bin/firefox", timeout: 15000 });
    }
  }
}
