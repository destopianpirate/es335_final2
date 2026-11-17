"""Score every saved model on the validation and test splits with the same metrics and threshold.

    python scripts/export_val_test_metrics.py

Uses the prediction code of notebooks/06_test_evaluation.ipynb, with tau from models/model_config.json
(chosen on validation). Writes results/val_test_metrics.csv (the test rows match results/test_metrics.csv)
and results/model_comparison.csv (paired bootstrap of the test PR-AUC difference, tuned LightGBM vs each other model).
"""
import json
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, average_precision_score, brier_score_loss, f1_score, log_loss,
                             precision_score, recall_score, roc_auc_score)

ROOT = Path(__file__).resolve().parent.parent
PROCESSED, MODELS, RESULTS = ROOT / "data" / "processed", ROOT / "models", ROOT / "results"

cfg = json.loads((MODELS / "model_config.json").read_text())
FEATURES, TAU = cfg["features"], cfg["threshold"]
base = joblib.load(MODELS / "baselines.joblib")
rf = joblib.load(MODELS / "random_forest.joblib")
lgb_default = lgb.Booster(model_file=str(MODELS / "lgbm_default.txt"))
champion = lgb.Booster(model_file=str(MODELS / "lgbm_champion.txt"))


def predict_all(X):
    return {
        "Majority (prior)": base["dummy"].predict_proba(X)[:, 1],
        "Rule: auto-renew off": X.last_auto_renew.fillna(0).map(base["rule_rates"]).values,
        "Logistic regression": base["logreg"].predict_proba(X)[:, 1],
        "Random forest": rf.predict_proba(X)[:, 1],
        "LightGBM (default)": lgb_default.predict(X),
        "LightGBM (tuned)": champion.predict(X),
    }


def metrics(y, p, t=TAU):
    pred = p >= t
    return {"pr_auc": average_precision_score(y, p), "roc_auc": roc_auc_score(y, p),
            "log_loss": log_loss(y, np.clip(p, 1e-6, 1 - 1e-6)), "brier": brier_score_loss(y, p),
            "accuracy": accuracy_score(y, pred), "precision": precision_score(y, pred, zero_division=0),
            "recall": recall_score(y, pred), "f1": f1_score(y, pred)}


rows, test_probs, y_test = [], None, None
for split in ["val", "test"]:
    X = pd.read_parquet(PROCESSED / f"X_{split}.parquet")[FEATURES]
    y = pd.read_parquet(PROCESSED / f"y_{split}.parquet").is_churn.values
    probs = predict_all(X)
    for model, p in probs.items():
        rows.append({"split": split, "model": model, **metrics(y, p)})
    if split == "test":
        test_probs, y_test = probs, y

table = pd.DataFrame(rows).round(4)
table.to_csv(RESULTS / "val_test_metrics.csv", index=False)
print(f"tau = {TAU}")
print(table.to_string(index=False))

# Is the tuned LightGBM really better? Paired bootstrap of the test PR-AUC difference:
# both models are scored on the same resample, so the interval reflects only the difference.
# Same resample indices as notebook 06 (seed 0, 1,000 resamples).
rng = np.random.default_rng(0)
boot_idx = [rng.integers(0, len(y_test), len(y_test)) for _ in range(1000)]
champ = test_probs["LightGBM (tuned)"]
ap_champ = np.array([average_precision_score(y_test[i], champ[i]) for i in boot_idx])
comp = []
for other in ["LightGBM (default)", "Random forest", "Logistic regression", "Rule: auto-renew off"]:
    p = test_probs[other]
    d = ap_champ - np.array([average_precision_score(y_test[i], p[i]) for i in boot_idx])
    comp.append({"comparison": f"LightGBM (tuned) - {other}", "point": average_precision_score(y_test, champ) - average_precision_score(y_test, p),
                 "low": np.quantile(d, 0.025), "high": np.quantile(d, 0.975), "share_above_zero": float((d > 0).mean())})
comp = pd.DataFrame(comp).round(4)
comp.to_csv(RESULTS / "model_comparison.csv", index=False)
print(comp.to_string(index=False))
