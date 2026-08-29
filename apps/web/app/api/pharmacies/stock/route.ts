import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getMockPharmacyStock,
  updateMockStockQuantity,
  addMockStockItem,
  deriveStockStatus,
} from "@/lib/mockDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pharmacyId = searchParams.get("pharmacy_id") || undefined;

    if (db) {
      try {
        let query = db.from("stock_items").select("*");
        if (pharmacyId) {
          query = query.eq("pharmacy_id", pharmacyId);
        }
        const { data, error } = await query.order("medicine_name", { ascending: true });
        if (!error && data && data.length > 0) {
          return NextResponse.json(data);
        }
      } catch (err) {
        console.warn("Supabase query failed, falling back to mock stock:", err);
      }
    }

    const stock = getMockPharmacyStock(pharmacyId);
    return NextResponse.json(stock);
  } catch (error) {
    console.error("GET /api/pharmacies/stock error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pharmacy stock", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { stock_item_id, quantity } = body;

    if (!stock_item_id || quantity === undefined) {
      return NextResponse.json(
        { error: "stock_item_id and quantity are required" },
        { status: 400 },
      );
    }

    if (db) {
      try {
        // stock_items.status is generated in Postgres, so we only update quantity
        const { data, error } = await db
          .from("stock_items")
          .update({ quantity })
          .eq("stock_item_id", stock_item_id)
          .select()
          .single();

        if (!error && data) {
          // Sync mock
          try {
            updateMockStockQuantity(stock_item_id, quantity);
          } catch {
            // ignore
          }
          return NextResponse.json({ success: true, item: data });
        }
      } catch (err) {
        console.warn("Supabase stock update failed, falling back to mock:", err);
      }
    }

    const updated = updateMockStockQuantity(stock_item_id, quantity);
    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("PATCH /api/pharmacies/stock error:", error);
    return NextResponse.json(
      { error: "Failed to update stock", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pharmacy_id, medicine_name, quantity } = body;

    if (!pharmacy_id || !medicine_name) {
      return NextResponse.json(
        { error: "pharmacy_id and medicine_name are required" },
        { status: 400 },
      );
    }

    const qty = quantity !== undefined ? Number(quantity) : 100;

    if (db) {
      try {
        const itemId = `stk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const { data, error } = await db
          .from("stock_items")
          .insert({
            stock_item_id: itemId,
            pharmacy_id,
            medicine_name,
            quantity: qty,
          })
          .select()
          .single();

        if (!error && data) {
          try {
            addMockStockItem(pharmacy_id, medicine_name, qty);
          } catch {
            // ignore
          }
          return NextResponse.json({ success: true, item: data });
        }
      } catch (err) {
        console.warn("Supabase stock insert failed, falling back to mock:", err);
      }
    }

    const newItem = addMockStockItem(pharmacy_id, medicine_name, qty);
    return NextResponse.json({ success: true, item: newItem });
  } catch (error) {
    console.error("POST /api/pharmacies/stock error:", error);
    return NextResponse.json(
      { error: "Failed to add stock item", details: (error as Error).message },
      { status: 500 },
    );
  }
}
