import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(import.meta.dirname, "..");
const require = createRequire(process.env.ARTIFACT_TOOL_REQUIRE_FROM || "/tmp/india-ai-work/package.json");
const { FileBlob, SpreadsheetFile } = require("@oai/artifact-tool");
const workbookPath =
  process.argv[2] || path.join(repoRoot, "india-ai-dashboard", "data", "dashboard.v1_industry_researched.xlsx");

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const recordsSheet = workbook.worksheets.getItem("Records");
const usedRange = recordsSheet.getUsedRange(true);
const rows = usedRange.values;
const headers = rows[0].map((value) => text(value));
const column = Object.fromEntries(headers.map((header, index) => [header, index]));

const taxonomyColumn = column.Domain ?? column.Industry;
const capabilityColumn = column.Subdomain ?? column.Capability;

if (taxonomyColumn == null || capabilityColumn == null) {
  throw new Error("Expected Records columns Domain/Subdomain or Industry/Capability.");
}

const outputRows = rows.map((row, rowIndex) => {
  if (rowIndex === 0) {
    const next = [...row];
    next[taxonomyColumn] = "Industry";
    next[capabilityColumn] = "Capability";
    return next;
  }

  const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
  const classification = classifyRecord(record);
  const next = [...row];
  next[taxonomyColumn] = classification.industry;
  next[capabilityColumn] = classification.capability;
  return next;
});

recordsSheet.getRangeByIndexes(0, 0, outputRows.length, outputRows[0].length).values = outputRows;

const dataRows = outputRows.slice(1);
const taxonomyRows = buildTaxonomyRows(dataRows, taxonomyColumn, capabilityColumn, column.Chartable);
const taxonomySheet = workbook.worksheets.getItem("Taxonomy");
taxonomySheet.getUsedRange(true).clear({ applyTo: "contents" });
taxonomySheet.getRangeByIndexes(0, 0, taxonomyRows.length, taxonomyRows[0].length).values = taxonomyRows;
taxonomySheet.getRange("A1:D1").format = {
  fill: "#17324d",
  font: { bold: true, color: "#FFFFFF" },
};
taxonomySheet.getRangeByIndexes(0, 0, taxonomyRows.length, taxonomyRows[0].length).format.borders = {
  preset: "inside",
  style: "thin",
  color: "#D6DEE8",
};
taxonomySheet.getRange("A:D").format.autofitColumns();

const summaryRows = buildSummaryRows(dataRows, taxonomyColumn, capabilityColumn, column.Chartable, column["INR Crore"], column["USD Million"], column.ID);
const summarySheet = workbook.worksheets.getItem("Summary");
summarySheet.getUsedRange(true).clear({ applyTo: "contents" });
summarySheet.getRangeByIndexes(0, 0, summaryRows.length, summaryRows[0].length).values = summaryRows;
summarySheet.getRange("A1:D1").format = {
  fill: "#17324d",
  font: { bold: true, color: "#FFFFFF" },
};
summarySheet.getRangeByIndexes(0, 0, summaryRows.length, summaryRows[0].length).format.borders = {
  preset: "inside",
  style: "thin",
  color: "#D6DEE8",
};
summarySheet.getRange("A:D").format.autofitColumns();

  const preview = await workbook.render({ sheetName: "Records", range: "A1:T14", scale: 1, format: "png" });
await fs.writeFile(path.join(path.dirname(workbookPath), "previews", "records-taxonomy-updated.png"), new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);

console.log(`Updated ${path.relative(repoRoot, workbookPath)} with Industry and Capability columns.`);

function classifyRecord(record) {
  const currentIndustry = text(record.Industry);
  const currentCapability = text(record.Capability);
  if (currentIndustry && currentCapability) {
    return { industry: currentIndustry, capability: currentCapability };
  }
  const currentDomain = text(record.Domain || currentIndustry);
  const currentSubdomain = text(record.Subdomain || currentCapability);
  const combined = normalize(
    [
      currentDomain,
      currentSubdomain,
      record.Organization,
      record.Initiative,
      record["Investment Domain / Area"],
      record["Investment Type"],
      record["Technology Use"],
      record["Source Summary"],
    ].join(" "),
  );

  return {
    industry: classifyIndustry(combined, currentDomain, currentSubdomain),
    capability: classifyCapability(combined, currentDomain, currentSubdomain),
  };
}

function classifyIndustry(combined, currentDomain, currentSubdomain) {
  if (/health|medical|hospital|diagnos|biotech|life sciences|public health/.test(combined)) return "Healthcare";
  if (/agri|agriculture|farm|farmer|crop/.test(combined)) return "Agriculture";
  if (/defence|defense|aerospace|space|drone|satellite/.test(combined)) return "Defence & Aerospace";
  if (/traffic|transport|mobility|rail|metro|bus|road/.test(combined)) return "Transportation";
  if (/fintech|financial|finance|bank|credit|insurance/.test(combined)) return "Finance";
  if (/marketing|advertis|video content|video generation|brand communication|customer communication/.test(combined)) return "Marketing & Advertising";
  if (/manufactur|industrial|factory|electronics|semiconductor|chip|esdm|green chemistry/.test(combined)) return "Manufacturing & Electronics";
  if (/data centre|data center|cloud|compute|colocation|digital infrastructure|it\/ites|it ites|logistics|gcc|global capability|office campus|business district/.test(combined)) return "Technology Infrastructure";
  if (/school|education|student|skilling|skill|training|workforce|university|iit|nsut|ggsipu|college/.test(combined)) return "Education & Skilling";
  if (/police|surveillance|safe city|c4i|cctv|anpr|public safety|governance|civic|water|department|government|public sector|citizen/.test(combined)) return "Government & Public Services";
  if (/startup|start up|incubat|innovation|deeptech|research|coe|centre of excellence|center of excellence/.test(combined)) return "Technology & Innovation";
  if (/industry domain/i.test(currentDomain)) return normalizeIndustryLabel(currentSubdomain);
  return "Technology & Innovation";
}

