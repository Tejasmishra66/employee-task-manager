"""
train_models.py
Trains a RandomForest regressor to predict task Hours Spent and saves
the pipeline + metadata to backend/ml/save_models/.

Run from the project root:
    python -m backend.ml.train_models
"""
from pathlib import Path
import json
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
import math

from backend.utils.preprocessing import get_clean_dataset, PRIORITY_MAP
from backend.utils.feature_engineering import NUMERIC_FEATURES, CATEGORICAL_FEATURES, TARGET

SAVE_DIR = Path(__file__).resolve().parent / "save_models"
MODEL_PATH = SAVE_DIR / "model.joblib"
METADATA_PATH = SAVE_DIR / "metadata.json"


def train():
    print("Loading dataset...")
    df = get_clean_dataset()

    present_num = [c for c in NUMERIC_FEATURES if c in df.columns]
    present_cat = [c for c in CATEGORICAL_FEATURES if c in df.columns]

    X = df[present_num + present_cat]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), present_num),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), present_cat),
    ])

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model", RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)),
    ])

    print("Training model...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = math.sqrt(mean_squared_error(y_test, y_pred))
    print(f"MAE : {mae:.3f} hours")
    print(f"RMSE: {rmse:.3f} hours")

    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)

    metadata = {
        "numeric_features": present_num,
        "categorical_features": present_cat,
        "all_input_columns": present_num + present_cat,
        "target": TARGET,
        "test_size": 0.2,
        "random_state": 42,
        "metrics": {"mae": mae, "rmse": rmse},
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Model saved to  : {MODEL_PATH}")
    print(f"Metadata saved  : {METADATA_PATH}")
    return pipeline, metadata


if __name__ == "__main__":
    train()
