#!/usr/bin/env python3
"""
============================================================
ArogyaMap — Stage 5: Environmental & Clinical Factor Analysis
Runs Logistic Regression (direction) & Random Forest (importance)
Exports results to src/data/generated/factorResults.json
============================================================
"""

import json
import os
import sys
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
TRAINING_DATA_PATH = os.path.join(SCRIPT_DIR, "training_data.json")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "src", "data", "generated")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "factorResults.json")


def load_or_generate_training_data():
    """Load exported JSON training data or construct from embedded records."""
    if os.path.exists(TRAINING_DATA_PATH):
        with open(TRAINING_DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return pd.DataFrame(data)
    
    print(f"[Warning] {TRAINING_DATA_PATH} not found. Using fallback generator.")
    return None


def run_factor_analysis():
    print("=" * 60)
    print("ArogyaMap Factor Analysis — Logistic Regression & Random Forest")
    print("=" * 60)

    df = load_or_generate_training_data()
    if df is None or len(df) == 0:
        print("[Error] No training data available.")
        sys.exit(1)

    print(f"Loaded {len(df)} village-week surveillance observations.")

    # Invert sanitation score so higher = higher risk / deficit for uniform model interpretation
    df["sanitation_deficit"] = 100 - df["sanitationScore"]

    # Feature definitions
    feature_keys = [
        "rainfallMm",
        "sanitation_deficit",
        "populationDensity",
        "waterSourceCode",
        "gatheringDays",
    ]

    feature_labels = {
        "rainfallMm": "Rainfall Index",
        "sanitation_deficit": "Sanitation Deficit",
        "populationDensity": "Population Density",
        "waterSourceCode": "Unprotected Water Source",
        "gatheringDays": "Public Gatherings / Markets",
    }

    X = df[feature_keys].values
    y = df["isSpike"].values

    # Check class balance
    spike_count = np.sum(y == 1)
    non_spike_count = np.sum(y == 0)
    print(f"Spike events: {spike_count} | Normal weeks: {non_spike_count}")

    # Standardize features for logistic regression
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 1. Logistic Regression Model (Direction & Odds Ratio)
    # class_weight='balanced' handles sparse spike occurrences
    lr = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)
    lr.fit(X_scaled, y)
    lr_coefs = lr.coef_[0]

    # 2. Random Forest Classifier (Feature Importance)
    # n_estimators=100, max_depth=3 per Stage 5 specification
    rf = RandomForestClassifier(n_estimators=100, max_depth=3, random_state=42, class_weight="balanced")
    rf.fit(X, y)
    rf_importances = rf.feature_importances_

    # Normalize importances to sum to 100%
    rf_pct = (rf_importances / np.sum(rf_importances)) * 100
    rf_pct_rounded = [int(round(p)) for p in rf_pct]
    # Ensure exact 100 sum
    diff = 100 - sum(rf_pct_rounded)
    rf_pct_rounded[0] += diff

    # Compile global ranked factors
    global_factors = []
    for idx, key in enumerate(feature_keys):
        direction = "increasing" if lr_coefs[idx] >= 0 else "decreasing"
        global_factors.append({
            "name": feature_labels[key],
            "importance": int(rf_pct_rounded[idx]),
            "direction": direction,
            "rawKey": key,
        })

    # Sort descending by importance
    global_factors.sort(key=lambda x: x["importance"], reverse=True)

    print("\n--- Global Model Results ---")
    for f in global_factors:
        print(f"• {f['name']:<28} : {f['importance']:>2}% | Direction: {f['direction']}")

    # Build output payload
    output_payload = {
        "metadata": {
            "modelA": "LogisticRegression(class_weight='balanced')",
            "modelB": "RandomForestClassifier(n_estimators=100, max_depth=3)",
            "sampleCount": len(df),
            "spikeCount": int(spike_count),
            "featuresEvaluated": len(feature_keys),
        },
        "globalFactors": [
            {"name": f["name"], "importance": f["importance"], "direction": f["direction"]}
            for f in global_factors
        ],
        "featureCoefficients": {
            feature_labels[key]: float(round(lr_coefs[i], 4)) for i, key in enumerate(feature_keys)
        },
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    print(f"\n[Success] Factor analysis output saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    run_factor_analysis()