function classifyCapability(combined, currentDomain, currentSubdomain) {
  if (/data centre|data center|cloud|compute|colocation|sovereign cloud/.test(combined)) return "Cloud & Compute";
  if (/semiconductor|chip|electronics|esdm|hardware|advanced manufacturing/.test(combined)) return "Semiconductor & Electronics";
  if (/startup|start up|incubat|accelerat|innovation ecosystem|grant|venture|deeptech plan/.test(combined)) return "Startup & Innovation Ecosystem";
  if (/school|skilling|skill|training|workforce|curriculum|student|exchange programme|university/.test(combined)) return "AI Talent & Skilling";
  if (/governance|policy|mission|strategy|roadmap|sandbox|responsible ai|public-sector ai|public sector ai/.test(combined)) return "AI Strategy & Governance";
  if (/water|digital public|public infrastructure|civic|citizen service|department platform/.test(combined)) return "Digital Public Infrastructure";
  if (/gcc|global capability|enterprise|automation|robotics|analytics|industry 4\.0|digital transformation/.test(combined)) return "Automation & Enterprise Tech";
  if (/research|biotech|life sciences|quantum|ml|machine learning|prototype|ip creation|coe|centre of excellence|center of excellence/.test(combined)) return "AI Research & Innovation";
  if (/surveillance|camera|cctv|anpr|traffic|diagnos|application|applied ai|monitoring|command-control|command control/.test(combined)) return "AI Applications";
  if (/data storage|data platform|data infrastructure|it infrastructure/.test(combined)) return "Data Infrastructure";
  if (/capability domain/i.test(currentDomain)) return currentSubdomain || "Emerging AI Capability";
  return "Emerging AI Capability";
}

function buildTaxonomyRows(dataRows, industryIndex, capabilityIndex, chartableIndex) {
  const groups = new Map();
  dataRows.forEach((row) => {
    const industry = text(row[industryIndex]);
    const capability = text(row[capabilityIndex]);
    const key = `${industry}\u0000${capability}`;
    const current = groups.get(key) || { industry, capability, records: 0, chartable: 0 };
    current.records += 1;
    if (asBoolean(row[chartableIndex])) current.chartable += 1;
    groups.set(key, current);
  });

  return [
    ["Industry", "Capability", "Record Count", "Chartable Count"],
    ...[...groups.values()]
      .sort((a, b) => a.industry.localeCompare(b.industry) || a.capability.localeCompare(b.capability))
      .map((group) => [group.industry, group.capability, group.records, group.chartable]),
  ];
}

function buildSummaryRows(dataRows, industryIndex, capabilityIndex, chartableIndex, inrIndex, usdIndex, idIndex) {
  const industries = unique(dataRows.map((row) => text(row[industryIndex])));
  const capabilities = unique(dataRows.map((row) => text(row[capabilityIndex])));
  const chartableRows = dataRows.filter((row) => asBoolean(row[chartableIndex]));
  const totalInr = chartableRows.reduce((sum, row) => sum + numberValue(row[inrIndex]), 0);
  const totalUsd = chartableRows.reduce((sum, row) => sum + numberValue(row[usdIndex]), 0);
  const latestIds = dataRows.slice(-9).map((row) => text(row[idIndex])).filter(Boolean).join(", ");

  return [
    ["Metric", "Value", "Detail", "Notes"],
    ["Records", dataRows.length, "All rows in Records sheet", ""],
    ["Chartable records", chartableRows.length, "Rows with parsed INR or USD amount", ""],
    ["Industries", industries.length, industries.join(", "), ""],
    ["Capabilities", capabilities.length, capabilities.join(", "), ""],
    ["Industry-capability pairs", buildTaxonomyRows(dataRows, industryIndex, capabilityIndex, chartableIndex).length - 1, "Distinct paired taxonomy combinations", ""],
    ["Total INR crore", Number(totalInr.toFixed(2)), "Parsed chartable INR rows", "USD rows are separate"],
    ["Total USD million", Number(totalUsd.toFixed(3)), "Parsed chartable USD rows", "INR rows are separate"],
    ["Latest added IDs", latestIds, "9 newest records", ""],
  ];
}

function normalizeIndustryLabel(value) {
  const labels = {
    Defence: "Defence & Aerospace",
    Government: "Government & Public Services",
    Manufacturing: "Manufacturing & Electronics",
  };
  return labels[value] || value || "Technology & Innovation";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function asBoolean(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function text(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return text(value)
    .toLowerCase()
    .replace(/data\s*-?\s*cent(?:re|er)s?/g, "data centre")
    .replace(/datacent(?:re|er)s?/g, "data centre")
    .replace(/&/g, " and ");
}
