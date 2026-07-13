import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";
import { getCompanies, getInvestmentPeriods, getPolicies, getSectors, getStates } from "@/services/dashboardData";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    "/",
    ...getStates().map((entity) => `/states/${entity.slug}`),
    ...getCompanies().map((entity) => `/companies/${entity.slug}`),
    ...getSectors().map((entity) => `/sectors/${entity.slug}`),
    ...getPolicies().map((entity) => `/policies/${entity.slug}`),
    ...getInvestmentPeriods().map((entity) => `/investments/${entity.slug}`),
  ];

  return paths.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}

