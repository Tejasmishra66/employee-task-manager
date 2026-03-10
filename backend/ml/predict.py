"""
predict.py
Loads the trained model pipeline and exposes a predict() function
used by the /predict API endpoint.
"""
from pathlib import Path
import json
import joblib
import pandas as pd
from typing import Optional

# Prefer the newly trained model; fall back to the legacy root-level model
_NEW_MODEL = Path(__file__).resolve().parent / "save_models" / "model.joblib"
_NEW_META  = Path(__file__).resolve().parent / "save_models" / "metadata.json"
_OLD_MODEL = Path(__file__).resolve().parent.parent.parent / "models" / "model.joblib"
_OLD_META  = Path(__file__).resolve().parent.parent.parent / "models" / "metadata.json"

_pipeline = None
_metadata: dict = {}


def _load():
    global _pipeline, _metadata
    if _NEW_MODEL.exists():
        _pipeline = joblib.load(_NEW_MODEL)
        with open(_NEW_META) as f:
            _metadata = json.load(f)
    elif _OLD_MODEL.exists():
        _pipeline = joblib.load(_OLD_MODEL)
        with open(_OLD_META) as f:
            _metadata = json.load(f)
    else:
        raise FileNotFoundError(
            "No trained model found. Run `python -m backend.ml.train_models` first."
        )


def get_metadata() -> dict:
    if not _pipeline:
        _load()
    return _metadata


def predict(input_dict: dict) -> float:
    """
    Given a dict of feature values, returns the predicted Hours Spent (float).
    Missing features are filled with 0 / 'Unknown'.
    """
    if not _pipeline:
        _load()

    meta = _metadata
    all_cols = meta.get("all_input_columns") or (
        meta.get("numeric_features", []) + meta.get("categorical_features", [])
    )

    # Build input row — fill missing cols with safe defaults
    row = {}
    for col in meta.get("numeric_features", []):
        row[col] = input_dict.get(col, 0)
    for col in meta.get("categorical_features", []):
        row[col] = input_dict.get(col, "Unknown")

    df = pd.DataFrame([row])
    result = _pipeline.predict(df)
    return round(float(result[0]), 2)
