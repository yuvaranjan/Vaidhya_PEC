/**
 * Mock database layer for Lane T3 — Prescription Delivery & Pharmacy.
 *
 * Provides in-memory data seeded from db/002_seed.sql so the entire
 * prescription delivery & pharmacy flow works seamlessly even when Supabase is not yet provisioned.
 */

export interface Jurisdiction {
  jurisdiction_id: string;
  name: string;
  latitude: number;
  longitude: number;
  edge_server_id?: string;
}

export interface Patient {
  patient_id: string;
  abha_id: string;
  phone_number: string;
  name: string;
  dob: string;
  age: number;
  sex: string;
  home_jurisdiction_id: string;
}

export interface Doctor {
  doctor_id: string;
  name: string;
  specialty_general: string;
  phone_number: string;
  serves_jurisdiction_ids: string[];
}

export interface PrescriptionMedication {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  prescription_id: string;
  visit_id: string;
  doctor_id: string;
  doctor_name?: string;
  doctor_specialty?: string;
  patient_id: string;
  patient_name?: string;
  patient_age?: number;
  patient_sex?: string;
  patient_phone?: string;
  medications: PrescriptionMedication[];
  follow_up_requested: boolean;
  pharmacy_id: string | null;
  issued_at: string;
}

export interface Pharmacy {
  pharmacy_id: string;
  name: string;
  location: string;
  phone_number: string;
  jurisdiction_id: string;
  latitude: number;
  longitude: number;
}

export type StockStatus = "in_stock" | "low" | "out_of_stock";

export interface StockItem {
  stock_item_id: string;
  pharmacy_id: string;
  medicine_name: string;
  quantity: number;
  status: StockStatus;
}

export interface PharmacyQueueEntry {
  entry_id: string;
  pharmacy_id: string;
  prescription_id: string;
  status: "pending" | "fulfilled";
  created_at: string;
  fulfilled_at?: string;
  prescription?: Prescription;
}

export interface MedicineStockCheck {
  name: string;
  status: StockStatus;
  quantity: number;
  dosage?: string;
  duration?: string;
  instructions?: string;
}

export interface NearbyPharmacyResult {
  pharmacy_id: string;
  name: string;
  location: string;
  phone_number: string;
  jurisdiction_id: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  medicines: MedicineStockCheck[];
  all_in_stock: boolean;
  has_out_of_stock: boolean;
  in_queue: boolean;
}

// =====================================================================
// In-Memory Seed State
// =====================================================================

export const SEED_JURISDICTIONS: Record<string, Jurisdiction> = {
  jur_thrissur_01: {
    jurisdiction_id: "jur_thrissur_01",
    name: "Thrissur Rural PHC",
    latitude: 10.5276,
    longitude: 76.2144,
    edge_server_id: "edge_node_a",
  },
  jur_palakkad_01: {
    jurisdiction_id: "jur_palakkad_01",
    name: "Palakkad Rural PHC",
    latitude: 10.7867,
    longitude: 76.6548,
    edge_server_id: "edge_node_b",
  },
};

export const SEED_PATIENTS: Record<string, Patient> = {
  pat_001: {
    patient_id: "pat_001",
    abha_id: "12-3456-7890-0001",
    phone_number: "9000000001",
    name: "Anjali Menon",
    dob: "1991-03-14",
    age: 34,
    sex: "F",
    home_jurisdiction_id: "jur_thrissur_01",
  },
  pat_002: {
    patient_id: "pat_002",
    abha_id: "12-3456-7890-0002",
    phone_number: "9000000002",
    name: "Rajesh Kumar",
    dob: "1978-11-02",
    age: 47,
    sex: "M",
    home_jurisdiction_id: "jur_thrissur_01",
  },
};

