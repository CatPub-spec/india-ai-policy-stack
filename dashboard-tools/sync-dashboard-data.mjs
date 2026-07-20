import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appDir = path.join(repoRoot, "india-ai-dashboard");
const require = createRequire(process.env.ARTIFACT_TOOL_REQUIRE_FROM || "/tmp/india-ai-work/package.json");
const { FileBlob, SpreadsheetFile } = require("@oai/artifact-tool");

const SOURCE_SPREADSHEET_ID = "1bUQ19QlLoGFmsiP4vrV5hvwXN45AFonsu4c1bEc10ZA";
const SOURCE_SHEET = process.env.SOURCE_SHEET || "Records";
const sourceWorkbook =
  process.argv[2] || process.env.SOURCE_XLSX || path.join(appDir, "data", "dashboard.v1_industry_researched.xlsx");
const outputPath = path.join(appDir, "data", "dashboard.v1.json");

const input = await FileBlob.load(sourceWorkbook);
const workbook = await SpreadsheetFile.importXlsx(input);
const worksheet =
  workbook.worksheets.getItemOrNullObject(SOURCE_SHEET).isNullObject
    ? workbook.worksheets.getItemOrNullObject("All Verified 2024+")
    : workbook.worksheets.getItem(SOURCE_SHEET);

if (!worksheet || worksheet.isNullObject) {
  throw new Error(`Workbook does not contain sheet: ${SOURCE_SHEET}`);
}

const rows = worksheet.getUsedRange(true).values.map((row) => row.map(cellText));
const isRecordsSheet = worksheet.name === "Records";
const headerIndex = isRecordsSheet ? 0 : rows.findIndex((row) => row[0] === "Year" && row[1] === "State");

if (headerIndex === -1) {
  throw new Error(`Could not find table header for ${worksheet.name}`);
}

const headers = rows[headerIndex].map(String);
const sourceRows = rows
  .slice(headerIndex + 1)
  .filter((row) => (isRecordsSheet ? row[1] && row[2] : row[0] && row[1]))
  .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));

const records = sourceRows.map((row, index) => {
  return isRecordsSheet ? recordFromRecordsSheet(row, index) : recordFromLegacySheet(row, index);
});
const lastColumn = columnLetters(headers.length);
const sourceRange = `A${headerIndex + 1}:${lastColumn}${headerIndex + sourceRows.length + 1}`;

const dataset = {
  metadata: {
    title: "India AI Development Dashboard",
    sourceSpreadsheetId: SOURCE_SPREADSHEET_ID,
    sourceSpreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/edit`,
    sourceSheet: worksheet.name,
    sourceRange,
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    amountPolicy:
      "INR crore and USD million values are charted separately. Undisclosed, per-unit, and non-row-specific amounts are preserved in the ledger but excluded from value totals.",
  },
  records,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${records.length} records.`);

function recordFromRecordsSheet(row, index) {
  const location = text(row.Location || row.State);
  const industry = text(row.Industry || row.Domain);
  const capability = text(row.Capability || row.Subdomain);
  const organization = text(row.Organization);
  return {
    id: text(row.ID) || `ai-${String(index + 1).padStart(3, "0")}`,
    year: Number(row.Year),
    state: text(row.State) || canonicalState(location),
    location,
    organization,
    majorPlayers: parseMajorPlayers(row, organization),
    institutionRelationships: parseInstitutionRelationships(row),
    initiative: text(row.Initiative),
    industry,
    capability,
    Industry: industry,
    Capability: capability,
    investmentDomain: text(row["Investment Domain / Area"]),
    investmentBrought: text(row["Investment Brought"]),
    investmentType: text(row["Investment Type"]),
    technologyUse: text(row["Technology Use"]),
    sourceSummary: text(row["Source Summary"]),
    sourceUrl: text(row["Source URL"]),
    amount: parseInvestmentAmount(row["Investment Brought"]),
  };
}

function recordFromLegacySheet(row, index) {
  const location = text(row.State);
  const classification = classifyTaxonomy(row.Domain, row);
  const organization = text(row["Public Organisation"]);
  return {
    id: `ai-${String(index + 1).padStart(3, "0")}`,
    year: Number(row.Year),
    state: canonicalState(location),
    location,
    organization,
    majorPlayers: parseMajorPlayers(row, organization),
    institutionRelationships: parseInstitutionRelationships(row),
    initiative: text(row["Policy / Initiative Change"]),
    industry: classification.industry,
    capability: classification.capability,
    Industry: classification.industry,
    Capability: classification.capability,
    investmentDomain: text(row["Investment Domain / Area"]),
    investmentBrought: text(row["Investment Brought"]),
    investmentType: text(row["Investment Type"]),
    technologyUse: text(row["AI / Technology Use"]),
    sourceSummary: text(row["Source Summary"]),
    sourceUrl: text(row["Source URL"]),
    amount: parseInvestmentAmount(row["Investment Brought"]),
  };
}

function parseMajorPlayers(row, organization) {
  const raw = row["Major Players"] || row["Major Player(s)"] || row["Major Players / Institutions"] || "";
  const values = Array.isArray(raw) ? raw : String(raw).split(/\r?\n|[;|]/);
  const seen = new Set();
  const players = values
    .map((value) => text(value).replace(/^[\u2022\-*]+\s*/, ""))
    .filter((value) => value && !/^(?:n\/?a|none|unknown|not disclosed|unnamed)$/i.test(value))
    .filter((value) => {
      const key = value.toLocaleLowerCase("en-IN");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return players.length ? players : organization ? [organization] : [];
}

function parseInstitutionRelationships(row) {
  const raw = row["Institution Relationships"] || row["Institution Relationship Pairs"] || "";
  const seen = new Set();
  return String(raw)
    .split(/\r?\n|\s*\|\|\s*/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [pair = "", relationship = "Direct relationship", detail = "", sourceUrl = ""] = line.split(/\s*::\s*/, 4);
      const [source = "", target = ""] = pair.split(/\s*<->\s*/, 2).map(text);
      if (!source || !target || source.toLocaleLowerCase("en-IN") === target.toLocaleLowerCase("en-IN")) return [];
      const key = [source, target].map((value) => value.toLocaleLowerCase("en-IN")).sort().join("\u0000");
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        source,
        target,
        relationship: text(relationship) || "Direct relationship",
        detail: text(detail) || "Named together as direct counterparties in the cited source.",
        ...(text(sourceUrl) ? { sourceUrl: text(sourceUrl) } : {}),
      }];
    });
}

