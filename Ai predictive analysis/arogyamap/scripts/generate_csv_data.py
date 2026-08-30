"""
Synthetic patient dataset generator for ArogyaMap.
Generates: patient profiles (5,000 rows) and case history (10,000 rows, 2 visits per patient).
"""

import csv
import random
from datetime import date, timedelta
import os

random.seed(42)  # reproducible output

# Create data output directory
os.makedirs("data", exist_ok=True)

# ---------------------------------------------------------------------
# 1. Districts & regions/villages, with population split
# ---------------------------------------------------------------------

DISTRICTS = {
    "Chennai": {
        "Royapuram": 200,
        "Tondiarpet": 300,
        "Perambur": 400,
        "Anna Nagar": 500,
        "Kodambakkam": 600,
        "T Nagar": 400,
        "Adyar": 300,
        "Velachery": 300,
    },
    "Madurai": {
        "Melur": 300,
        "Vadipatti": 350,
        "Usilampatti": 400,
        "Thirumangalam": 450,
        "Peraiyur": 500,
    },
}

FLAGGED_AREAS = {
    "Royapuram": "fever_cluster",       # high temp + tachycardia, dengue-suspected
    "Melur": "respiratory_cluster",     # low SpO2, respiratory-suspected
}

FIRST_NAMES_M = ["Arun", "Karthik", "Suresh", "Manoj", "Vignesh", "Ramesh", "Dinesh",
                 "Praveen", "Saravanan", "Muthu", "Selvam", "Bala", "Naveen", "Ashok",
                 "Elango", "Gopal", "Ravi", "Senthil", "Kumar", "Prakash"]
FIRST_NAMES_F = ["Priya", "Lakshmi", "Divya", "Meena", "Kavya", "Anitha", "Deepa",
                  "Revathi", "Suganya", "Nithya", "Kalaivani", "Uma", "Radha", "Vidya",
                  "Sangeetha", "Padma", "Malar", "Geetha", "Sowmya", "Yamuna"]
LAST_NAMES = ["Raman", "Krishnan", "Murugan", "Pillai", "Iyer", "Nair", "Chettiar",
              "Gounder", "Naidu", "Reddy", "Rajan", "Subramaniam", "Velu", "Sundaram",
              "Natarajan", "Balasubramaniam", "Perumal", "Shanmugam"]

def random_name(gender):
    first = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
    last = random.choice(LAST_NAMES)
    return f"{first} {last}"

def random_phone():
    return f"+91{random.choice(['70','80','90','98'])}{random.randint(10000000,99999999)}"

def random_abha():
    return "".join(str(random.randint(0,9)) for _ in range(14))

def random_dob_age():
    age = int(min(95, max(1, random.gauss(38, 18))))
    return age

patients = []
patient_id_counter = 1

for district, areas in DISTRICTS.items():
    for area, count in areas.items():
        for _ in range(count):
            gender = random.choice(["M", "F"])
            age = random_dob_age()
            height = round(random.gauss(165 if gender == "M" else 155, 8), 1)
            weight = round(random.gauss(65 if gender == "M" else 58, 12), 1)
            weight = max(30, weight)
            reg_date = date(2026, 6, 1) + timedelta(days=random.randint(0, 60))

            patients.append({
                "patient_id": f"P{patient_id_counter:05d}",
                "name": random_name(gender),
                "age": age,
                "gender": gender,
                "height_cm": height,
                "weight_kg": weight,
                "blood_group": random.choice(["A+","A-","B+","B-","O+","O-","AB+","AB-"]),
                "phone_no": random_phone(),
                "abha_id": random_abha(),
                "district": district,
                "region_village": area,
                "registered_date": reg_date.isoformat(),
            })
            patient_id_counter += 1

SYMPTOMS_NORMAL = [
    ("Routine checkup", "Routine follow-up, no acute complaint"),
    ("Common cold", "Seasonal upper respiratory infection"),
    ("Gastritis - dietary", "Acid reflux linked to dietary habits"),
    ("Migraine", "Recurrent tension-type headache"),
    ("Hypertension follow-up", "Chronic hypertension management"),
    ("Diabetes follow-up", "Routine diabetes monitoring"),
    ("Minor injury - sprain", "Soft tissue injury, self-limiting"),
    ("Seasonal allergy", "Allergic rhinitis, environmental trigger"),
    ("Mild anemia", "Dietary iron deficiency suspected"),
    ("Joint pain - age related", "Degenerative joint pain, chronic"),
]

FEVER_CLUSTER_CAUSES = [
    ("Suspected dengue - stagnant water reported nearby", "Fever with chills, 2-3 days duration, patient reports stagnant water near residence"),
    ("Suspected dengue - vector breeding suspected", "High fever, retro-orbital pain, low platelet suspicion"),
    ("Viral fever - seasonal cluster", "Fever with body ache, several neighbors reporting similar symptoms"),
    ("Suspected dengue - contaminated water source", "Fever with rash, patient notes water stagnation post-rain"),
]