export const SEED_DOCTORS: Record<string, Doctor> = {
  doc_001: {
    doctor_id: "doc_001",
    name: "Dr. Priya Varghese",
    specialty_general: "MBBS, General Medicine",
    phone_number: "9100000001",
    serves_jurisdiction_ids: ["jur_thrissur_01", "jur_palakkad_01"],
  },
  doc_002: {
    doctor_id: "doc_002",
    name: "Dr. Arun Krishnan",
    specialty_general: "MBBS",
    phone_number: "9100000002",
    serves_jurisdiction_ids: ["jur_thrissur_01", "jur_palakkad_01"],
  },
};

export const SEED_PHARMACIES: Pharmacy[] = [
  {
    pharmacy_id: "pha_001",
    name: "Amala Medicals",
    location: "Thrissur Town (0.5 km from PHC)",
    phone_number: "+91 9200000001",
    jurisdiction_id: "jur_thrissur_01",
    latitude: 10.531,
    longitude: 76.218,
  },
  {
    pharmacy_id: "pha_002",
    name: "Devi Pharmacy",
    location: "Ollur Junction (6.5 km)",
    phone_number: "+91 9200000002",
    jurisdiction_id: "jur_thrissur_01",
    latitude: 10.482,
    longitude: 76.251,
  },
  {
    pharmacy_id: "pha_003",
    name: "Kerala Medical Store",
    location: "Chalakudy Main Rd (27.5 km)",
    phone_number: "+91 9200000003",
    jurisdiction_id: "jur_thrissur_01",
    latitude: 10.308,
    longitude: 76.335,
  },
];

export function deriveStockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return "out_of_stock";
  if (quantity < 10) return "low";
  return "in_stock";
}

export const mutableStockStore: StockItem[] = [
  {
    stock_item_id: "stk_001",
    pharmacy_id: "pha_001",
    medicine_name: "Paracetamol 500mg",
    quantity: 0,
    status: "out_of_stock",
  },
  {
    stock_item_id: "stk_002",
    pharmacy_id: "pha_001",
    medicine_name: "Amoxicillin 500mg",
    quantity: 45,
    status: "in_stock",
  },
  {
    stock_item_id: "stk_003",
    pharmacy_id: "pha_001",
    medicine_name: "ORS Sachet",
    quantity: 120,
    status: "in_stock",
  },
  {
    stock_item_id: "stk_004",
    pharmacy_id: "pha_002",
    medicine_name: "Paracetamol 500mg",
    quantity: 80,
    status: "in_stock",
  },
  {
    stock_item_id: "stk_005",
    pharmacy_id: "pha_002",
    medicine_name: "Amoxicillin 500mg",
    quantity: 6,
    status: "low",
  },
  {
    stock_item_id: "stk_006",
    pharmacy_id: "pha_002",
    medicine_name: "ORS Sachet",
    quantity: 60,
    status: "in_stock",
  },
  {
    stock_item_id: "stk_007",
    pharmacy_id: "pha_003",
    medicine_name: "Paracetamol 500mg",
    quantity: 200,
    status: "in_stock",
  },
  {
    stock_item_id: "stk_008",
    pharmacy_id: "pha_003",
    medicine_name: "Amoxicillin 500mg",
    quantity: 30,
    status: "in_stock",
  },
  {
    stock_item_id: "stk_009",
    pharmacy_id: "pha_003",
    medicine_name: "ORS Sachet",
    quantity: 15,
    status: "in_stock",
  },
  {
    stock_item_id: "stk_010",
    pharmacy_id: "pha_003",
    medicine_name: "Pantoprazole 40mg",
    quantity: 25,
    status: "in_stock",
  },
];

