import datasetJson from "../../data/dashboard.v1.json";
import type { DashboardDataset, InvestmentRecord } from "@/types/dashboard";
import { slugify } from "@/lib/slugs";

export type EntityKind = "state" | "company" | "sector-type" | "sector" | "policy" | "investment-period";

type LegacyInvestmentRecord = InvestmentRecord & {
  domain?: string;
  subdomain?: string;
};

export type EntitySummary = {
  kind: EntityKind;
  slug: string;
  title: string;
  description: string;
  records: InvestmentRecord[];
};

const dataset = normalizeDashboardDataset(datasetJson as unknown as DashboardDataset);

export function getDashboardDataset(): DashboardDataset {
  return dataset;
}

export function getInvestments(filters: { state?: string; industry?: string; capability?: string; year?: number } = {}): InvestmentRecord[] {
  return dataset.records.filter((record) => {
    if (filters.state && record.state !== filters.state) return false;
    if (filters.industry && record.industry !== filters.industry) return false;
    if (filters.capability && record.capability !== filters.capability) return false;
    if (typeof filters.year === "number" && record.year !== filters.year) return false;
    return true;
  });
}

export function getStates(): EntitySummary[] {
  return groupRecords("state", dataset.records, (record) => record.state, (title, records) => ({
    description: `${records.length} verified AI development announcements for ${title}.`,
  }));
}

export function getCompanies(): EntitySummary[] {
  return groupRecords("company", dataset.records, (record) => record.organization, (title, records) => ({
    description: `${title} appears in ${records.length} verified India AI development announcements.`,
  }));
}

export function getSectors(): EntitySummary[] {
  return groupRecords("sector", dataset.records, (record) => record.capability || record.industry, (title, records) => ({
    description: `${records.length} verified announcements in ${title} across Indian states.`,
  }));
}

export function getSectorTypes(): EntitySummary[] {
  return groupRecords("sector-type", dataset.records, (record) => record.industry, (title, records) => ({
    description: `${records.length} verified announcements classified as ${formatSectorType(title)} sector activity.`,
  }));
}

export function getPolicies(): EntitySummary[] {
  const policyRecords = dataset.records.filter((record) => /policy|mission|scheme|budget|allocation|cabinet/i.test([record.initiative, record.investmentType].join(" ")));
  return policyRecords.map((record) => ({
    kind: "policy",
    slug: slugify(record.initiative || record.id),
    title: record.initiative,
    description: `${record.state} policy and public investment intelligence for ${record.organization}.`,
    records: [record],
  }));
}

export function getInvestmentPeriods(): EntitySummary[] {
  return groupRecords("investment-period", dataset.records, (record) => String(record.year), (title, records) => ({
    description: `${records.length} verified AI investment and development announcements in ${title}.`,
  }));
}

export function findEntity(kind: EntityKind, slug: string): EntitySummary | undefined {
  return getEntities(kind).find((entity) => entity.slug === slug);
}

export function getEntities(kind: EntityKind): EntitySummary[] {
  if (kind === "state") return getStates();
  if (kind === "company") return getCompanies();
  if (kind === "sector-type") return getSectorTypes();
  if (kind === "sector") return getSectors();
  if (kind === "policy") return getPolicies();
  return getInvestmentPeriods();
}

function normalizeDashboardDataset(rawDataset: DashboardDataset): DashboardDataset {
  return {
    ...rawDataset,
    records: rawDataset.records.map((record) => normalizeInvestmentRecord(record as LegacyInvestmentRecord)),
  };
}

function normalizeInvestmentRecord(record: LegacyInvestmentRecord): InvestmentRecord {
  const industry = pickValue(
    "Technology & Innovation",
    (record as unknown as { industry?: string; Industry?: string }).industry,
    (record as unknown as { industry?: string; Industry?: string }).Industry,
    record.domain,
    inferIndustry(record),
  );
  const capability = pickValue(
    "Emerging AI Capability",
    (record as unknown as { capability?: string; Capability?: string }).capability,
    (record as unknown as { capability?: string; Capability?: string }).Capability,
    record.subdomain,
    inferCapability(record),
  );

  return {
    ...record,
    industry,
    capability,
  };
}

function pickValue(fallback: string, ...values: Array<string | undefined>): string {
  return values.map((value) => String(value || "").trim()).find(Boolean) || fallback;
}

function inferIndustry(record: LegacyInvestmentRecord): string {
  const haystack = [record.initiative, record.investmentDomain, record.technologyUse, record.investmentType, record.organization]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/health|medical|biotech|hospital|care/i.test(haystack)) return "Healthcare";
  if (/data centre|data center|cloud|compute|infrastructure|digital infra|server/i.test(haystack)) return "Technology Infrastructure";
  if (/education|school|university|skill|training|curriculum/i.test(haystack)) return "Education & Skilling";
  if (/police|public safety|surveillance|governance|civic|city|urban|government/i.test(haystack)) return "Government & Public Services";
  if (/agri|agriculture|farm|food/i.test(haystack)) return "Agriculture";
  if (/defence|defense|aerospace|space|military/i.test(haystack)) return "Defence & Aerospace";
  if (/manufactur|industrial|electronics|semiconductor|chip|fab/i.test(haystack)) return "Manufacturing & Electronics";
  if (/transport|mobility|traffic|road|rail/i.test(haystack)) return "Transportation";
  if (/fintech|finance|bank|insurance/i.test(haystack)) return "Finance";
  if (/marketing|advertis|video content|video generation|brand communication|customer communication/i.test(haystack)) return "Marketing & Advertising";
  if (/startup|innovation|incubator|ecosystem|coe/i.test(haystack)) return "Startups & Innovation";
  return "Technology & Innovation";
}

function inferCapability(record: LegacyInvestmentRecord): string {
  const haystack = [record.initiative, record.investmentDomain, record.technologyUse, record.investmentType, record.organization]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/cloud|compute|data centre|data center|infrastructure/i.test(haystack)) return "Cloud & Compute";
  if (/skill|training|education|school|university/i.test(haystack)) return "AI Talent & Skilling";
  if (/surveillance|safety|police|public safety|c4i|city/i.test(haystack)) return "AI Applications";
  if (/startup|innovation|incubator|ecosystem|coe/i.test(haystack)) return "Startup & Innovation Ecosystem";
  if (/governance|policy|strategy|public service/i.test(haystack)) return "AI Strategy & Governance";
  if (/semiconductor|electronics|manufacturing|chip|fab/i.test(haystack)) return "Semiconductor & Electronics";
  if (/health|medical|biotech|diagnostic|care/i.test(haystack)) return "AI Applications";
  if (/research|model|genai|analytics|data/i.test(haystack)) return "AI Research & Innovation";
  return "Emerging AI Capability";
}

function formatSectorType(value: string): string {
  return value.replace(/\s*Domain$/i, "").toLowerCase();
}

function groupRecords(
  kind: EntityKind,
  records: InvestmentRecord[],
  getTitle: (record: InvestmentRecord) => string,
  getMetadata: (title: string, records: InvestmentRecord[]) => Pick<EntitySummary, "description">,
): EntitySummary[] {
  const groups = new Map<string, InvestmentRecord[]>();
  records.forEach((record) => {
    const title = getTitle(record);
    groups.set(title, [...(groups.get(title) || []), record]);
  });

  return [...groups.entries()]
    .map(([title, groupRecords]) => ({
      kind,
      slug: slugify(title),
      title,
      records: groupRecords,
      ...getMetadata(title, groupRecords),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
