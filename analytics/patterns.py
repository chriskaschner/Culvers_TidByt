"""Pattern detection: day-of-week bias, recurrence intervals, seasonal signals.

All functions accept the clean DataFrame from data_loader.load_clean().
"""

import numpy as np
import pandas as pd
from scipy import stats


# ---------------------------------------------------------------------------
# Day-of-week profiles
# ---------------------------------------------------------------------------

def dow_frequency_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Flavor × day-of-week frequency matrix (global).

    Returns DataFrame: rows=flavors, columns=0..6 (Mon..Sun), values=counts.
    """
    ct = pd.crosstab(df["title"], df["dow"])
    # Ensure all 7 days present
    for d in range(7):
        if d not in ct.columns:
            ct[d] = 0
    return ct[sorted(ct.columns)]


def dow_chi_squared(df: pd.DataFrame, min_count: int = 50) -> pd.DataFrame:
    """Chi-squared test for day-of-week scheduling bias per flavor.

    Tests H0: flavor is equally likely on all 7 days.
    Only includes flavors with at least min_count total appearances.

    Returns DataFrame with columns: title, chi2, p_value, peak_dow, peak_name.
    """
    dow_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    ct = dow_frequency_matrix(df)

    records = []
    for flavor in ct.index:
        observed = ct.loc[flavor].values
        if observed.sum() < min_count:
            continue
        chi2, p_value = stats.chisquare(observed)
        peak_dow = int(np.argmax(observed))
        records.append({
            "title": flavor,
            "chi2": round(float(chi2), 2),
            "p_value": float(p_value),
            "peak_dow": peak_dow,
            "peak_name": dow_names[peak_dow],
        })

    result = pd.DataFrame(records)
    if len(result) > 0:
        result = result.sort_values("p_value").reset_index(drop=True)
    return result


# ---------------------------------------------------------------------------
# Recurrence intervals
# ---------------------------------------------------------------------------

def recurrence_intervals(df: pd.DataFrame, store_slug: str | None = None) -> pd.DataFrame:
    """Distribution of repeat intervals (days between consecutive servings) per flavor.

    Returns DataFrame: title, mean_gap, median_gap, std_gap, min_gap, max_gap, n_intervals.
    """
    subset = df[df["store_slug"] == store_slug] if store_slug else df
    subset = subset.sort_values(["title", "store_slug", "flavor_date"])

    records = []
    for (flavor, store), group in subset.groupby(["title", "store_slug"]):
        dates = group["flavor_date"].sort_values()
        if len(dates) < 2:
            continue
        gaps = dates.diff().dropna().dt.days.values
        records.append({
            "title": flavor,
            "store_slug": store,
            "gaps": gaps,
        })

    if not records:
        return pd.DataFrame(columns=["title", "mean_gap", "median_gap", "std_gap",
                                      "min_gap", "max_gap", "n_intervals"])

    # Aggregate gaps per flavor (across all stores unless scoped)
    all_gaps: dict[str, list] = {}
    for r in records:
        all_gaps.setdefault(r["title"], []).extend(r["gaps"].tolist())

    summary = []
    for flavor, gaps in all_gaps.items():
        g = np.array(gaps)
        summary.append({
            "title": flavor,
            "mean_gap": round(float(g.mean()), 1),
            "median_gap": float(np.median(g)),
            "std_gap": round(float(g.std()), 1),
            "min_gap": int(g.min()),
            "max_gap": int(g.max()),
            "n_intervals": len(g),
        })

    return pd.DataFrame(summary).sort_values("mean_gap").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Seasonal heatmap
# ---------------------------------------------------------------------------

def seasonal_heatmap(df: pd.DataFrame) -> pd.DataFrame:
    """Month × flavor frequency matrix.

    Returns DataFrame: rows=flavors, columns=1..12 (Jan..Dec), values=counts.
    """
    ct = pd.crosstab(df["title"], df["month"])
    for m in range(1, 13):
        if m not in ct.columns:
            ct[m] = 0
    return ct[sorted(ct.columns)]


def seasonal_flavors(df: pd.DataFrame, concentration_threshold: float = 0.5) -> pd.DataFrame:
    """Identify flavors with seasonal concentration.

    A flavor is "seasonal" if > concentration_threshold of its appearances
    fall within a 3-month window.

    Returns DataFrame: title, peak_months, concentration, total_count.
    """
    heatmap = seasonal_heatmap(df)
    month_names = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
                   7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"}

    records = []
    for flavor in heatmap.index:
        counts = heatmap.loc[flavor].values
        total = counts.sum()
        if total < 20:
            continue

        # Sliding 3-month window (wrapping around Dec→Jan)
        best_start = 0
        best_sum = 0
        for start in range(12):
            window_sum = sum(counts[(start + i) % 12] for i in range(3))
            if window_sum > best_sum:
                best_sum = window_sum
                best_start = start

        concentration = best_sum / total
        if concentration >= concentration_threshold:
            peak_months = [month_names[(best_start + i) % 12 + 1] for i in range(3)]
            records.append({
                "title": flavor,
                "peak_months": ", ".join(peak_months),
                "concentration": round(concentration, 3),
                "total_count": int(total),
            })

    return pd.DataFrame(records).sort_values("concentration", ascending=False).reset_index(drop=True)
