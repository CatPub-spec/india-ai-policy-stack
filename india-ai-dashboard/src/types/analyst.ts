import type { UIMessage } from "ai";

export type AnalystAnswerMode =
  | "ledger"
  | "openai"
  | "openai-web"
  | "google"
  | "google-web"
  | "gateway"
  | "gateway-web";

export type AnalystSource = {
  id: string;
  title: string;
  url: string;
  state: string;
  year: number;
  summary: string;
};

export type AnalystMessage = UIMessage;
