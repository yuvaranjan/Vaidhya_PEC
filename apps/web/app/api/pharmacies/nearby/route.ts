import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getMockNearbyPharmacies,
  haversineDistanceKm,
  StockStatus,
  MedicineStockCheck,
} from "@/lib/mockDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const prescriptionId = searchParams.get("prescription_id") || "rx_seed_001";
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const radiusParam = searchParams.get("radius_km");

    const defaultRadius = process.env.NEARBY_RADIUS_KM
      ? parseFloat(process.env.NEARBY_RADIUS_KM)
      : 30;
    const maxRadiusKm = radiusParam ? parseFloat(radiusParam) : defaultRadius;

    const customOrigin =
      latParam && lngParam
        ? { lat: parseFloat(latParam), lng: parseFloat(lngParam) }
        : undefined;

    // Try Supabase if available
    if (db) {
      try {
        // `prescriptions` has no foreign key to `patients` — the path is
        // prescriptions → visits → patients. Embedding patients directly made
        // PostgREST reject the whole query, and the catch below turned that
        // into a silent fall back to mock data: real pharmacies, but the
        // mock's medicine list and queue state.
        const { data: rx, error: rxError } = await db
          .from("prescriptions")
          .select("*, visits(patient_id, patients(home_jurisdiction_id))")
          .eq("prescription_id", prescriptionId)
          .maybeSingle();

        if (rxError) {
          console.error("[nearby] prescription lookup failed:", rxError.message);
        }

        if (!rxError && rx) {
          let originLat = 10.5276;
          let originLng = 76.2144;

          if (customOrigin) {
            originLat = customOrigin.lat;
            originLng = customOrigin.lng;
          } else if (rx.visits?.patients?.home_jurisdiction_id) {
            const { data: jur } = await db
              .from("jurisdictions")
              .select("latitude, longitude")
              .eq("jurisdiction_id", rx.visits.patients.home_jurisdiction_id)
              .maybeSingle();
            if (jur) {
              originLat = jur.latitude;
              originLng = jur.longitude;
            }
          }

          const { data: pharmacies, error: phaError } = await db
            .from("pharmacies")
            .select("*, stock_items(*)");

          if (!phaError && pharmacies && pharmacies.length > 0) {
            const medications: Array<{ name: string; dosage?: string; duration?: string; instructions?: string }> =
              Array.isArray(rx.medications) ? rx.medications : [];

            const { data: queueRows } = await db
              .from("pharmacy_queue")
              .select("pharmacy_id")
              .eq("prescription_id", prescriptionId);

            const queuedPharmacyIds = new Set(queueRows?.map((q) => q.pharmacy_id) || []);

            const results = pharmacies.map((pharmacy) => {
              const distance = haversineDistanceKm(
                originLat,
                originLng,
                pharmacy.latitude || originLat,
                pharmacy.longitude || originLng,
              );

              const stockItems: Array<{ medicine_name: string; quantity: number; status: StockStatus }> =
                pharmacy.stock_items || [];

              const medicineChecks: MedicineStockCheck[] = medications.map((med) => {
                const stock = stockItems.find(
                  (s) =>
                    s.medicine_name.toLowerCase().includes(med.name.toLowerCase().split(" ")[0]),
                );
                const quantity = stock ? stock.quantity : 0;
                const status: StockStatus = stock
                  ? (stock.status as StockStatus)
                  : quantity === 0
                    ? "out_of_stock"
                    : quantity < 10
                      ? "low"
                      : "in_stock";

                return {
                  name: med.name,
                  status,
                  quantity,
                  dosage: med.dosage,
                  duration: med.duration,
                  instructions: med.instructions,
                };
              });

              const allInStock = medicineChecks.every((m) => m.status === "in_stock");
              const hasOutOfStock = medicineChecks.some((m) => m.status === "out_of_stock");
              const inQueue =
                queuedPharmacyIds.has(pharmacy.pharmacy_id) ||
                rx.pharmacy_id === pharmacy.pharmacy_id;

              return {
                pharmacy_id: pharmacy.pharmacy_id,
                name: pharmacy.name,
                location: pharmacy.location,
                phone_number: pharmacy.phone_number,
                jurisdiction_id: pharmacy.jurisdiction_id,
                latitude: pharmacy.latitude,
                longitude: pharmacy.longitude,
                distance_km: distance,
                medicines: medicineChecks,
                all_in_stock: allInStock,
                has_out_of_stock: hasOutOfStock,
                in_queue: inQueue,
              };
            });

            const filtered = maxRadiusKm > 0 ? results.filter((p) => p.distance_km <= maxRadiusKm) : results;
            return NextResponse.json(filtered.sort((a, b) => a.distance_km - b.distance_km));
          }
        }
      } catch (err) {
        console.warn("Supabase query failed, falling back to mock data:", err);
      }
    }

    const results = getMockNearbyPharmacies(prescriptionId, customOrigin, maxRadiusKm);
    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/pharmacies/nearby error:", error);
    return NextResponse.json(
      { error: "Failed to fetch nearby pharmacies", details: (error as Error).message },
      { status: 500 },
    );
  }
}
