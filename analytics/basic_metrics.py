"""Basic flavor intelligence metrics: frequency, recency, diversity, surprise.

All functions accept the clean DataFrame from data_loader.load_clean().
"""

from datetime import datetime

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Frequency
# ---------------------------------------------------------------------------

def flavor_frequency(df: pd.DataFrame, store_slug: str | None = None) -> pd.Series:
    """Flavor frequency distribution (count of appearances).

    If store_slug is given, scoped to that store; otherwise global.
    Returns Series indexed by flavor title, sorted descending.
    """
    subset = df[df["store_slug"] == store_slug] if store_slug else df
    return subset["title"].value_counts().sort_values(ascending=False)


def flavor_probability(df: pd.DataFrame, store_slug: str | None = None) -> pd.Series:
    """Normalized frequency — P(flavor) or P(flavor|store).

    Returns Series indexed by flavor title, sums to 1.0.
    """
    freq = flavor_frequency(df, store_slug)
    return freq / freq.sum()


# ---------------------------------------------------------------------------
# Recency
# ---------------------------------------------------------------------------

def days_since_last(
    df: pd.DataFrame,
    store_slug: str,
    as_of: datetime | pd.Timestamp | None = None,
) -> pd.Series:
    """Days since each flavor was last served at a store.

    Returns Series indexed by flavor title, values are day counts.
    Flavors never served at this store are excluded.
    """
    if as_of is None:
        as_of = df["flavor_date"].max()
    as_of = pd.Timestamp(as_of)

    store_df = df[df["store_slug"] == store_slug]
    last_seen = store_df.groupby("title")["flavor_date"].max()
    return (as_of - last_seen).dt.days.sort_values(ascending=False)


def overdue_flavors(
    df: pd.DataFrame,
    store_slug: str,
    threshold: float = 1.5,
    as_of: datetime | pd.Timestamp | None = None,
) -> pd.DataFrame:
    """Flavors whose gap since last serving exceeds threshold * historical average gap.

    Returns DataFrame with columns: title, days_since, avg_gap, ratio.
    """
    if as_of is None:
        as_of = df["flavor_date"].max()
    as_of = pd.Timestamp(as_of)

    store_df = df[df["store_slug"] == store_slug].sort_values("flavor_date")
    recency = days_since_last(df, store_slug, as_of)

    # Compute historical average gap per flavor at this store
    avg_gaps = {}
    for flavor, group in store_df.groupby("title"):
        dates = group["flavor_date"].sort_values()
        if len(dates) >= 2:
            gaps = dates.diff().dropna().dt.days
            avg_gaps[flavor] = gaps.mean()

    records = []
    for flavor, days in recency.items():
        if flavor in avg_gaps and avg_gaps[flavor] > 0:
            ratio = days / avg_gaps[flavor]
            if ratio >= threshold:
                records.append({
                    "title": flavor,
                    "days_since": days,
                    "avg_gap": round(avg_gaps[flavor], 1),
                    "ratio": round(ratio, 2),
                })

    if not records:
        return pd.DataFrame(columns=["title", "days_since", "avg_gap", "ratio"])
    return pd.DataFrame(records).sort_values("ratio", ascending=False).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Diversity (Shannon entropy + Pielou's evenness)
# ---------------------------------------------------------------------------

def shannon_entropy(df: pd.DataFrame, store_slug: str | None = None) -> float:
    """Shannon entropy H of the flavor distribution (bits).

    Higher = more evenly distributed rotation.
    Max = log2(N_flavors) when all equally likely.
    """
    probs = flavor_probability(df, store_slug)
    probs = probs[probs > 0]
    return float(-(probs * np.log2(probs)).sum())


def pielou_evenness(df: pd.DataFrame, store_slug: str | None = None) -> float:
    """Pielou's J — entropy normalized to [0, 1].

    1.0 = perfectly even rotation, 0.0 = always the same flavor.
    """
    probs = flavor_probability(df, store_slug)
    n = len(probs[probs > 0])
    if n <= 1:
        return 0.0
    h = shannon_entropy(df, store_slug)
    return h / np.log2(n)


# ---------------------------------------------------------------------------
# Surprise
# ---------------------------------------------------------------------------

def surprise_score(
    df: pd.DataFrame,
    store_slug: str,
    flavor: str,
) -> float:
    """Pointwise surprise: -log2(P(flavor|store)).

    Higher = more unexpected. A flavor with 1/42 probability → ~5.4 bits.
    Returns inf if the flavor has never appeared at this store.
    """
    probs = flavor_probability(df, store_slug)
    p = probs.get(flavor, 0.0)
    if p <= 0:
        return float("inf")
    return float(-np.log2(p))


def store_summary(
    df: pd.DataFrame,
    store_slug: str,
    as_of: datetime | pd.Timestamp | None = None,
) -> dict:
    """Composite metrics summary for a single store.

    Returns dict with: unique_flavors, total_days, entropy, evenness,
    top_5_flavors, overdue_count.
    """
    store_df = df[df["store_slug"] == store_slug]
    freq = flavor_frequency(df, store_slug)

    overdue = overdue_flavors(df, store_slug, as_of=as_of)

    return {
        "store_slug": store_slug,
        "unique_flavors": int(store_df["title"].nunique()),
        "total_days": len(store_df),
        "entropy": round(shannon_entropy(df, store_slug), 3),
        "evenness": round(pielou_evenness(df, store_slug), 3),
        "top_5_flavors": freq.head(5).to_dict(),
        "overdue_count": len(overdue),
    }
