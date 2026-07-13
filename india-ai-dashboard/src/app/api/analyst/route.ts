import { NextResponse } from "next/server";

import { formatMetricValue, metricLabel, type InvestmentRecord, type MetricMode } from "@/dashboard-data/investmentDataset";
import { getDashboardDataset } from "@/services/dashboardData";

type AnalystRequestRecord = Pick<
  InvestmentRecord,
  "year" | "state" | "organization" | "initiative" | "industry" | "capability" | "investmentBrought" | "amount"
>;

type AnalystRequest = {
  question?: string;
  metric?: MetricMode;
};

type AnalystResponse = {
  answer: string;
  evidence: string[];
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ fallback: true, error: "OPENAI_API_KEY is not configured." });
  }

  const payload = (await request.json()) as AnalystRequest;
  const question = String(payload.question || "").trim();
  const metric = payload.metric || "inr";

  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const datasetRecords = getDashboardDataset().records.slice(0, 80);
  const total = datasetRecords.reduce((sum, record) => sum + valueForMetric(record, metric), 0);
  const context = {
    question,
    metric: metricLabel(metric),
    dataset: {
      records: datasetRecords.length,
      fullDatasetCommitment: formatMetricValue(total, metric),
    },
    records: datasetRecords.map((record) => ({
      year: record.year,
      state: record.state,
      organization: record.organization,
      industry: record.industry,
      capability: record.capability,
      commitment: record.investmentBrought,
      metricValue: formatMetricValue(valueForMetric(record, metric), metric),
      initiative: record.initiative,
    })),
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ANALYST_MODEL || "gpt-5.6",
      reasoning: { effort: "low" },
      instructions:
        "You are a careful India AI policy data analyst. Answer only from the provided full-dataset records, independent of any visible dashboard filters. Be concise, thoughtful, and source-grounded. Return strict JSON with keys answer and evidence. The answer should be 2-3 sentences. Evidence should contain 2-4 short bullets with concrete numbers, states, organizations, industries, capabilities, or years. If the records do not answer the question, say what is missing.",
      input: JSON.stringify(context),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json({ fallback: true, error: errorText || "OpenAI request failed." });
  }

  const data = await response.json();
  const text = extractResponseText(data);
  const parsed = parseAnalystResponse(text);

  return NextResponse.json(parsed);
}

function valueForMetric(record: AnalystRequestRecord, metric: MetricMode): number {
  if (metric === "records") return 1;
  if (metric === "usd") return record.amount.usdMillionValue || 0;
  return record.amount.croreValue || 0;
}

function extractResponseText(data: unknown): string {
  if (isRecord(data) && typeof data.output_text === "string") return data.output_text;
  if (!isRecord(data) || !Array.isArray(data.output)) return "";

  return data.output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => (isRecord(content) && typeof content.text === "string" ? content.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseAnalystResponse(text: string): AnalystResponse {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;
  try {
    const parsed = JSON.parse(jsonText) as Partial<AnalystResponse>;
    return {
      answer: String(parsed.answer || "I could not generate a clear analyst answer from the full dataset."),
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(String).slice(0, 4) : [],
    };
  } catch {
    return {
      answer: text || "I could not generate a clear analyst answer from the full dataset.",
      evidence: [],
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