function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value).trim();
  if ("text" in value) return String(value.text ?? "").trim();
  if ("result" in value) return cellText(value.result);
  if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("").trim();
  return String(value).trim();
}

function text(value) {
  return String(value ?? "").trim();
}

function canonicalState(location) {
  return text(location).split("/")[0].trim();
}

function classifyTaxonomy(sourceDomain, row = {}) {
  const source = text(sourceDomain);
  const combined = normalizeTaxonomyText(
    [
      source,
      row["Policy / Initiative Change"],
      row["Investment Domain / Area"],
      row["AI / Technology Use"],
      row["Investment Type"],
    ].join(" "),
  );
  const capability = (value, industry = "Technology & Innovation") => ({ industry, capability: value });
  const industry = (value) => ({ industry: value, capability: "Emerging AI Capability" });

  if (source === "Digital & Smart Infrastructure") {
    if (/\btraffic|mobility|transport\b/.test(combined)) return { industry: "Transportation", capability: "AI Applications" };
    if (/\bfintech|financial|finance\b/.test(combined)) return industry("Finance");
    if (/\bgcc\b|global capability|competence centre|competence center/.test(combined)) return { industry: "Technology Infrastructure", capability: "Automation & Enterprise Tech" };
    if (/data centre|data center|cloud|compute|colocation/.test(combined)) return { industry: "Technology Infrastructure", capability: "Cloud & Compute" };
    return capability("Data Infrastructure");
  }

  const sourceMap = {
    "AI / Biotech": { industry: "Healthcare", capability: "AI Research & Innovation" },
    "AI / Deeptech Ecosystem": capability("Startup & Innovation Ecosystem"),
    "AI Governance / Smart City": capability("AI Strategy & Governance", "Government & Public Services"),
    "AI Hardware & Advanced Manufacturing": capability("Semiconductor & Electronics", "Manufacturing & Electronics"),
    "AI Hardware & Semiconductors": capability("Semiconductor & Electronics", "Manufacturing & Electronics"),
    "AI Infrastructure / Data Centre": capability("Cloud & Compute", "Technology Infrastructure"),
    "AI Infrastructure / Innovation City": capability("Cloud & Compute", "Technology Infrastructure"),
    "Aerospace & Defence Tech": { industry: "Defence & Aerospace", capability: "Semiconductor & Electronics" },
    Agriculture: { industry: "Agriculture", capability: "Emerging AI Capability" },
    "Digital Governance / Civic AI": capability("Digital Public Infrastructure", "Government & Public Services"),
    "Education & Skilling": capability("AI Talent & Skilling", "Education & Skilling"),
    "Enterprise AI / GCC": capability("Automation & Enterprise Tech", "Technology Infrastructure"),
    "Enterprise AI / Regional Tech Hub": capability("Automation & Enterprise Tech", "Technology Infrastructure"),
    Healthcare: { industry: "Healthcare", capability: "AI Applications" },
    "Healthcare / Medical AI": { industry: "Healthcare", capability: "AI Applications" },
    "Industrial AI / Green Chemistry": { industry: "Manufacturing & Electronics", capability: "AI Applications" },
    "Public Safety & Urban Security": { industry: "Government & Public Services", capability: "AI Applications" },
    "Public Transport / Safety AI": { industry: "Transportation", capability: "AI Applications" },
    "Water Tech / Digital Governance": capability("Digital Public Infrastructure", "Government & Public Services"),
  };

  return sourceMap[source] || capability("Emerging Technologies");
}

