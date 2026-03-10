"""
feature_engineering.py
Derives computed columns used by the ML model and constructs the final
feature matrix X and target vector y.
"""
import pandas as pd
from backend.utils.preprocessing import get_clean_dataset

NUMERIC_FEATURES = [
    "no_of_trainings",
    "age",
    "previous_year_rating",
    "length_of_service",
    "KPIs_met_more_than_80",
    "awards_won",
    "avg_training_score",
    "Budget",
    "Actual Cost",
    "Delay Days",
    "Cost Overrun %",
    "Tasks Completed",
    "Productivity Score",
    "Training Effectiveness",
    "Experience Index",
    "Priority_Scaled",
    "Workload Pressure",
]

CATEGORICAL_FEATURES = [
    "department",
    "education",
    "Project Type",
    "Priority",
]

TARGET = "Hours Spent"


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add any computed columns that are not present in the raw CSV."""
    df = df.copy()

    # Efficiency ratio: hours per completed task (avoid div-by-zero)
    if "Tasks Completed" in df.columns and "Hours Spent" in df.columns:
        df["Hours_per_Task"] = df["Hours Spent"] / (df["Tasks Completed"].replace(0, 1))

    # Cost efficiency: budget utilisation
    if "Budget" in df.columns and "Actual Cost" in df.columns:
        df["Budget_Utilisation"] = df["Actual Cost"] / (df["Budget"].replace(0, 1))

    return df


def build_feature_matrix(df: pd.DataFrame = None):
    """
    Returns (X, y) where X contains numeric + one-hot categorical features
    and y is the regression target.
    """
    if df is None:
        df = get_clean_dataset()

    df = add_derived_features(df)

    # Keep only columns that actually exist in this dataset
    present_num = [c for c in NUMERIC_FEATURES if c in df.columns]
    present_cat = [c for c in CATEGORICAL_FEATURES if c in df.columns]

    X_num = df[present_num]
    X_cat = pd.get_dummies(df[present_cat], drop_first=True)
    X = pd.concat([X_num, X_cat], axis=1)
    y = df[TARGET]

    return X, y, list(X.columns)


def build_input_row(input_dict: dict) -> pd.DataFrame:
    """
    Converts a prediction-request dict into a single-row DataFrame
    compatible with the trained model pipeline.
    """
    row = pd.DataFrame([input_dict])
    row = add_derived_features(row)
    return row
