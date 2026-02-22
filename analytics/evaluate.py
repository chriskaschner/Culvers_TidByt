"""Evaluation framework: time-based train/test split, scoring functions.

Metrics: top-1 accuracy, top-5 recall, log loss, NDCG@10.
"""

import numpy as np
import pandas as pd

from analytics.predict import FlavorPredictor


def time_split(
    df: pd.DataFrame,
    split_date: str = "2026-01-01",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split dataset by date. Train = before split_date, test = on or after.

    Returns (train_df, test_df).
    """
    split = pd.Timestamp(split_date)
    train = df[df["flavor_date"] < split].copy()
    test = df[df["flavor_date"] >= split].copy()
    return train, test


def evaluate_model(
    model: FlavorPredictor,
    test_df: pd.DataFrame,
    max_samples: int | None = None,
) -> dict:
    """Evaluate a fitted model on test data.

    Returns dict with: top_1_accuracy, top_5_recall, mean_log_loss, ndcg_at_10, n_samples.
    """
    correct_top1 = 0
    correct_top5 = 0
    log_losses = []
    ndcg_scores = []
    n = 0

    samples = test_df
    if max_samples and len(samples) > max_samples:
        samples = samples.sample(n=max_samples, random_state=42)

    for _, row in samples.iterrows():
        store = row["store_slug"]
        date = row["flavor_date"]
        actual = row["title"]

        proba = model.predict_proba(store, date)

        predicted = proba.idxmax()
        if predicted == actual:
            correct_top1 += 1

        top5 = proba.nlargest(5).index.tolist()
        if actual in top5:
            correct_top5 += 1

        p = proba.get(actual, 0.0)
        p = max(p, 1e-15)
        log_losses.append(-np.log(p))

        top10 = proba.nlargest(10)
        ndcg = _ndcg_at_k(top10.index.tolist(), actual, k=10)
        ndcg_scores.append(ndcg)

        n += 1

    return {
        "top_1_accuracy": correct_top1 / n if n > 0 else 0.0,
        "top_5_recall": correct_top5 / n if n > 0 else 0.0,
        "mean_log_loss": float(np.mean(log_losses)) if log_losses else 0.0,
        "ndcg_at_10": float(np.mean(ndcg_scores)) if ndcg_scores else 0.0,
        "n_samples": n,
    }


def _ndcg_at_k(ranked_items: list[str], relevant: str, k: int = 10) -> float:
    """NDCG@k for a single-item relevance (binary)."""
    for i, item in enumerate(ranked_items[:k]):
        if item == relevant:
            return 1.0 / np.log2(i + 2)
    return 0.0


def compare_models(
    models: dict[str, FlavorPredictor],
    test_df: pd.DataFrame,
    max_samples: int | None = 500,
) -> pd.DataFrame:
    """Evaluate multiple models and return a comparison DataFrame."""
    records = []
    for name, model in models.items():
        metrics = evaluate_model(model, test_df, max_samples=max_samples)
        metrics["model"] = name
        records.append(metrics)

    return pd.DataFrame(records).set_index("model")
