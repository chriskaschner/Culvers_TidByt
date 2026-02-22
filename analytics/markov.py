"""Markov transition matrices — P(flavor_tomorrow | flavor_today).

Built from consecutive-day pairs across all stores. The global matrix aggregates
transitions from every store's sequence, giving a 42×42 (or N×N) probability matrix.
"""

import numpy as np
import pandas as pd


def build_transition_counts(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Build raw transition count matrix from consecutive-day flavor pairs.

    Only counts pairs where flavor_date(row i+1) - flavor_date(row i) == 1 day,
    within the same store.

    Returns (count_matrix, flavor_labels) where count_matrix is N×N DataFrame.
    """
    flavors = sorted(df["title"].unique())
    flavor_idx = {f: i for i, f in enumerate(flavors)}
    n = len(flavors)
    counts = np.zeros((n, n), dtype=int)

    for _, store_df in df.sort_values("flavor_date").groupby("store_slug"):
        dates = store_df["flavor_date"].values
        titles = store_df["title"].values
        for i in range(len(dates) - 1):
            # Only count consecutive calendar days
            gap = (dates[i + 1] - dates[i]) / np.timedelta64(1, "D")
            if gap == 1.0:
                from_idx = flavor_idx[titles[i]]
                to_idx = flavor_idx[titles[i + 1]]
                counts[from_idx][to_idx] += 1

    return pd.DataFrame(counts, index=flavors, columns=flavors), flavors


def transition_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Row-normalized transition probability matrix P(next | current).

    Each row sums to 1.0 (or 0.0 if a flavor has no observed transitions).
    """
    counts, _ = build_transition_counts(df)
    row_sums = counts.sum(axis=1)
    # Avoid division by zero for flavors with no outgoing transitions
    row_sums = row_sums.replace(0, 1)
    return counts.div(row_sums, axis=0)


def top_transitions(df: pd.DataFrame, flavor: str, n: int = 5) -> list[dict]:
    """Top-n most likely next flavors given a current flavor.

    Returns list of {flavor, probability} dicts, sorted descending.
    """
    tm = transition_matrix(df)
    if flavor not in tm.index:
        return []
    row = tm.loc[flavor].sort_values(ascending=False)
    return [
        {"flavor": f, "probability": round(float(p), 4)}
        for f, p in row.head(n).items()
        if p > 0
    ]


def self_transition_rate(df: pd.DataFrame) -> pd.Series:
    """Diagonal of the transition matrix — probability of same flavor two days in a row.

    Returns Series indexed by flavor, sorted descending.
    """
    tm = transition_matrix(df)
    diag = pd.Series(np.diag(tm.values), index=tm.index, name="self_transition")
    return diag.sort_values(ascending=False)
