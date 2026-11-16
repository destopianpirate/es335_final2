"""Export extra Data Studio tables (churn by group, auto-renew x cancel, file overlap) to website/js/generated/ds_extra.js.

    python scripts/export_ds_extra.py

Churn tables come from data/processed/features_train.parquet. The overlap table hashes the `msno` column
of the five raw CSVs (data/raw/*.csv), so it needs the raw files and takes a couple of minutes.
"""
import itertools
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "website" / "js" / "generated" / "ds_extra.js"

df = pd.read_parquet(ROOT / "data" / "processed" / "features_train.parquet")
y = df["is_churn"]
overall = float(y.mean())


def table(series, order=None, top=None, label=None):
    g = pd.DataFrame({"g": series.astype("object").where(series.notna(), "missing"), "y": y})
    t = g.groupby("g", observed=True)["y"].agg(["size", "mean"])
    if order is not None:
        t = t.reindex([o for o in order if o in t.index])
    else:
        t = t.sort_values("size", ascending=False)
    if top:
        t = t.head(top)
    return [{"group": (label(k) if label else str(k)), "n": int(r["size"]), "share": float(r["size"] / len(df)),
             "churn_rate": float(r["mean"])} for k, r in t.iterrows()]


def num(x):
    if x == "missing":
        return "missing (no record)"
    return str(int(x)) if float(x).is_integer() else str(x)


dims = {}

# --- billing ---
dims["payment_method"] = {
    "title": "Payment method of the last transaction", "source": "transactions.csv", "top": 12,
    "rows": table(df["last_payment_method"], top=12, label=num)}
dims["plan_days"] = {
    "title": "Length of the last plan (days)", "source": "transactions.csv",
    "rows": table(df["last_plan_days"], top=10, label=num)}
dims["tx_count"] = {
    "title": "Number of transactions on record", "source": "transactions.csv",
    "rows": table(pd.cut(df["tx_count"].fillna(0), [-1, 0, 2, 5, 10, 20, 1e9],
                         labels=["none", "1-2", "3-5", "6-10", "11-20", "21+"]),
                  order=["none", "1-2", "3-5", "6-10", "11-20", "21+"])}
price = np.select(
    [df["last_amount_paid"].isna(), df["last_amount_paid"] == 0, df["discount_count"] > 0],
    ["no transactions", "last payment was free (0)", "has had a discounted payment"], "always paid list price")
dims["price"] = {
    "title": "Pricing history", "source": "transactions.csv",
    "rows": table(pd.Series(price, index=df.index))}
dims["n_methods"] = {
    "title": "Different payment methods used", "source": "transactions.csv",
    "rows": table(df["n_payment_methods"].clip(upper=4).fillna(0), order=[0.0, 1.0, 2.0, 3.0, 4.0],
                  label=lambda v: {"0.0": "none", "4.0": "4+"}.get(str(float(v)), num(v)))}
# --- listening ---
hrs = df["secs_per_day"] / 3600
dims["daily_hours"] = {
    "title": "Listening per active day (March)", "source": "user_logs.csv",
    "rows": table(pd.cut(hrs, [-1, 0.25, 0.5, 1, 2, 4, 1e9], labels=["< 15 min", "15-30 min", "30-60 min", "1-2 h", "2-4 h", "4 h +"]).astype("object")
                  .where(df["has_logs"] == 1, "no March logs"),
                  order=["no March logs", "< 15 min", "15-30 min", "30-60 min", "1-2 h", "2-4 h", "4 h +"])}
dims["skip"] = {
    "title": "Share of songs skipped early (< 25 % played)", "source": "user_logs.csv",
    "rows": table(pd.cut(df["skip_ratio"], [-0.01, 0.05, 0.15, 0.3, 0.5, 1.0], labels=["0-5 %", "5-15 %", "15-30 %", "30-50 %", "50 %+"]).astype("object")
                  .where(df["has_logs"] == 1, "no March logs"),
                  order=["no March logs", "0-5 %", "5-15 %", "15-30 %", "30-50 %", "50 %+"])}
# --- members ---
dims["city"] = {
    "title": "City (top 10 by subscribers)", "source": "members.csv",
    "rows": table(df["city"], top=10, label=num)}
dims["registered_via"] = {
    "title": "Registration channel", "source": "members.csv",
    "rows": table(df["registered_via"], top=8, label=num)}

# --- auto-renew x cancel ---
x = df.dropna(subset=["last_auto_renew", "last_is_cancel"])
cross = []
for (ar, ca), g in x.groupby(["last_auto_renew", "last_is_cancel"]):
    cross.append({"auto_renew": int(ar), "cancel": int(ca), "n": int(len(g)), "churn_rate": float(g["is_churn"].mean())})

# --- overlap of the five files (subscriber ids) ---
def hashes(path, chunk=None):
    parts = []
    for c in pd.read_csv(path, usecols=["msno"], chunksize=2_000_000):
        parts.append(np.unique(pd.util.hash_array(c["msno"].to_numpy(dtype=object))))
    return np.unique(np.concatenate(parts))


files = {"train": "train_data.csv", "test": "kaggle_test_data.csv", "members": "members.csv",
         "transactions": "transactions.csv", "user_logs": "user_logs.csv"}
sets = {k: hashes(RAW / v) for k, v in files.items()}
size = {k: int(len(v)) for k, v in sets.items()}
union = int(len(np.unique(np.concatenate(list(sets.values())))))
pair = {}
for a, b in itertools.combinations(sets, 2):
    pair[f"{a}|{b}"] = int(len(np.intersect1d(sets[a], sets[b], assume_unique=True)))


def core(split):
    r = sets[split]
    for k in ["members", "transactions", "user_logs"]:
        r = np.intersect1d(r, sets[k], assume_unique=True)
    return int(len(r))


overlap = {"size": size, "pair": pair, "union": union,
           "complete": {"train": core("train"), "test": core("test")}}

extra = {"overall": overall, "n": int(len(df)), "dims": dims, "cross": cross, "overlap": overlap}
OUT.write_text("window.DS_EXTRA = " + json.dumps(extra, separators=(",", ":")) + ";\n", encoding="utf-8")
print("wrote", OUT, f"({OUT.stat().st_size / 1e3:.1f} KB)")
