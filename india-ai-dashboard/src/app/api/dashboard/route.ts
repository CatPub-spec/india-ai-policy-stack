import { NextResponse } from "next/server";

import { getDashboardDataset } from "@/services/dashboardData";

export const revalidate = 86400;

export async function GET() {
  return NextResponse.json(getDashboardDataset(), {
    headers: { "x-data-source": "generated-json-service" },
  });
}
