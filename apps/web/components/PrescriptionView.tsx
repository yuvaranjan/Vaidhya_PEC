"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  Phone,
  User,
  Stethoscope,
  Pill,
  Send,
  Building2,
  Check,
  Info,
  Truck,
  FileText,
  Calendar,
  ShieldCheck,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  Prescription,
  NearbyPharmacyResult,
  StockStatus,
} from "@/lib/mockDb";

interface PrescriptionViewProps {
  initialPrescriptionId?: string;
}

export function PrescriptionView({
  initialPrescriptionId = "rx_seed_001",
}: PrescriptionViewProps) {
  const [prescriptionId] = useState(initialPrescriptionId);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [pharmacies, setPharmacies] = useState<NearbyPharmacyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [routingPharmacyId, setRoutingPharmacyId] = useState<string | null>(null);
  const [routedSuccess, setRoutedSuccess] = useState<{
    pharmacyName: string;
    message: string;
    isDelivery?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Delivery Modal state (v5 §188 / arch §11.1 item 4)
  const [deliveryPharmacy, setDeliveryPharmacy] = useState<NearbyPharmacyResult | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("House #14, Thrissur PHC Ward, Kerala 680001");
  const [deliveryPhone, setDeliveryPhone] = useState("+91 9000000001");
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  // Load prescription and nearby pharmacies
  const loadData = async (rxId: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch prescription
      const rxRes = await fetch(`/api/pharmacies/prescription?id=${encodeURIComponent(rxId)}`);
      if (!rxRes.ok) throw new Error("Failed to load prescription");
      const rxData: Prescription = await rxRes.json();
      setPrescription(rxData);
      if (rxData.patient_phone) setDeliveryPhone(rxData.patient_phone);

      // 2. Fetch nearby pharmacies with per-medicine stock
      const phaRes = await fetch(`/api/pharmacies/nearby?prescription_id=${encodeURIComponent(rxId)}`);
      if (!phaRes.ok) throw new Error("Failed to load nearby pharmacies");
      const phaData: NearbyPharmacyResult[] = await phaRes.json();
      setPharmacies(phaData);

      // Check if already routed
      if (rxData.pharmacy_id) {
        const matched = phaData.find((p) => p.pharmacy_id === rxData.pharmacy_id);
        if (matched) {
          setRoutedSuccess({
            pharmacyName: matched.name,
            message: `Prescription currently queued at ${matched.name}.`,
          });
        }
      }
    } catch (err) {
      console.error(err);
      setError((err as Error).message || "An error occurred while loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(prescriptionId);
  }, [prescriptionId]);

  // Handle Pick-up Routing
  const handleRouteToPharmacy = async (pharmacy: NearbyPharmacyResult) => {
    setRoutingPharmacyId(pharmacy.pharmacy_id);
    try {
      const res = await fetch("/api/pharmacies/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescription_id: prescriptionId,
          pharmacy_id: pharmacy.pharmacy_id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to route prescription");
      }

      setRoutedSuccess({
        pharmacyName: pharmacy.name,
        message: `Successfully routed to ${pharmacy.name}. It is now waiting in their dispensing counter queue for in-person pickup.`,
        isDelivery: false,
      });

      await loadData(prescriptionId);
    } catch (err) {
      alert(`Error routing prescription: ${(err as Error).message}`);
    } finally {
      setRoutingPharmacyId(null);
    }
  };

  // Handle Simulated Home Delivery (v5 §188)
  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryPharmacy) return;
    setIsSubmittingDelivery(true);

    try {
      const res = await fetch("/api/pharmacies/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescription_id: prescriptionId,
          pharmacy_id: deliveryPharmacy.pharmacy_id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to schedule home delivery");
      }

      setRoutedSuccess({
        pharmacyName: deliveryPharmacy.name,
        message: `Home delivery dispatched with ${deliveryPharmacy.name}! Estimated delivery: 45 minutes to ${deliveryAddress}.`,
        isDelivery: true,
      });

      setDeliveryPharmacy(null);
      await loadData(prescriptionId);
    } catch (err) {
      alert(`Error scheduling delivery: ${(err as Error).message}`);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return new Date().toLocaleDateString("en-IN", { dateStyle: "medium" });
    try {
      return new Date(isoString).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const renderStockBadge = (status: StockStatus, quantity: number) => {
    switch (status) {
      case "in_stock":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E5F5F3] text-[#14736A] border border-[#2B9C95]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2B9C95]"></span>
            In Stock ({quantity})
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FCD34D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>
            Low Stock ({quantity} left)
          </span>
        );
      case "out_of_stock":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC4D57] border border-[#FCA5A5]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DC4D57]"></span>
            Out of Stock
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-5 sm:p-8 space-y-6">
        <div className="rounded-xl border border-[#DCE7EA] bg-card p-12 text-center shadow-[0_5px_18px_rgba(15,45,64,0.045)]">
          <div className="inline-block animate-spin rounded-full h-9 w-9 border-[3px] border-[#2B9C95] border-t-transparent mb-4"></div>
          <p className="text-[#6D7F8C] font-medium text-sm">Loading prescription and live pharmacy stock data...</p>
        </div>
      </div>
    );
  }

  if (error || !prescription) {
    return (
      <div className="max-w-5xl mx-auto p-5 sm:p-8 space-y-6">
        <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-6 text-[#DC4D57] shadow-[0_5px_18px_rgba(15,45,64,0.045)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5" /> Unable to load prescription
          </h2>
          <p className="mt-2 text-sm text-[#DC4D57]/90">{error || "Prescription record not found."}</p>
          <button
            onClick={() => loadData(prescriptionId)}
            className="mt-4 px-4 py-2 bg-[#DC4D57] text-white rounded-lg text-sm font-semibold hover:bg-[#DC4D57]/90 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-5 sm:p-8 space-y-6">
      {/* Top Banner / Actions (Hidden during print) */}
      <div className="no-print bg-card p-5 sm:p-8 rounded-xl border border-[#DCE7EA] shadow-[0_5px_18px_rgba(15,45,64,0.045)] mb-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          {/* Eyebrow */}
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2B9C95] block mb-1">
            Project Vaidhya · Patient Delivery Channel
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.025em] text-[#173449]">
            Prescription & Fulfillment
          </h1>
          <p className="text-sm text-[#6D7F8C] mt-1">
            Prescription ID: <span className="font-mono text-[#173449] font-semibold">{prescription.prescription_id}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[#DCE7EA] bg-[#FBFCFD] hover:bg-[#EEF6F6] text-[#173449] font-semibold text-sm transition-colors cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4 text-[#2B9C95]" />
            Print / PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#173F59] hover:bg-[#173F59]/90 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {/* Confirmation Banner if routed */}
      {routedSuccess && (
        <div className="no-print rounded-xl border border-[#2B9C95]/40 bg-[#E5F5F3] p-5 flex items-start gap-3.5 shadow-[0_5px_18px_rgba(15,45,64,0.045)]">
          {routedSuccess.isDelivery ? (
            <div className="p-2 rounded-lg bg-[#2B9C95] text-white">
              <Truck className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-[#2B9C95] text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-bold text-[#14736A] text-base">
              {routedSuccess.isDelivery ? "Home Delivery Scheduled" : `Prescription Queued at ${routedSuccess.pharmacyName}`}
            </h3>
            <p className="text-xs sm:text-sm text-[#14736A]/90 mt-0.5 leading-relaxed">
              {routedSuccess.message} Patient ID:{" "}
              <span className="font-mono font-semibold">{prescription.patient_id}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Printable Clinical Prescription Card */}
      <div
        id="printable-prescription"
        className="rounded-xl border border-[#DCE7EA] bg-card p-6 sm:p-8 space-y-7 shadow-[0_5px_18px_rgba(15,45,64,0.045)]"
      >
        {/* Clinic & Provider Header */}
        <div className="border-b border-[#DCE7EA] pb-6 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#173F59] flex items-center justify-center text-white font-bold text-xl shadow-sm">
              <span className="text-[#2B9C95]">V</span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2B9C95] block">
                Primary Health Network
              </span>
              <h2 className="text-xl font-bold tracking-tight text-[#173449]">
                Project Vaidhya Clinic
              </h2>
              <p className="text-xs text-[#6D7F8C]">Thrissur Rural PHC · Telemedicine & Edge-AI Node A</p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-[#6D7F8C] space-y-0.5">
            <p className="font-semibold text-[#173449] text-sm">Official Clinical Prescription</p>
            <p>Issued: {formatDate(prescription.issued_at)}</p>
            <p className="font-mono text-xs">Visit ID: {prescription.visit_id}</p>
          </div>
        </div>

        {/* Patient & Doctor Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#EEF6F6]/60 p-5 rounded-xl border border-[#DCE7EA] text-sm">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2B9C95] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#2B9C95]" /> Patient Record
            </span>
            <p className="font-bold text-[#173449] text-base">{prescription.patient_name || "Anjali Menon"}</p>
            <p className="text-xs text-[#6D7F8C]">
              Age / Sex: <strong className="text-[#173449]">{prescription.patient_age || 34} Y</strong> /{" "}
              <strong className="text-[#173449]">{prescription.patient_sex || "Female"}</strong> · Phone:{" "}
              {prescription.patient_phone || "+91 9000000001"}
            </p>
            <p className="text-xs font-mono text-[#6D7F8C]">Patient ID: {prescription.patient_id}</p>
          </div>

          <div className="space-y-1.5 sm:border-l sm:border-[#DCE7EA] sm:pl-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2B9C95] flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-[#2B9C95]" /> Prescribing Medical Officer
            </span>
            <p className="font-bold text-[#173449] text-base">{prescription.doctor_name || "Dr. Priya Varghese"}</p>
            <p className="text-xs text-[#6D7F8C]">{prescription.doctor_specialty || "MBBS, General Medicine"}</p>
            <p className="text-xs text-[#6D7F8C]">License / Reg: {prescription.doctor_id}</p>
          </div>
        </div>

        {/* Prescribed Medications Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#173449] flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#2B9C95]" /> Prescribed Medications ({prescription.medications.length})
            </h3>
            <span className="text-xs text-[#6D7F8C] hidden sm:inline">Take strictly as instructed by physician</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#DCE7EA]">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#EEF6F6]/80 border-b border-[#DCE7EA] text-xs font-semibold text-[#6D7F8C]">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Medicine & Strength</th>
                  <th className="py-3 px-4">Dosage / Frequency</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Special Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7EA]">
                {prescription.medications.map((med, idx) => (
                  <tr key={idx} className="hover:bg-[#F4F7F8] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-[#6D7F8C]">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-[#173449]">{med.name}</td>
                    <td className="py-3.5 px-4 font-medium text-[#173449]">{med.dosage}</td>
                    <td className="py-3.5 px-4 font-medium text-[#173449]">{med.duration}</td>
                    <td className="py-3.5 px-4 text-xs text-[#6D7F8C] leading-relaxed">{med.instructions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Clinical Advice & Doctor Stamp */}
        <div className="border-t border-[#DCE7EA] pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-5 text-xs text-[#6D7F8C]">
          <div className="space-y-1.5 max-w-lg">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#173449] block">
              Clinical Advice & Follow-Up
            </span>
            <p className="leading-relaxed">
              {prescription.follow_up_requested
                ? "• Follow-up review scheduled in 48-72 hours. Patient will receive automated status check."
                : "• Follow up if fever, symptoms, or discomfort persist beyond 3 days."}
            </p>
            <p className="leading-relaxed">
              • In case of acute adverse reaction or shortness of breath, report to the nearest emergency ward.
            </p>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-[#DCE7EA] w-full sm:w-auto">
            <div className="inline-block p-3 rounded-xl border border-[#2B9C95]/40 bg-[#E5F5F3] text-center mb-1.5 shadow-sm">
              <p className="font-bold text-[#14736A] text-xs flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2B9C95]" /> Digitally Certified
              </p>
              <p className="text-[11px] text-[#6D7F8C] mt-0.5">{prescription.doctor_name}</p>
            </div>
            <p className="text-[11px] text-[#6D7F8C]">Vaidhya Node Central · Authenticated</p>
          </div>
        </div>
      </div>

      {/* Nearby Pharmacies & Live Stock Fulfillment (Hidden on print) */}
      <div className="no-print space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2B9C95] block mb-0.5">
              Live Network Inventory
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#173449] flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#2B9C95]" />
              Nearby Pharmacies & Stock Availability
            </h2>
            <p className="text-xs sm:text-sm text-[#6D7F8C] mt-0.5">
              Select an in-stock pharmacy to pick up at counter or request subsidized home delivery.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs bg-card px-3.5 py-2 rounded-lg border border-[#DCE7EA] shadow-sm">
            <span className="flex items-center gap-1.5 text-[#14736A] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#2B9C95]"></span> In Stock
            </span>
            <span className="flex items-center gap-1.5 text-[#D97706] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#D97706]"></span> Low Stock
            </span>
            <span className="flex items-center gap-1.5 text-[#DC4D57] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#DC4D57]"></span> Out of Stock
            </span>
          </div>
        </div>

        {/* Notice on deliberate gap */}
        <div className="rounded-xl border border-[#DCE7EA] bg-card p-4 flex items-start gap-3 text-xs text-[#6D7F8C] shadow-[0_5px_18px_rgba(15,45,64,0.045)]">
          <Info className="w-4 h-4 text-[#2B9C95] mt-0.5 shrink-0" />
          <div>
            <strong className="text-[#173449] font-semibold">Real-Time Inventory Routing: </strong>
            Stock levels are checked live. If a medicine is out of stock at the closest shop (e.g. Paracetamol 500mg at Amala Medicals), the system alerts you so you can choose a shop with all medicines in stock (e.g. Devi Pharmacy or Kerala Medical Store).
          </div>
        </div>

        {/* Pharmacy Cards Grid */}
        <div className="grid grid-cols-1 gap-4">
          {pharmacies.map((pharmacy) => {
            const isRoutedHere =
              prescription.pharmacy_id === pharmacy.pharmacy_id || pharmacy.in_queue;
            const isRoutingThis = routingPharmacyId === pharmacy.pharmacy_id;

            return (
              <div
                key={pharmacy.pharmacy_id}
                className={`rounded-xl border bg-card p-5 sm:p-6 transition-all shadow-[0_5px_18px_rgba(15,45,64,0.045)] ${
                  isRoutedHere
                    ? "border-[#2B9C95] ring-2 ring-[#2B9C95]/20 bg-[#E5F5F3]/30"
                    : pharmacy.all_in_stock
                      ? "border-[#2B9C95]/40 hover:border-[#2B9C95]"
                      : "border-[#DCE7EA] hover:border-[#6D7F8C]/40"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Pharmacy Details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-bold text-[#173449]">{pharmacy.name}</h3>
                      {pharmacy.all_in_stock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E5F5F3] text-[#14736A] border border-[#2B9C95]/30">
                          <Check className="w-3.5 h-3.5 text-[#2B9C95]" /> All Items in Stock
                        </span>
                      ) : pharmacy.has_out_of_stock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC4D57] border border-[#FCA5A5]">
                          <XCircle className="w-3.5 h-3.5 text-[#DC4D57]" /> Incomplete Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FCD34D]">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" /> Low Stock Warning
                        </span>
                      )}

                      {isRoutedHere && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#173F59] text-white shadow-sm">
                          ✓ Currently Queued
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#6D7F8C]">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#2B9C95]" />
                        {pharmacy.location}
                      </span>
                      <span className="font-semibold text-[#173449]">
                        • {pharmacy.distance_km} km away
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#6D7F8C]" />
                        {pharmacy.phone_number}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    {isRoutedHere ? (
                      <button
                        disabled
                        className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-[#E5F5F3] text-[#14736A] font-semibold text-xs sm:text-sm border border-[#2B9C95]/40 cursor-default"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#2B9C95]" />
                        Queued for Dispensing
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setDeliveryPharmacy(pharmacy)}
                          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-[#DCE7EA] bg-[#FBFCFD] hover:bg-[#EEF6F6] text-[#173449] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                          title="Simulate Home Delivery (v5 §188)"
                        >
                          <Truck className="w-4 h-4 text-[#2B9C95]" />
                          Home Delivery
                        </button>

                        <button
                          onClick={() => handleRouteToPharmacy(pharmacy)}
                          disabled={isRoutingThis}
                          className={`inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
                            pharmacy.has_out_of_stock
                              ? "bg-card border border-[#FCA5A5] text-[#DC4D57] hover:bg-[#FEF2F2]"
                              : "bg-[#2B9C95] hover:bg-[#2B9C95]/90 text-white shadow-sm"
                          }`}
                        >
                          {isRoutingThis ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin rounded-full"></div>
                              Routing...
                            </>
                          ) : pharmacy.has_out_of_stock ? (
                            <>
                              <AlertTriangle className="w-4 h-4" />
                              Pick Up (Partial)
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Pick Up at Counter
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Per-Medicine Stock Breakdown */}
                <div className="mt-4 pt-3.5 border-t border-[#DCE7EA]">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6D7F8C] block mb-2">
                    Item-by-Item Availability Check:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {pharmacy.medicines.map((medCheck, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-2 ${
                          medCheck.status === "in_stock"
                            ? "bg-[#E5F5F3]/50 border-[#2B9C95]/30"
                            : medCheck.status === "low"
                              ? "bg-[#FFFBEB]/70 border-[#FCD34D]"
                              : "bg-[#FEF2F2]/70 border-[#FCA5A5]"
                        }`}
                      >
                        <div className="font-bold text-[#173449] truncate" title={medCheck.name}>
                          {medCheck.name}
                        </div>
                        <div>{renderStockBadge(medCheck.status, medCheck.quantity)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Request Home Delivery (v5 §188) */}
      {deliveryPharmacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print">
          <div className="bg-card rounded-xl border border-[#DCE7EA] p-6 max-w-md w-full shadow-[0_5px_18px_rgba(15,45,64,0.045)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCE7EA] pb-3.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2B9C95] block">
                  Home Fulfillment Dispatch
                </span>
                <h3 className="text-lg font-bold text-[#173449] flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#2B9C95]" />
                  Request Home Delivery
                </h3>
              </div>
              <button
                onClick={() => setDeliveryPharmacy(null)}
                className="text-[#6D7F8C] hover:text-[#173449] font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#6D7F8C]">
              Simulated courier coordination from <strong className="text-[#173449]">{deliveryPharmacy.name}</strong> ({deliveryPharmacy.distance_km} km away).
            </p>

            <form onSubmit={handleConfirmDelivery} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#173449] mb-1">Delivery Address</label>
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#DCE7EA] bg-[#F7FAFB] text-xs text-[#173449] focus:ring-2 focus:ring-[#2B9C95] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173449] mb-1">Contact Phone</label>
                <input
                  type="tel"
                  required
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#DCE7EA] bg-[#F7FAFB] text-xs text-[#173449] focus:ring-2 focus:ring-[#2B9C95] focus:outline-none"
                />
              </div>

              <div className="bg-[#EEF6F6] p-3.5 rounded-xl border border-[#DCE7EA] text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#6D7F8C]">Estimated Delivery Time:</span>
                  <span className="font-bold text-[#173449]">~45 minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6D7F8C]">Delivery Fee:</span>
                  <span className="font-bold text-[#14736A]">₹0 (Subsidized Telemedicine Scheme)</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeliveryPharmacy(null)}
                  className="h-10 px-4 rounded-lg border border-[#DCE7EA] text-xs font-semibold text-[#6D7F8C] hover:text-[#173449] hover:bg-[#EEF6F6] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDelivery}
                  className="h-10 px-5 rounded-lg bg-[#2B9C95] hover:bg-[#2B9C95]/90 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  {isSubmittingDelivery ? "Dispatching..." : "Confirm & Dispatch Delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