RESPIRATORY_CLUSTER_CAUSES = [
    ("Suspected respiratory infection - cluster pattern", "Breathlessness and cough, reduced oxygen saturation on exam"),
    ("Suspected pneumonia - early stage", "Cough with mild fever, reduced SpO2 noted"),
    ("Respiratory distress - cluster under investigation", "Persistent cough, low oxygen saturation, multiple similar cases in area"),
    ("Suspected viral respiratory outbreak", "Cough, fatigue, and low SpO2 reported by several patients in the same area"),
]

def normal_vitals():
    bp_sys = int(random.gauss(118, 10))
    bp_dia = int(random.gauss(76, 7))
    hr = int(random.gauss(76, 8))
    spo2 = round(random.gauss(97.5, 1.2), 1)
    temp = round(random.gauss(36.8, 0.3), 1)
    return bp_sys, bp_dia, hr, min(100, spo2), temp

def fever_cluster_vitals():
    bp_sys = int(random.gauss(122, 10))
    bp_dia = int(random.gauss(78, 7))
    hr = int(random.gauss(108, 10))          # tachycardia
    spo2 = round(random.gauss(96, 1.5), 1)
    temp = round(random.gauss(38.9, 0.5), 1)  # fever
    return bp_sys, bp_dia, hr, min(100, spo2), temp

def respiratory_cluster_vitals():
    bp_sys = int(random.gauss(120, 10))
    bp_dia = int(random.gauss(77, 7))
    hr = int(random.gauss(98, 9))
    spo2 = round(random.gauss(91, 2.0), 1)    # low SpO2
    temp = round(random.gauss(37.6, 0.5), 1)
    return bp_sys, bp_dia, hr, max(80, min(100, spo2)), temp

def classify_vital_flag(bp_sys, bp_dia, hr, spo2, temp):
    flags = []
    if temp >= 38.0:
        flags.append("fever")
    if hr >= 100:
        flags.append("tachycardia")
    if spo2 < 94:
        flags.append("low_spo2")
    if bp_sys >= 140 or bp_dia >= 90:
        flags.append("hypertensive")
    if not flags:
        return "normal", "none"
    return "abnormal", "+".join(flags)

def ai_summary(symptom_text, bp_sys, bp_dia, hr, spo2, temp, flag_status, flag_types):
    base = (f"Patient reports: {symptom_text}. Vitals recorded - BP {bp_sys}/{bp_dia} mmHg, "
            f"HR {hr} bpm, SpO2 {spo2}%, Temp {temp}\u00b0C.")
    if flag_status == "abnormal":
        base += f" Flagged abnormal: {flag_types.replace('+', ', ')}."
    else:
        base += " All vitals within normal range."
    return base

case_rows = []
visit_id_counter = 1

for p in patients:
    area = p["region_village"]
    cluster_type = FLAGGED_AREAS.get(area)

    for visit_num in [1, 2]:
        visit_date = date(2026, 8, 23) - timedelta(days=random.randint(0, 20) if visit_num == 1 else random.randint(21, 45))

        is_cluster_case = False
        if cluster_type == "fever_cluster" and random.random() < 0.45:
            is_cluster_case = True
            bp_sys, bp_dia, hr, spo2, temp = fever_cluster_vitals()
            root_cause_pool = FEVER_CLUSTER_CAUSES
        elif cluster_type == "respiratory_cluster" and random.random() < 0.45:
            is_cluster_case = True
            bp_sys, bp_dia, hr, spo2, temp = respiratory_cluster_vitals()
            root_cause_pool = RESPIRATORY_CLUSTER_CAUSES
        else:
            if random.random() < 0.10:
                bp_sys, bp_dia, hr, spo2, temp = normal_vitals()
                bp_sys += random.choice([0, 25])
            else:
                bp_sys, bp_dia, hr, spo2, temp = normal_vitals()
            root_cause_pool = None

        flag_status, flag_types = classify_vital_flag(bp_sys, bp_dia, hr, spo2, temp)

        if is_cluster_case:
            root_cause, symptom_text = random.choice(root_cause_pool)
        else:
            symptom_text, root_cause = random.choice(SYMPTOMS_NORMAL)
            if flag_status == "normal" and random.random() < 0.3:
                root_cause = ""

        summary = ai_summary(symptom_text, bp_sys, bp_dia, hr, spo2, temp, flag_status, flag_types)

        case_rows.append({
            "visit_id": f"V{visit_id_counter:06d}",
            "patient_id": p["patient_id"],
            "district": p["district"],
            "region_village": area,
            "visit_number": visit_num,
            "visit_date": visit_date.isoformat(),
            "chief_complaint": symptom_text,
            "bp_systolic": bp_sys,
            "bp_diastolic": bp_dia,
            "heart_rate": hr,
            "spo2": spo2,
            "temperature_c": temp,
            "vital_flag_status": flag_status,
            "vital_flag_types": flag_types,
            "ai_summary": summary,
            "doctor_root_cause": root_cause,
        })
        visit_id_counter += 1

with open("data/patients.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(patients[0].keys()))
    writer.writeheader()
    writer.writerows(patients)

with open("data/case_history.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(case_rows[0].keys()))
    writer.writeheader()
    writer.writerows(case_rows)

print(f"[Success] Generated data/patients.csv ({len(patients)} rows) and data/case_history.csv ({len(case_rows)} rows)")