// In-memory mutable stores
const prescriptionsStore: Record<string, Prescription> = {
  rx_seed_001: {
    prescription_id: "rx_seed_001",
    visit_id: "vis_seed_001",
    doctor_id: "doc_001",
    doctor_name: "Dr. Priya Varghese",
    doctor_specialty: "MBBS, General Medicine",
    patient_id: "pat_001",
    patient_name: "Anjali Menon",
    patient_age: 34,
    patient_sex: "F",
    patient_phone: "+91 9000000001",
    issued_at: new Date().toISOString(),
    follow_up_requested: true,
    pharmacy_id: "pha_001",
    medications: [
      {
        name: "Paracetamol 500mg",
        dosage: "1 tablet (500mg)",
        duration: "5 days",
        instructions: "Take twice daily after meals for fever and pain relief",
      },
      {
        name: "Amoxicillin 500mg",
        dosage: "1 capsule (500mg)",
        duration: "5 days",
        instructions: "Take three times daily after food (complete the full course)",
      },
      {
        name: "ORS Sachet",
        dosage: "1 sachet in 1L water",
        duration: "3 days",
        instructions: "Dissolve 1 sachet in clean drinking water; drink periodically",
      },
    ],
  },
};

const pharmacyQueueStore: PharmacyQueueEntry[] = [
  {
    entry_id: "q_seed_001",
    pharmacy_id: "pha_001",
    prescription_id: "rx_seed_001",
    status: "pending",
    created_at: new Date().toISOString(),
  },
];

// =====================================================================
// Haversine Distance Helper
// =====================================================================

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// =====================================================================
// Data Access Methods
// =====================================================================

export function getMockPrescription(prescriptionId: string): Prescription | null {
  const rx = prescriptionsStore[prescriptionId];
  if (!rx) {
    if (
      prescriptionId === "default" ||
      prescriptionId.startsWith("rx_") ||
      prescriptionId.startsWith("vis_")
    ) {
      return prescriptionsStore["rx_seed_001"] || null;
    }
    return null;
  }
  return rx;
}

export function saveMockPrescription(prescription: Prescription): Prescription {
  prescriptionsStore[prescription.prescription_id] = prescription;
  return prescription;
}

