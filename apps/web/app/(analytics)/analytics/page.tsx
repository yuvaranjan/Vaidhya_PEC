import { db } from "@/lib/db";
import { generateMockAnalyticsRows, CaseRow } from "@/lib/mockAnalytics";
import { getDistrictSummaries } from "@/data/districts";
import { AnalyticsViewHub } from "@/components/AnalyticsViewHub";

export const revalidate = 0;

export default async function AnalyticsDashboardPage() {
  const districts = await getDistrictSummaries();

  let rows: CaseRow[] = [];
  let isMock = false;

  if (db) {
    try {
      const { data, error } = await db
        .from("regional_case_counts")
        .select("region_id,disease_category,week_start_date,case_count,rolling_baseline,is_anomaly")
        .order("week_start_date", { ascending: true });

      if (!error && data && data.length > 0) {
        rows = data as CaseRow[];
      } else {
        isMock = true;
        rows = generateMockAnalyticsRows();
      }
    } catch (err) {
      isMock = true;
      rows = generateMockAnalyticsRows();
    }
  } else {
    isMock = true;
    rows = generateMockAnalyticsRows();
  }

  return <AnalyticsViewHub districts={districts} rows={rows} isMock={isMock} />;
}

