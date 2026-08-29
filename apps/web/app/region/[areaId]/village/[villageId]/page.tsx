import { notFound } from 'next/navigation';
import { getVillageDetail, getAllVillageStaticParams } from '@/data/villages';
import { LiveVillageDetailView } from '@/components/LiveVillageDetailView';

/** Generate static params for all known villages */
export async function generateStaticParams() {
  return getAllVillageStaticParams();
}

/** Dynamic metadata per village */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ areaId: string; villageId: string }>;
}) {
  const { areaId, villageId } = await params;
  const detail = await getVillageDetail(areaId, villageId);
  if (!detail) return { title: 'Village Not Found — VaidhyaPredict' };
  return {
    title: `${detail.summary.name} (${detail.districtName}) — VaidhyaPredict`,
    description: `Village-level patient vitals surveillance, physician root causes, and epidemiological insight for ${detail.summary.name}.`,
  };
}

export default async function VillageDetailPage({
  params,
}: {
  params: Promise<{ areaId: string; villageId: string }>;
}) {
  const { areaId, villageId } = await params;
  const detail = await getVillageDetail(areaId, villageId);

  if (!detail) {
    notFound();
  }

  return <LiveVillageDetailView initialDetail={detail} areaId={areaId} />;
}
