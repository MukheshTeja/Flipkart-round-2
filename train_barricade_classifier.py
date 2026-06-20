#!/usr/bin/env python3
"""
Train a logistic regression classifier to predict road-closure / barricade need.

Features : event_cause (one-hot), severity_score (numeric, derived from closure_min)
Target   : requires_road_closure_bool (0/1)

Saves barricade_pipeline.pkl and barricade_metadata.json next to this script.
"""

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from config import DATA_FILE

ROOT = Path(__file__).resolve().parent


def minutes_to_score(predicted_min: float) -> int:
    SCORE_CAP_MIN = 600
    score = 100 * (1 - np.exp(-predicted_min / (SCORE_CAP_MIN / 3)))
    return int(np.clip(round(score), 0, 100))


def load_training_data():
    df = pd.read_csv(ROOT / DATA_FILE, low_memory=False)

    # Target
    df["closure_bool"] = (
        df["requires_road_closure"].astype(str).str.lower() == "true"
    ).astype(int)

    # Severity score from closure duration
    df["start_dt"] = pd.to_datetime(df["start_datetime"], errors="coerce", format="mixed")
    df["closed_dt"] = pd.to_datetime(df["closed_datetime"], errors="coerce", format="mixed")
    df["closure_min"] = (df["closed_dt"] - df["start_dt"]).dt.total_seconds() / 60
    df["severity_score"] = df["closure_min"].apply(
        lambda m: minutes_to_score(m) if pd.notna(m) and m >= 0 else 50
    )

    df["event_cause"] = df["event_cause"].fillna("others").str.lower().str.strip()
    df = df.dropna(subset=["event_cause", "severity_score", "closure_bool"])

    X = df[["event_cause", "severity_score"]].copy()
    y = df["closure_bool"].values
    return X, y


def main():
    print("Loading training data...")
    X, y = load_training_data()
    print(f"  {len(X):,} rows | positive rate: {y.mean():.1%}")

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["event_cause"]),
            ("num", StandardScaler(), ["severity_score"]),
        ]
    )
    clf = LogisticRegression(class_weight="balanced", max_iter=500, random_state=42)
    pipeline = Pipeline([("preprocessor", preprocessor), ("model", clf)])

    print("Running 5-fold cross-validation...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        roc_scores = cross_val_score(pipeline, X, y, cv=cv, scoring="roc_auc")
    print(f"  CV ROC-AUC: {roc_scores.mean():.3f} ± {roc_scores.std():.3f}")

    print("Fitting final model on full dataset...")
    pipeline.fit(X, y)

    proba = pipeline.predict_proba(X)[:, 1]
    roc_full = roc_auc_score(y, proba)
    print(f"  Full-data ROC-AUC: {roc_full:.3f}")

    out_path = ROOT / "barricade_pipeline.pkl"
    joblib.dump(pipeline, out_path)
    print(f"  Saved -> {out_path}")

    # Expose per-cause coefficient magnitude for explainability
    ohe = pipeline.named_steps["preprocessor"].named_transformers_["cat"]
    cat_features = ohe.get_feature_names_out(["event_cause"]).tolist()
    all_features = cat_features + ["severity_score"]
    coefs = dict(zip(all_features, pipeline.named_steps["model"].coef_[0].tolist()))

    meta = {
        "roc_auc_cv_mean": round(float(roc_scores.mean()), 4),
        "roc_auc_cv_std": round(float(roc_scores.std()), 4),
        "positive_rate": round(float(y.mean()), 4),
        "n_samples": int(len(y)),
        "top_positive_features": sorted(
            [(k, round(v, 3)) for k, v in coefs.items() if v > 0],
            key=lambda x: -x[1],
        )[:10],
    }
    meta_path = ROOT / "barricade_metadata.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    print(f"  Metadata -> {meta_path}")
    print(f"\n  Top positive predictors:")
    for feat, coef in meta["top_positive_features"][:6]:
        print(f"    {feat:<40} {coef:+.3f}")


if __name__ == "__main__":
    main()
