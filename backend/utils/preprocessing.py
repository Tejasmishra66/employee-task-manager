"""
preprocessing.py
Loads the raw CSV dataset and produces a clean DataFrame ready for
feature engineering / model training.
"""
from pathlib import Path
import pandas as pd

# Path to the dataset (two levels above this file: project root)
DATASET_PATH = Path(__file__).resolve().parent.parent.parent / "final_dataset_with_features.csv"


PRIORITY_MAP = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}


def load_raw_data(path: Path = DATASET_PATH) -> pd.DataFrame:
    """Load the raw CSV and return a DataFrame."""
    return pd.read_csv(path)


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    - Drop rows with null target (Hours Spent)
    - Fill remaining numeric nulls with median
    - Fill categorical nulls with 'Unknown'
    """
    df = df.dropna(subset=["Hours Spent"]).copy()

    numeric_cols = df.select_dtypes(include="number").columns
    for col in numeric_cols:
        df[col] = df[col].fillna(df[col].median())

    cat_cols = df.select_dtypes(include="object").columns
    for col in cat_cols:
        df[col] = df[col].fillna("Unknown")

    return df


def encode_priority(df: pd.DataFrame) -> pd.DataFrame:
    """Map Priority text column to numeric scale."""
    if "Priority" in df.columns:
        df = df.copy()
        df["Priority_Encoded"] = df["Priority"].map(PRIORITY_MAP).fillna(2)
    return df


def get_clean_dataset(path: Path = DATASET_PATH) -> pd.DataFrame:
    """One-shot helper used by training and feature-engineering modules."""
    df = load_raw_data(path)
    df = clean_data(df)
    df = encode_priority(df)
    return df
