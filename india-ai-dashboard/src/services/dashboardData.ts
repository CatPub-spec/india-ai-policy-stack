import datasetJson from "../../data/dashboard.v1.json";
import type { DashboardDataset, InstitutionRelationship, InvestmentRecord } from "@/types/dashboard";
import { slugify } from "@/lib/slugs";

export type EntityKind = "state" | "company" | "sector-type" | "sector" | "policy" | "investment-period";

type LegacyInvestmentRecord = Omit<InvestmentRecord, "majorPlayers" | "institutionRelationships"> & {
  majorPlayers?: unknown;
  "Major Players"?: unknown;
  institutionRelationships?: unknown;
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
  return groupInstitutionRecords(dataset.records);
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
  const institutionRelationships = normalizeInstitutionRelationships(record.institutionRelationships);
  const majorPlayers = dedupeLabels([
    ...normalizeMajorPlayers(record.majorPlayers ?? record["Major Players"], record.organization),
    ...institutionRelationships.flatMap((relationship) => [relationship.source, relationship.target]),
  ]);

  return {
    ...record,
    industry,
    capability,
    majorPlayers,
    institutionRelationships,
  } as InvestmentRecord;
}

function normalizeInstitutionRelationships(value: unknown): InstitutionRelationship[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value.flatMap<InstitutionRelationship>((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const relationship = candidate as Partial<InstitutionRelationship>;
    const source = normalizeInstitutionLabel(String(relationship.source || ""));
    const target = normalizeInstitutionLabel(String(relationship.target || ""));
    if (!source || !target || source.toLocaleLowerCase("en-IN") === target.toLocaleLowerCase("en-IN")) return [];
    const key = [source, target].map((label) => label.toLocaleLowerCase("en-IN")).sort().join("\u0000");
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      source,
      target,
      relationship: String(relationship.relationship || "Direct relationship").trim(),
      detail: String(relationship.detail || "Named together as direct counterparties in the cited source.").trim(),
      ...(relationship.sourceUrl ? { sourceUrl: String(relationship.sourceUrl).trim() } : {}),
    }];
  });
}

function normalizeMajorPlayers(value: unknown, organization: string): string[] {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const players = rawValues.flatMap((rawValue) =>
    typeof rawValue === "string" ? rawValue.split(/\s*;\s*|[\r\n]+/g) : [],
  );
  const normalized = dedupeLabels(players.map(normalizeInstitutionLabel).filter(Boolean));
  if (normalized.length) return normalized;

  const fallback = normalizeInstitutionLabel(organization);
  return fallback ? [fallback] : [];
}

function normalizeInstitutionLabel(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/^;+|;+$/g, "")
    .trim();
}

function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = label.toLocaleLowerCase("en-IN");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function groupInstitutionRecords(records: InvestmentRecord[]): EntitySummary[] {
  const groups = new Map<
    string,
    { title: string; titlePriority: number; records: Map<string, InvestmentRecord> }
  >();

  records.forEach((record) => {
    const majorPlayers = normalizeMajorPlayers(
      (record as InvestmentRecord & { majorPlayers?: unknown }).majorPlayers,
      record.organization,
    );
    const candidates = [
      ...majorPlayers.map((title) => ({ title, priority: 0 })),
      { title: normalizeInstitutionLabel(record.organization), priority: 1 },
    ];
    const seenRecordSlugs = new Set<string>();

    candidates.forEach(({ title, priority }) => {
      const slug = slugify(title);
      if (!title || !slug || seenRecordSlugs.has(slug)) return;
      seenRecordSlugs.add(slug);

      const existing = groups.get(slug);
      if (!existing) {
        groups.set(slug, {
          title,
          titlePriority: priority,
          records: new Map([[record.id, record]]),
        });
        return;
      }

      existing.records.set(record.id, record);
      if (
        priority < existing.titlePriority ||
        (priority === existing.titlePriority && title.localeCompare(existing.title, "en-IN") < 0)
      ) {
        existing.title = title;
        existing.titlePriority = priority;
      }
    });
  });

  return [...groups.entries()]
    .map(([slug, group]) => {
      const groupedRecords = [...group.records.values()];
      return {
        kind: "company" as const,
        slug,
        title: group.title,
        records: groupedRecords,
        description: `${group.title} is listed as an institution or major player in ${groupedRecords.length} verified India AI development announcements.`,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "en-IN") || a.slug.localeCompare(b.slug));
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
