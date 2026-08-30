import { getDistrictSummaries } from "@/data/districts";
import { AnalyticsViewHub } from "@/components/AnalyticsViewHub";

export const revalidate = 0;

export default async function AnalyticsDashboardPage() {
  const districts = await getDistrictSummaries();
  return <AnalyticsViewHub districts={districts} />;
}