function normalizeTaxonomyText(value) {
  return text(value)
    .toLowerCase()
    .replace(/data\s*-?\s*cent(?:re|er)s?/g, "data centre")
    .replace(/datacent(?:re|er)s?/g, "data centre")
    .replace(/&/g, " and ");
}

function parseInvestmentAmount(value) {
  const input = text(value);
  const lower = input.toLowerCase();
  const excluded = (parseNote) => ({
    currency: null,
    chartable: false,
    croreValue: null,
    usdMillionValue: null,
    parseNote,
  });

  if (!input) return excluded("No amount text was provided.");
  if (lower.includes("not disclosed for")) {
    return excluded("Excluded because the row-specific share is not disclosed.");
  }
  if (lower.includes("reported property-tax")) {
    return excluded("Excluded because the amount is a reported collection, not an investment commitment.");
  }
  if (lower.includes("credit potential")) {
    return excluded("Excluded because the amount is credit potential, not an investment commitment.");
  }
  if (lower.includes("per hectare") || lower.includes("per farmer")) {
    return excluded("Excluded because the amount is a per-unit subsidy, not a row-level commitment total.");
  }
  if (lower.includes("policy package") && !/\u20b9\s*[\d,.]+\s*(?:lakh\s*)?crore/i.test(input)) {
    return excluded("Excluded because the accessible source does not publish a separate AI outlay.");
  }

  const lakhCroreMatch = input.match(/\u20b9\s*([\d,.]+)\s*lakh\s*crore/i);
  if (lakhCroreMatch) {
    return inrAmount(parseNumber(lakhCroreMatch[1]) * 100000, "Parsed INR lakh crore amount.");
  }

  const totalCroreMatch = input.match(/\u20b9\s*([\d,.]+)\s*crore\s*total/i);
  if (totalCroreMatch) {
    return inrAmount(parseNumber(totalCroreMatch[1]), "Parsed explicit INR total amount.");
  }

  const limitCroreMatch = input.match(/(?:limit|allocation limit)\s*\u20b9\s*([\d,.]+)\s*crore/i);
  if (limitCroreMatch) {
    return inrAmount(parseNumber(limitCroreMatch[1]), "Parsed INR allocation limit.");
  }

  const croreRangeMatch = input.match(/\u20b9\s*([\d,.]+)\s*(?:crore\s*)?(?:-|to)\s*\u20b9?\s*[\d,.]+\s*crore/i);
  if (croreRangeMatch) {
    return inrAmount(parseNumber(croreRangeMatch[1]), "Parsed lower bound of INR crore range.");
  }

  const croreMatches = [...input.matchAll(/\u20b9\s*([\d,.]+)\s*crore/gi)].map((match) => parseNumber(match[1]));
  if (croreMatches.length) {
    const croreValue =
      /\+/.test(input) && croreMatches.length > 1
        ? Number(croreMatches.reduce((sum, amount) => sum + amount, 0).toFixed(2))
        : croreMatches[0];
    return inrAmount(croreValue, /\+/.test(input) ? "Computed sum of explicit INR crore amounts." : "Parsed INR crore amount.");
  }

  const usdMatches = [...input.matchAll(/\$\s*([\d,.]+)\s*(million|billion)/gi)];
  if (usdMatches.length) {
    const [, rawValue, unit] = usdMatches[0];
    return {
      currency: "USD",
      chartable: true,
      croreValue: null,
      usdMillionValue: parseNumber(rawValue) * (unit.toLowerCase() === "billion" ? 1000 : 1),
      parseNote: `Parsed USD ${unit.toLowerCase()} amount as USD million.`,
    };
  }

  if (lower.includes("undisclosed") || lower.includes("not disclosed")) {
    return excluded("Excluded because the financial amount is undisclosed.");
  }

  return excluded("Excluded because no chartable INR crore or USD amount was found.");
}

function inrAmount(croreValue, parseNote) {
  return {
    currency: "INR",
    chartable: true,
    croreValue,
    usdMillionValue: null,
    parseNote,
  };
}

function parseNumber(value) {
  return Number(String(value).replace(/,/g, ""));
}

function columnLetters(columnCount) {
  let value = Math.max(1, Number(columnCount) || 1);
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}
