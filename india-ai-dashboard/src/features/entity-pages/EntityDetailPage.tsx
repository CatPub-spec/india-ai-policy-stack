import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import type { EntitySummary } from "@/services/dashboardData";

const ENTITY_LABELS: Record<EntitySummary["kind"], string> = {
  state: "State",
  company: "Company",
  "sector-type": "Sector type",
  sector: "Sector",
  policy: "Policy",
  "investment-period": "Investment period",
};

const USD_MILLION_TO_INR_CRORE = 8.3;

export function EntityDetailPage({ entity }: { entity: EntitySummary }) {
  const label = ENTITY_LABELS[entity.kind];
  const path = pathForEntity(entity);
  const title = entity.kind === "sector-type" ? industryLabel(entity.title) : entity.title;
  const totalInr = entity.records.reduce((sum, record) => sum + recordInrCrore(record), 0);
  const totalUsd = entity.records.reduce((sum, record) => sum + recordUsdMillion(record), 0);
  const states = rankRecordLabels(entity.records, (record) => record.state);
  const industries = rankRecordLabels(entity.records, (record) => industryLabel(record.industry));
  const capabilities = [...new Set(entity.records.map((record) => record.capability))].sort();
  const showIndustries = entity.kind === "investment-period" || entity.kind === "sector";

  return (
    <main className="entity-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: `${title} - ${siteConfig.shortName}`,
          description: entity.description,
          url: absoluteUrl(path),
          keywords: [label, "India AI", "AI investments", "AI policy"],
        }}
      />
      <nav className="entity-nav" aria-label="Page navigation">
        <Link className="entity-brand" href="/">
          <Image src="/tsr-logo.png" alt="TSR Lab" width={146} height={48} priority />
          <span>India AI Policy Stack</span>
        </Link>
        <div>
          <Link href="/#explore">Explore data</Link>
          <Link href="/#evidence">Sources</Link>
        </div>
      </nav>

      <section className="entity-masthead">
        <Link className="entity-back-link" href="/">
          Back to dashboard
        </Link>
        <div className="entity-kicker-row">
          <span>{label}</span>
          <span>{entity.records.length} announcements</span>
        </div>
        <h1>{title}</h1>
        <p>{entity.description}</p>
        <div className="entity-stat-grid" aria-label="Summary statistics">
          <article>
            <span>Tracked value</span>
            <strong>{formatInrCrore(totalInr)}</strong>
            <small>{formatUsdMillion(totalUsd)}</small>
          </article>
          <article>
            <span>States</span>
            <strong>{states.length}</strong>
            <small>{summarizeLabels(states, "No states")}</small>
          </article>
          <article>
            <span>{showIndustries ? "Industries" : "Capabilities"}</span>
            <strong>{showIndustries ? industries.length : capabilities.length}</strong>
            <small>
              {showIndustries
                ? summarizeLabels(industries, "No industries")
                : summarizeLabels(capabilities, "No capabilities")}
            </small>
          </article>
        </div>
      </section>

      <section className="entity-records" aria-labelledby="entity-records-title">
        <div className="entity-section-heading">
          <span>Source-backed records</span>
          <h2 id="entity-records-title">Announcements included on this page</h2>
          <p>Each row links back to the original source used in the dashboard.</p>
        </div>
        <div className="entity-table-wrap">
          <table className="entity-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>State</th>
                <th>Organization</th>
                <th>Industry</th>
                <th>Capability</th>
                <th>Investment</th>
              </tr>
            </thead>
            <tbody>
              {entity.records.map((record) => (
                <tr key={record.id}>
                  <td>{record.year}</td>
                  <td>{record.state}</td>
                  <td>
                    <strong>{record.organization}</strong>
                    <span>{record.initiative}</span>
                  </td>
                  <td>{industryLabel(record.industry)}</td>
                  <td>{record.capability}</td>
                  <td>
                    <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                      {record.investmentBrought || record.amount.parseNote}
                      <span>{sourcePublisher(record.sourceUrl)}</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function pathForEntity(entity: EntitySummary): string {
  if (entity.kind === "state") return `/states/${entity.slug}`;
  if (entity.kind === "company") return `/companies/${entity.slug}`;
  if (entity.kind === "sector-type") return `/sector-types/${entity.slug}`;
  if (entity.kind === "sector") return `/sectors/${entity.slug}`;
  if (entity.kind === "policy") return `/policies/${entity.slug}`;
  return `/investments/${entity.slug}`;
}

function industryLabel(value: string): string {
  return value.replace(/\s*Domain$/i, "");
}

function rankRecordLabels(
  records: EntitySummary["records"],
  getLabel: (record: EntitySummary["records"][number]) => string,
): string[] {
  const totals = new Map<string, { value: number; count: number }>();
  records.forEach((record) => {
    const label = getLabel(record);
    const current = totals.get(label) || { value: 0, count: 0 };
    totals.set(label, { value: current.value + recordInrCrore(record), count: current.count + 1 });
  });
  return [...totals.entries()]
    .sort((a, b) => b[1].value - a[1].value || b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([label]) => label);
}

function summarizeLabels(labels: string[], emptyLabel: string): string {
  if (!labels.length) return emptyLabel;
  const visible = labels.slice(0, 3).join(", ");
  const remaining = labels.length - 3;
  return remaining > 0 ? `${visible} and ${remaining} others` : visible;
}

function recordInrCrore(record: EntitySummary["records"][number]): number {
  if (typeof record.amount.croreValue === "number") return record.amount.croreValue;
  if (typeof record.amount.usdMillionValue === "number") return record.amount.usdMillionValue * USD_MILLION_TO_INR_CRORE;
  return 0;
}

function recordUsdMillion(record: EntitySummary["records"][number]): number {
  if (typeof record.amount.usdMillionValue === "number") return record.amount.usdMillionValue;
  if (typeof record.amount.croreValue === "number") return record.amount.croreValue / USD_MILLION_TO_INR_CRORE;
  return 0;
}

function formatInrCrore(value: number): string {
  if (value >= 100000) return `₹${Math.round(value / 100000).toLocaleString("en-IN")} lakh crore`;
  if (value >= 1000) return `₹${Math.round(value).toLocaleString("en-IN")} crore`;
  return `₹${Number(value.toFixed(value >= 100 ? 0 : 1)).toLocaleString("en-IN")} crore`;
}

function formatUsdMillion(value: number): string {
  if (value >= 1000) return `$${Number((value / 1000).toFixed(1)).toLocaleString("en-IN")}B equivalent`;
  return `$${Number(value.toFixed(value >= 100 ? 0 : 1)).toLocaleString("en-IN")}M equivalent`;
}

function sourcePublisher(sourceUrl: string): string {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\.|^m\./, "");
    const publishers: Record<string, string> = {
      "timesofindia.indiatimes.com": "The Times of India",
      "economictimes.com": "The Economic Times",
      "economictimes.indiatimes.com": "The Economic Times",
      "hindustantimes.com": "Hindustan Times",
      "pib.gov.in": "Press Information Bureau",
      "test.uniindia.com": "United News of India",
      "uniindia.com": "United News of India",
      "haryanacmoffice.gov.in": "Haryana CMO",
      "home.iitd.ac.in": "IIT Delhi",
      "ddnews.gov.in": "DD News",
      "thehindu.com": "The Hindu",
      "tomshardware.com": "Tom's Hardware",
    };
    return publishers[host] || host;
  } catch {
    return "Source";
  }
}
