"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Package,
  ListOrdered,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw,
  Receipt,
  User,
  Clock,
  Pill,
  Printer,
  Check,
} from "lucide-react";
import {
  StockItem,
  PharmacyQueueEntry,
  StockStatus,
  SEED_PHARMACIES,
} from "@/lib/mockDb";

interface PharmacistPortalProps {
  initialTab?: "queue" | "stock";
  initialPharmacyId?: string;
}

export function PharmacistPortal({
  initialTab = "queue",
  initialPharmacyId = "pha_001",
}: PharmacistPortalProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "stock">(initialTab);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>(initialPharmacyId);
  const [queue, setQueue] = useState<PharmacyQueueEntry[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<PharmacyQueueEntry | null>(null);

  // New stock item modal / form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMedName, setNewMedName] = useState("");
  const [newMedQty, setNewMedQty] = useState(50);

  const selectedPharmacy =
    SEED_PHARMACIES.find((p) => p.pharmacy_id === selectedPharmacyId) || SEED_PHARMACIES[0];

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Queue
      const queueRes = await fetch(`/api/pharmacies/queue?pharmacy_id=${selectedPharmacyId}`);
      if (queueRes.ok) {
        const qData = await queueRes.json();
        setQueue(qData);
      }

      // 2. Load Stock
      const stockRes = await fetch(`/api/pharmacies/stock?pharmacy_id=${selectedPharmacyId}`);
      if (stockRes.ok) {
        const sData = await stockRes.json();
        setStock(sData);
      }
    } catch (err) {
      console.error("Failed to load pharmacy data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPharmacyId]);

  // Handle Quick Quantity Change
  const handleQuantityUpdate = async (stockItemId: string, newQty: number) => {
    setUpdatingId(stockItemId);
    try {
      const res = await fetch("/api/pharmacies/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_item_id: stockItemId, quantity: Math.max(0, newQty) }),
      });
      if (res.ok) {
        setStock((prev) =>
          prev.map((item) =>
            item.stock_item_id === stockItemId
              ? {
                  ...item,
                  quantity: Math.max(0, newQty),
                  status:
                    newQty === 0
                      ? "out_of_stock"
                      : newQty < 10
                        ? "low"
                        : "in_stock",
                }
              : item,
          ),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Add New Stock Item
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;

    try {
      const res = await fetch("/api/pharmacies/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pharmacy_id: selectedPharmacyId,
          medicine_name: newMedName.trim(),
          quantity: newMedQty,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStock((prev) => [...prev, data.item]);
        setNewMedName("");
        setShowAddModal(false);
      }
    } catch (err) {
      console.error("Error adding medicine:", err);
    }
  };

  // Handle Dispense & Fulfill Queue Entry
  const handleFulfillQueue = async (entryId: string) => {
    setUpdatingId(entryId);
    try {
      const res = await fetch("/api/pharmacies/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId, status: "fulfilled" }),
      });

      if (res.ok) {
        setQueue((prev) =>
          prev.map((q) =>
            q.entry_id === entryId ? { ...q, status: "fulfilled", fulfilled_at: new Date().toISOString() } : q,
          ),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredStock = stock.filter((item) =>
    item.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderStockBadge = (status: StockStatus, quantity: number) => {
    switch (status) {
      case "in_stock":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E5F5F3] text-[#14736A] border border-[#2B9C95]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2B9C95]"></span>
            In Stock ({quantity})
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FCD34D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>
            Low Stock ({quantity} left)
          </span>
        );
      case "out_of_stock":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC4D57] border border-[#FCA5A5]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DC4D57]"></span>
            Out of Stock (0)
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-5 sm:p-8 space-y-6">
      {/* Header & Pharmacy Switcher */}
      <div className="bg-card rounded-xl border border-[#DCE7EA] p-5 sm:p-8 shadow-[0_5px_18px_rgba(15,45,64,0.045)] mb-7 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2B9C95] block mb-1">
            Vaidhya Pharmacy Network · Node Management
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.025em] text-[#173449] flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-[#2B9C95]" />
            {selectedPharmacy.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#6D7F8C] mt-1">
            Location: {selectedPharmacy.location} · Helpline: {selectedPharmacy.phone_number}
          </p>
        </div>

        {/* Pharmacy Node Switcher */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label htmlFor="pharmacy-select" className="text-xs font-semibold text-[#6D7F8C] shrink-0">
            Switch Node:
          </label>
          <select
            id="pharmacy-select"
            value={selectedPharmacyId}
            onChange={(e) => setSelectedPharmacyId(e.target.value)}
            className="h-10 px-3.5 rounded-lg border border-[#DCE7EA] bg-[#F7FAFB] text-[#173449] text-sm font-semibold focus:ring-2 focus:ring-[#2B9C95] focus:outline-none cursor-pointer"
          >
            {SEED_PHARMACIES.map((p) => (
              <option key={p.pharmacy_id} value={p.pharmacy_id}>
                {p.name} ({p.location.split("(")[0]})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Segmented Controls / Tab Bar */}
      <div className="inline-flex rounded-lg bg-[#EEF6F6] p-1 border border-[#DCE7EA]">
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "queue"
              ? "bg-card text-[#173F59] shadow-sm"
              : "text-[#6D7F8C] hover:text-[#173449]"
          }`}
        >
          <ListOrdered className="w-4 h-4 text-[#2B9C95]" />
          Incoming Dispensing Queue
          {queue.filter((q) => q.status === "pending").length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "queue" ? "bg-[#2B9C95] text-white" : "bg-[#2B9C95]/20 text-[#14736A]"
              }`}
            >
              {queue.filter((q) => q.status === "pending").length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "stock"
              ? "bg-card text-[#173F59] shadow-sm"
              : "text-[#6D7F8C] hover:text-[#173449]"
          }`}
        >
          <Package className="w-4 h-4 text-[#2B9C95]" />
          Inventory Management ({stock.length})
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="rounded-xl border border-[#DCE7EA] bg-card p-12 text-center shadow-[0_5px_18px_rgba(15,45,64,0.045)]">
          <div className="inline-block animate-spin rounded-full h-9 w-9 border-[3px] border-[#2B9C95] border-t-transparent mb-4"></div>
          <p className="text-[#6D7F8C] font-medium text-sm">Loading live pharmacy records...</p>
        </div>
      ) : activeTab === "queue" ? (
        /* ================================================================= */
        /* TAB 1: INCOMING DISPENSING QUEUE                                  */
        /* ================================================================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-[#173449]">
              Prescriptions Routed to {selectedPharmacy.name}
            </h2>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#DCE7EA] bg-[#FBFCFD] text-xs font-semibold text-[#6D7F8C] hover:text-[#173449] hover:bg-[#EEF6F6] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#2B9C95]" /> Refresh Queue
            </button>
          </div>

          {queue.length === 0 ? (
            <div className="rounded-xl border border-[#DCE7EA] bg-card p-10 text-center text-[#6D7F8C] shadow-[0_5px_18px_rgba(15,45,64,0.045)]">
              <ListOrdered className="w-10 h-10 mx-auto mb-2 text-[#2B9C95]/40" />
              <p className="font-bold text-[#173449] text-base">No prescriptions in queue</p>
              <p className="text-xs text-[#6D7F8C] mt-1">
                Prescriptions routed by patients via the patient portal will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {queue.map((entry) => {
                const rx = entry.prescription;
                const isFulfilled = entry.status === "fulfilled";

                return (
                  <div
                    key={entry.entry_id}
                    className={`rounded-xl border bg-card p-5 sm:p-6 transition-all shadow-[0_5px_18px_rgba(15,45,64,0.045)] ${
                      isFulfilled
                        ? "border-[#DCE7EA]/80 opacity-80"
                        : "border-[#2B9C95]/50 ring-2 ring-[#2B9C95]/10"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#DCE7EA] pb-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-base text-[#173449]">
                            Rx #{entry.prescription_id}
                          </span>
                          {isFulfilled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E5F5F3] text-[#14736A] border border-[#2B9C95]/30">
                              <Check className="w-3 h-3 text-[#2B9C95]" /> Dispensed & Fulfilled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FCD34D]">
                              <Clock className="w-3 h-3" /> Pending Dispensing
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#6D7F8C] mt-1">
                          Received: {new Date(entry.created_at).toLocaleTimeString("en-IN")} · Visit ID:{" "}
                          {rx?.visit_id || "vis_seed_001"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 w-full md:w-auto">
                        <button
                          onClick={() => setActiveReceipt(entry)}
                          className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg border border-[#DCE7EA] bg-[#FBFCFD] hover:bg-[#EEF6F6] text-[#173449] text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Receipt className="w-4 h-4 text-[#2B9C95]" />
                          View Bill / Receipt
                        </button>

                        {!isFulfilled ? (
                          <button
                            onClick={() => handleFulfillQueue(entry.entry_id)}
                            disabled={updatingId === entry.entry_id}
                            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg bg-[#2B9C95] hover:bg-[#2B9C95]/90 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {updatingId === entry.entry_id ? "Dispensing..." : "Dispense & Fulfill"}
                          </button>
                        ) : (
                          <span className="text-xs text-[#6D7F8C] font-semibold px-3 py-2 bg-[#F4F7F8] rounded-lg border border-[#DCE7EA]">
                            Completed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Patient and Doctor details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3.5 text-xs">
                      <div className="flex items-start gap-2.5">
                        <User className="w-4 h-4 text-[#2B9C95] mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold text-[#173449]">
                            {rx?.patient_name || "Anjali Menon"} ({rx?.patient_age || 34} Y /{" "}
                            {rx?.patient_sex || "F"})
                          </span>
                          <p className="text-[#6D7F8C] mt-0.5">
                            Phone: {rx?.patient_phone || "+91 9000000001"} · ID: {rx?.patient_id || "pat_001"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 sm:border-l sm:border-[#DCE7EA] sm:pl-4">
                        <Pill className="w-4 h-4 text-[#2B9C95] mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold text-[#173449]">
                            Doctor: {rx?.doctor_name || "Dr. Priya Varghese"}
                          </span>
                          <p className="text-[#6D7F8C] mt-0.5">{rx?.doctor_specialty || "MBBS, General Medicine"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Medications Table */}
                    <div className="mt-2 pt-3 border-t border-[#DCE7EA]">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6D7F8C] block mb-2">
                        Prescribed Items to Dispense:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {(rx?.medications || []).map((med, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-[#DCE7EA] bg-[#F4F7F8] text-xs space-y-1"
                          >
                            <p className="font-bold text-[#173449]">{med.name}</p>
                            <p className="text-[#6D7F8C]">Dosage: {med.dosage}</p>
                            <p className="text-[#6D7F8C]">Duration: {med.duration}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================================================================= */
        /* TAB 2: INVENTORY & STOCK MANAGEMENT CRUD                          */
        /* ================================================================= */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-[#DCE7EA] shadow-[0_5px_18px_rgba(15,45,64,0.045)]">
            {/* Search Input with internal icon */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6D7F8C] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search inventory (e.g., Paracetamol, Amoxicillin)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-lg border border-[#DCE7EA] bg-[#F7FAFB] text-sm text-[#173449] focus:ring-2 focus:ring-[#2B9C95] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#173F59] hover:bg-[#173F59]/90 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Medicine
              </button>
            </div>
          </div>

          {/* Stock Items Table */}
          <div className="rounded-xl border border-[#DCE7EA] bg-card overflow-hidden shadow-[0_5px_18px_rgba(15,45,64,0.045)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#EEF6F6]/80 border-b border-[#DCE7EA] text-xs font-semibold text-[#6D7F8C]">
                    <th className="py-3 px-4">Medicine Name</th>
                    <th className="py-3 px-4">Current Stock</th>
                    <th className="py-3 px-4">Stock Status</th>
                    <th className="py-3 px-4 text-right">Quick Stock Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE7EA]">
                  {filteredStock.map((item) => {
                    const isUpdating = updatingId === item.stock_item_id;

                    return (
                      <tr key={item.stock_item_id} className="hover:bg-[#F4F7F8] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#173449]">
                          {item.medicine_name}
                          <p className="text-[11px] font-mono text-[#6D7F8C] font-normal">
                            ID: {item.stock_item_id}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-base text-[#173449]">{item.quantity}</span> units
                        </td>
                        <td className="py-3.5 px-4">{renderStockBadge(item.status, item.quantity)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleQuantityUpdate(item.stock_item_id, item.quantity - 10)}
                              disabled={isUpdating || item.quantity <= 0}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[#DCE7EA] hover:bg-[#FEF2F2] text-[#173449] hover:text-[#DC4D57] disabled:opacity-30 transition-colors cursor-pointer"
                              title="Decrease 10"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleQuantityUpdate(item.stock_item_id, item.quantity + 10)}
                              disabled={isUpdating}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[#DCE7EA] hover:bg-[#EEF6F6] text-[#173449] hover:text-[#2B9C95] disabled:opacity-30 transition-colors cursor-pointer"
                              title="Increase 10"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {item.quantity === 0 && (
                              <button
                                onClick={() => handleQuantityUpdate(item.stock_item_id, 50)}
                                disabled={isUpdating}
                                className="ml-2 h-8 px-3 rounded-lg bg-[#E5F5F3] hover:bg-[#2B9C95] hover:text-white text-[#14736A] text-xs font-semibold transition-colors cursor-pointer border border-[#2B9C95]/30"
                              >
                                Restock (50)
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Medicine */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-xl border border-[#DCE7EA] p-6 max-w-md w-full shadow-[0_5px_18px_rgba(15,45,64,0.045)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE7EA] pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2B9C95] block">
                  Inventory Creation
                </span>
                <h3 className="text-lg font-bold text-[#173449] flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#2B9C95]" />
                  Add Medicine
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#6D7F8C] hover:text-[#173449] font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStock} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#173449] mb-1">Medicine Name & Strength</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cetirizine 10mg, Azithromycin 500mg"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#DCE7EA] bg-[#F7FAFB] text-sm text-[#173449] focus:ring-2 focus:ring-[#2B9C95] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173449] mb-1">Initial Quantity (Units)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newMedQty}
                  onChange={(e) => setNewMedQty(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-[#DCE7EA] bg-[#F7FAFB] text-sm text-[#173449] focus:ring-2 focus:ring-[#2B9C95] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-10 px-4 rounded-lg border border-[#DCE7EA] text-xs font-semibold text-[#6D7F8C] hover:text-[#173449] hover:bg-[#EEF6F6] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-[#2B9C95] hover:bg-[#2B9C95]/90 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bill / Receipt */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-xl border border-[#DCE7EA] p-6 max-w-lg w-full shadow-[0_5px_18px_rgba(15,45,64,0.045)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE7EA] pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2B9C95] block">
                  Official GST Billing Receipt
                </span>
                <h3 className="text-lg font-bold text-[#173449]">{selectedPharmacy.name}</h3>
              </div>
              <button
                onClick={() => setActiveReceipt(null)}
                className="text-[#6D7F8C] hover:text-[#173449] font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6D7F8C]">Patient Name:</span>
                <span className="font-bold text-[#173449]">
                  {activeReceipt.prescription?.patient_name || "Anjali Menon"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6D7F8C]">Prescription ID:</span>
                <span className="font-mono text-[#173449]">{activeReceipt.prescription_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6D7F8C]">Date of Issue:</span>
                <span className="text-[#173449]">{new Date().toLocaleDateString("en-IN")}</span>
              </div>
            </div>

            {/* Bill Table */}
            <div className="border border-[#DCE7EA] rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#EEF6F6]/80 border-b border-[#DCE7EA] font-semibold text-[#6D7F8C]">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5">Qty / Duration</th>
                    <th className="p-2.5 text-right">Price (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE7EA]">
                  {(activeReceipt.prescription?.medications || []).map((m, i) => (
                    <tr key={i} className="hover:bg-[#F4F7F8]">
                      <td className="p-2.5 font-bold text-[#173449]">{m.name}</td>
                      <td className="p-2.5 text-[#6D7F8C]">{m.duration}</td>
                      <td className="p-2.5 text-right font-medium text-[#173449]">₹45.00</td>
                    </tr>
                  ))}
                  <tr className="bg-[#EEF6F6]/60 font-bold">
                    <td className="p-2.5 text-[#173449]" colSpan={2}>
                      Total (Subsidized Telemedicine Rate)
                    </td>
                    <td className="p-2.5 text-right text-[#14736A]">₹135.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#DCE7EA] text-xs font-semibold text-[#173449] hover:bg-[#EEF6F6] transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#2B9C95]" /> Print Receipt
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="h-10 px-5 rounded-lg bg-[#2B9C95] hover:bg-[#2B9C95]/90 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