export function getMockNearbyPharmacies(
  prescriptionId: string,
  customOrigin?: { lat: number; lng: number },
  maxRadiusKm: number = 30,
): NearbyPharmacyResult[] {
  const rx = getMockPrescription(prescriptionId);
  const medications = rx?.medications || [
    { name: "Paracetamol 500mg", dosage: "1 tab", duration: "5d", instructions: "Twice daily" },
    { name: "Amoxicillin 500mg", dosage: "1 cap", duration: "5d", instructions: "Thrice daily" },
    { name: "ORS Sachet", dosage: "1 sachet", duration: "3d", instructions: "As needed" },
  ];

  let originLat = 10.5276;
  let originLng = 76.2144;

  if (customOrigin) {
    originLat = customOrigin.lat;
    originLng = customOrigin.lng;
  } else if (rx) {
    const patient = SEED_PATIENTS[rx.patient_id];
    if (patient && SEED_JURISDICTIONS[patient.home_jurisdiction_id]) {
      originLat = SEED_JURISDICTIONS[patient.home_jurisdiction_id].latitude;
      originLng = SEED_JURISDICTIONS[patient.home_jurisdiction_id].longitude;
    }
  }

  const results: NearbyPharmacyResult[] = SEED_PHARMACIES.map((pharmacy) => {
    const distance = haversineDistanceKm(
      originLat,
      originLng,
      pharmacy.latitude,
      pharmacy.longitude,
    );

    const medicineChecks: MedicineStockCheck[] = medications.map((med) => {
      const stock = mutableStockStore.find(
        (s) =>
          s.pharmacy_id === pharmacy.pharmacy_id &&
          s.medicine_name.toLowerCase().includes(med.name.toLowerCase().split(" ")[0]),
      );

      const quantity = stock ? stock.quantity : 0;
      const status = stock ? stock.status : deriveStockStatus(quantity);

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
    const inQueue = pharmacyQueueStore.some(
      (q) => q.prescription_id === prescriptionId && q.pharmacy_id === pharmacy.pharmacy_id,
    );

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
      in_queue: inQueue || rx?.pharmacy_id === pharmacy.pharmacy_id,
    };
  });

  const filtered = maxRadiusKm > 0 ? results.filter((p) => p.distance_km <= maxRadiusKm) : results;
  return filtered.sort((a, b) => a.distance_km - b.distance_km);
}

export function routeMockPrescription(
  prescriptionId: string,
  pharmacyId: string,
): { success: boolean; queueEntry: PharmacyQueueEntry; message: string } {
  const rx = getMockPrescription(prescriptionId);
  if (!rx) {
    throw new Error(`Prescription ${prescriptionId} not found`);
  }

  const pharmacy = SEED_PHARMACIES.find((p) => p.pharmacy_id === pharmacyId);
  if (!pharmacy) {
    throw new Error(`Pharmacy ${pharmacyId} not found`);
  }

  const existingQueue = pharmacyQueueStore.find(
    (q) => q.prescription_id === prescriptionId,
  );

  if (existingQueue) {
    if (existingQueue.pharmacy_id === pharmacyId) {
      return {
        success: true,
        queueEntry: existingQueue,
        message: `Prescription already routed to ${pharmacy.name}`,
      };
    }
    existingQueue.pharmacy_id = pharmacyId;
    rx.pharmacy_id = pharmacyId;
    return {
      success: true,
      queueEntry: existingQueue,
      message: `Prescription re-routed to ${pharmacy.name}`,
    };
  }

  rx.pharmacy_id = pharmacyId;

  const newEntry: PharmacyQueueEntry = {
    entry_id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    pharmacy_id: pharmacyId,
    prescription_id: prescriptionId,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  pharmacyQueueStore.push(newEntry);

  return {
    success: true,
    queueEntry: newEntry,
    message: `Prescription routed to ${pharmacy.name} queue`,
  };
}

// =====================================================================
// Phase 2: Stock CRUD & Queue Dispensing Methods
// =====================================================================

export function getMockPharmacyStock(pharmacyId?: string): StockItem[] {
  if (pharmacyId) {
    return mutableStockStore.filter((s) => s.pharmacy_id === pharmacyId);
  }
  return [...mutableStockStore];
}

export function updateMockStockQuantity(
  stockItemId: string,
  newQuantity: number,
): StockItem {
  const stock = mutableStockStore.find((s) => s.stock_item_id === stockItemId);
  if (!stock) {
    throw new Error(`Stock item ${stockItemId} not found`);
  }
  stock.quantity = Math.max(0, newQuantity);
  stock.status = deriveStockStatus(stock.quantity);
  return stock;
}

export function addMockStockItem(
  pharmacyId: string,
  medicineName: string,
  quantity: number,
): StockItem {
  const newStock: StockItem = {
    stock_item_id: `stk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    pharmacy_id: pharmacyId,
    medicine_name: medicineName,
    quantity: Math.max(0, quantity),
    status: deriveStockStatus(quantity),
  };
  mutableStockStore.push(newStock);
  return newStock;
}

export function getDetailedMockPharmacyQueue(
  pharmacyId?: string,
): PharmacyQueueEntry[] {
  let list = pharmacyQueueStore;
  if (pharmacyId) {
    list = list.filter((q) => q.pharmacy_id === pharmacyId);
  }

  return list.map((entry) => {
    const rx = getMockPrescription(entry.prescription_id);
    return {
      ...entry,
      prescription: rx || undefined,
    };
  });
}

export function updateMockQueueStatus(
  entryId: string,
  status: "pending" | "fulfilled",
): PharmacyQueueEntry {
  const entry = pharmacyQueueStore.find((q) => q.entry_id === entryId);
  if (!entry) {
    throw new Error(`Queue entry ${entryId} not found`);
  }
  entry.status = status;
  if (status === "fulfilled") {
    entry.fulfilled_at = new Date().toISOString();
  }
  return entry;
}
