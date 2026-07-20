export const STATE_ORDER = [
  "Andhra Pradesh",
  "Delhi",
  "Gujarat",
  "Haryana",
  "Karnataka",
  "Kerala",
  "Maharashtra",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
] as const;

export type MetricMode = "records" | "inr" | "usd";
export type CurrencyCode = "INR" | "USD";

export interface ParsedAmount {
  currency: CurrencyCode | null;
  chartable: boolean;
  croreValue: number | null;
  usdMillionValue: number | null;
  parseNote: string;
}

export interface InstitutionRelationship {
  source: string;
  target: string;
  relationship: string;
  detail: string;
  sourceUrl?: string;
}

export interface InvestmentRecord {
  id: string;
  year: number;
  state: string;
  location: string;
  organization: string;
  majorPlayers: string[];
  institutionRelationships?: InstitutionRelationship[];
  initiative: string;
  industry: string;
  capability: string;
  investmentDomain: string;
  investmentBrought: string;
  investmentType: string;
  technologyUse: string;
  sourceSummary: string;
  sourceUrl: string;
  amount: ParsedAmount;
}

export interface DashboardDataset {
  metadata: {
    title: string;
    sourceSpreadsheetId: string;
    sourceSpreadsheetUrl: string;
    sourceSheet: string;
    sourceRange: string;
    generatedAt: string;
    recordCount: number;
    amountPolicy: string;
  };
  records: InvestmentRecord[];
}

export interface ChartDatum {
  name: string;
  value: number;
  records: InvestmentRecord[];
}

export function canonicalState(location: string): string {
  return String(location).split("/")[0].trim();
}

export function parseInvestmentAmount(input: string): ParsedAmount {
  const text = String(input || "").trim();
  const lower = text.toLowerCase();
  const excluded = (note: string): ParsedAmount => ({
    currency: null,
    chartable: false,
    croreValue: null,
    usdMillionValue: null,
    parseNote: note,
  });

  if (!text) return excluded("No amount text was provided.");
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
  if (lower.includes("policy package") && !/\u20b9\s*[\d,.]+\s*(?:lakh\s*)?crore/i.test(text)) {
    return excluded("Excluded because the accessible source does not publish a separate AI outlay.");
  }

  const lakhCroreMatch = text.match(/\u20b9\s*([\d,.]+)\s*lakh\s*crore/i);
  if (lakhCroreMatch) {
    return inrAmount(parseNumber(lakhCroreMatch[1]) * 100000, "Parsed INR lakh crore amount.");
  }

  const totalCroreMatch = text.match(/\u20b9\s*([\d,.]+)\s*crore\s*total/i);
  if (totalCroreMatch) {
    return inrAmount(parseNumber(totalCroreMatch[1]), "Parsed explicit INR total amount.");
  }

  const limitCroreMatch = text.match(/(?:limit|allocation limit)\s*\u20b9\s*([\d,.]+)\s*crore/i);
  if (limitCroreMatch) {
    return inrAmount(parseNumber(limitCroreMatch[1]), "Parsed INR allocation limit.");
  }

  const croreRangeMatch = text.match(/\u20b9\s*([\d,.]+)\s*(?:crore\s*)?(?:-|to)\s*\u20b9?\s*[\d,.]+\s*crore/i);
  if (croreRangeMatch) {
    return inrAmount(parseNumber(croreRangeMatch[1]), "Parsed lower bound of INR crore range.");
  }

  const croreMatches = [...text.matchAll(/\u20b9\s*([\d,.]+)\s*crore/gi)].map((match) => parseNumber(match[1]));
  if (croreMatches.length) {
    const value =
      /\+/.test(text) && croreMatches.length > 1
        ? Number(croreMatches.reduce((sum, amount) => sum + amount, 0).toFixed(2))
        : croreMatches[0];
    return inrAmount(value, /\+/.test(text) ? "Computed sum of explicit INR crore amounts." : "Parsed INR crore amount.");
  }

  const usdMatches = [...text.matchAll(/\$\s*([\d,.]+)\s*(million|billion)/gi)];
  if (usdMatches.length) {
    const [, rawValue, unit] = usdMatches[0];
    const value = parseNumber(rawValue) * (unit.toLowerCase() === "billion" ? 1000 : 1);
    return {
      currency: "USD",
      chartable: true,
      croreValue: null,
      usdMillionValue: value,
      parseNote: `Parsed USD ${unit.toLowerCase()} amount as USD million.`,
    };
  }

  if (lower.includes("undisclosed") || lower.includes("not disclosed")) {
    return excluded("Excluded because the financial amount is undisclosed.");
  }

  return excluded("Excluded because no chartable INR crore or USD amount was found.");
}

export function metricLabel(metric: MetricMode): string {
  if (metric === "inr") return "INR crore";
  if (metric === "usd") return "USD million";
  return "Records";
}

export function valueForMetric(record: InvestmentRecord, metric: MetricMode): number {
  if (metric === "records") return 1;
  if (metric === "inr") return record.amount.currency === "INR" && record.amount.chartable ? record.amount.croreValue || 0 : 0;
  return record.amount.currency === "USD" && record.amount.chartable ? record.amount.usdMillionValue || 0 : 0;
}

export const USD_MILLION_TO_INR_CRORE = 8.3;

export function convertedValueForMetric(record: InvestmentRecord, metric: MetricMode): number {
  if (metric === "records") return 1;
  if (!record.amount.chartable || !record.amount.currency) return 0;
  if (metric === "inr") {
    return record.amount.currency === "INR"
      ? record.amount.croreValue || 0
      : (record.amount.usdMillionValue || 0) * USD_MILLION_TO_INR_CRORE;
  }
  return record.amount.currency === "USD"
    ? record.amount.usdMillionValue || 0
    : (record.amount.croreValue || 0) / USD_MILLION_TO_INR_CRORE;
}

export function formatMetricValue(value: number, metric: MetricMode): string {
  const formatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 });
  if (metric === "inr") return `INR ${formatter.format(value)} cr`;
  if (metric === "usd") return `$${formatter.format(value)}M`;
  return formatter.format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1, notation: "compact" }).format(value);
}

export function groupByMetric(records: InvestmentRecord[], metric: MetricMode, getKey: (record: InvestmentRecord) => string): ChartDatum[] {
  const groups = new Map<string, InvestmentRecord[]>();
  records.forEach((record) => {
    const key = getKey(record);
    groups.set(key, [...(groups.get(key) || []), record]);
  });

  return [...groups.entries()]
    .map(([name, groupRecords]) => ({
      name,
      records: groupRecords,
      value: groupRecords.reduce((sum, record) => sum + valueForMetric(record, metric), 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => {
    const aIndex = STATE_ORDER.indexOf(a as (typeof STATE_ORDER)[number]);
    const bIndex = STATE_ORDER.indexOf(b as (typeof STATE_ORDER)[number]);
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    return a.localeCompare(b);
  });
}

function parseNumber(value: string): number {
  return Number(String(value).replace(/,/g, ""));
}

function inrAmount(croreValue: number, parseNote: string): ParsedAmount {
  return {
    currency: "INR",
    chartable: true,
    croreValue,
    usdMillionValue: null,
    parseNote,
  };
}
