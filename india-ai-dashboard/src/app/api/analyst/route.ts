import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessageStreamWriter,
} from "ai";
import { NextResponse } from "next/server";

import type { MetricMode } from "@/dashboard-data/investmentDataset";
import { buildAnalystPackage, buildAnalystSystemPrompt } from "@/services/analyst";
import { getDashboardDataset } from "@/services/dashboardData";
import type {
  AnalystAnswerMode,
  AnalystMessage,
} from "@/types/analyst";

export const maxDuration = 60;

type AnalystRequest = {
  messages?: unknown;
  metric?: unknown;
};

export async function POST(request: Request) {
  let payload: AnalystRequest;
  try {
    payload = (await request.json()) as AnalystRequest;
  } catch {
    return NextResponse.json({ error: "The analyst request was not valid JSON." }, { status: 400 });
  }

  const messages = sanitizeMessages(payload.messages);
  const question = latestUserQuestion(messages);
  if (!question) {
    return NextResponse.json({ error: "Please enter a question for the analyst." }, { status: 400 });
  }

  const metric = parseMetric(payload.metric);
  const records = getDashboardDataset().records;
  const analystPackage = buildAnalystPackage(question, records, metric);
  const answerMode = chooseAnswerMode();
  const modelMessages = await convertToModelMessages(messages.slice(-8));
  const system = buildAnalystSystemPrompt(analystPackage.context, answerMode.endsWith("-web"));

  const stream = createUIMessageStream<AnalystMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      if (answerMode === "ledger") {
        writeLocalAnswer(writer, analystPackage.localAnswer);
        return;
      }

      const commonOptions = {
        system,
        messages: modelMessages,
        abortSignal: request.signal,
        timeout: { totalMs: 50_000, chunkMs: 18_000 },
        maxOutputTokens: 900,
        temperature: 0.2,
      } as const;

      if (answerMode === "google-web") {
        const result = streamText({
          ...commonOptions,
          model: google(process.env.ANALYST_GOOGLE_MODEL || "gemini-2.5-flash"),
          tools: {
            google_search: google.tools.googleSearch({}),
          },
          stopWhen: stepCountIs(4),
        });
        writer.merge(
          result.toUIMessageStream<AnalystMessage>({
            sendReasoning: false,
            sendSources: false,
            onError: analystStreamError,
          }),
        );
        return;
      }

      if (answerMode === "openai-web" || answerMode === "gateway-web") {
        const result = streamText({
          ...commonOptions,
          model: answerMode === "openai-web"
            ? openai(process.env.OPENAI_ANALYST_MODEL || "gpt-5.6")
            : process.env.ANALYST_AI_MODEL || "openai/gpt-5.4",
          tools: {
            web_search: openai.tools.webSearch({}),
          },
          stopWhen: stepCountIs(4),
        });
        writer.merge(
          result.toUIMessageStream<AnalystMessage>({
            sendReasoning: false,
            sendSources: false,
            onError: analystStreamError,
          }),
        );
        return;
      }

      const model = answerMode === "openai"
        ? openai(process.env.OPENAI_ANALYST_MODEL || "gpt-5.6")
        : answerMode === "google"
          ? google(process.env.ANALYST_GOOGLE_MODEL || "gemini-2.5-flash")
          : process.env.ANALYST_AI_MODEL || "openai/gpt-5.4";
      const result = streamText({ ...commonOptions, model });
      writer.merge(
        result.toUIMessageStream<AnalystMessage>({
          sendReasoning: false,
          sendSources: false,
          onError: analystStreamError,
        }),
      );
    },
    onError: analystStreamError,
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "Cache-Control": "no-store",
      "X-Analyst-Mode": answerMode,
    },
  });
}

function sanitizeMessages(input: unknown): AnalystMessage[] {
  if (!Array.isArray(input)) return [];

  return input.slice(-10).flatMap<AnalystMessage>((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const message = candidate as { id?: unknown; role?: unknown; parts?: unknown };
    if (message.role !== "user" && message.role !== "assistant") return [];
    if (!Array.isArray(message.parts)) return [];
    const parts = message.parts.flatMap<{ type: "text"; text: string }>((part) => {
      if (!part || typeof part !== "object") return [];
      const textPart = part as { type?: unknown; text?: unknown };
      if (textPart.type !== "text" || typeof textPart.text !== "string") return [];
      const text = textPart.text.trim().slice(0, 4_000);
      return text ? [{ type: "text", text }] : [];
    });
    if (!parts.length) return [];
    return [{
      id: typeof message.id === "string" && message.id ? message.id : `analyst-message-${index}`,
      role: message.role,
      parts,
    }];
  });
}

function latestUserQuestion(messages: AnalystMessage[]): string {
  const message = [...messages].reverse().find((candidate) => candidate.role === "user");
  if (!message) return "";
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
    .slice(0, 1_200);
}

function parseMetric(value: unknown): MetricMode {
  return value === "records" || value === "usd" || value === "inr" ? value : "inr";
}

function chooseAnswerMode(): AnalystAnswerMode {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google-web";
  if (process.env.OPENAI_API_KEY) return "openai-web";
  if (process.env.AI_GATEWAY_API_KEY) return "gateway-web";
  return "ledger";
}

function writeLocalAnswer(
  writer: UIMessageStreamWriter<AnalystMessage>,
  answer: string,
) {
  const id = "analyst-answer";
  writer.write({ type: "text-start", id });
  chunkText(answer, 150).forEach((delta) => writer.write({ type: "text-delta", id, delta }));
  writer.write({ type: "text-end", id });
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) chunks.push(text.slice(index, index + size));
  return chunks.length ? chunks : [text];
}

function analystStreamError(error: unknown): string {
  console.error("Ask the Analyst provider stream failed.", error);
  return "The analyst could not finish this answer. Please try again.";
}
