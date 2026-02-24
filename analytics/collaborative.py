"""Collaborative filtering — store×flavor matrix, NMF decomposition, store clustering.

The portfolio centerpiece: Culver's stores are "users", flavors are "items".
NMF discovers latent "taste profiles" and clusters stores by scheduling behavior.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.decomposition import NMF
from sklearn.cluster import KMeans

STORES_JSON = Path(__file__).resolve().parent.parent / "docs" / "stores.json"


# ---------------------------------------------------------------------------
# Store × Flavor matrix
# ---------------------------------------------------------------------------

def store_flavor_matrix(df: pd.DataFrame, normalize_rows: bool = True) -> pd.DataFrame:
    """Build stores × flavors frequency matrix.

    Rows = store slugs, columns = flavor titles, values = appearance counts.
    If normalize_rows=True, each row is L1-normalized (sums to 1.0) so stores
    with more data don't dominate.
    """
    ct = pd.crosstab(df["store_slug"], df["title"])
    if normalize_rows:
        row_sums = ct.sum(axis=1)
        row_sums = row_sums.replace(0, 1)
        ct = ct.div(row_sums, axis=0)
    return ct


# ---------------------------------------------------------------------------
# NMF decomposition
# ---------------------------------------------------------------------------

def nmf_decompose(
    matrix: pd.DataFrame,
    n_components: int = 6,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, NMF]:
    """Non-negative Matrix Factorization of the store×flavor matrix.

    Returns:
        W: stores × components (store latent profiles)
        H: components × flavors (latent flavor profiles)
        model: fitted NMF model
    """
    model = NMF(n_components=n_components, random_state=random_state, max_iter=1000)
    W = model.fit_transform(matrix.values)
    H = model.components_

    W_df = pd.DataFrame(W, index=matrix.index,
                        columns=[f"factor_{i}" for i in range(n_components)])
    H_df = pd.DataFrame(H, index=[f"factor_{i}" for i in range(n_components)],
                        columns=matrix.columns)
    return W_df, H_df, model


def factor_top_flavors(H: pd.DataFrame, n: int = 5) -> dict[str, list[str]]:
    """Top-n flavors per latent factor — reveals what each factor "means".

    Returns dict mapping factor name → list of flavor titles.
    """
    result = {}
    for factor in H.index:
        top = H.loc[factor].sort_values(ascending=False).head(n)
        result[factor] = top.index.tolist()
    return result


# ---------------------------------------------------------------------------
# Store clustering
# ---------------------------------------------------------------------------

def cluster_stores(
    W: pd.DataFrame,
    n_clusters: int = 5,
    random_state: int = 42,
) -> pd.Series:
    """K-Means clustering on NMF store latent factors.

    Returns Series: index=store_slug, values=cluster_id (0..n_clusters-1).
    """
    km = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
    labels = km.fit_predict(W.values)
    return pd.Series(labels, index=W.index, name="cluster")


def cluster_summary(
    df: pd.DataFrame,
    clusters: pd.Series,
    n_top_flavors: int = 5,
) -> dict[int, dict]:
    """Summarize each cluster: size, top flavors, example stores.

    Returns dict mapping cluster_id → {size, top_flavors, example_stores}.
    """
    result = {}
    for cluster_id in sorted(clusters.unique()):
        stores_in_cluster = clusters[clusters == cluster_id].index.tolist()
        cluster_df = df[df["store_slug"].isin(stores_in_cluster)]
        top_flavors = cluster_df["title"].value_counts().head(n_top_flavors).index.tolist()
        result[cluster_id] = {
            "size": len(stores_in_cluster),
            "top_flavors": top_flavors,
            "example_stores": stores_in_cluster[:5],
        }
    return result


# ---------------------------------------------------------------------------
# Geographic mapping
# ---------------------------------------------------------------------------

def load_store_locations() -> pd.DataFrame:
    """Load store lat/lng from docs/stores.json.

    Returns DataFrame: slug, name, city, state, lat, lng.
    """
    with open(STORES_JSON) as f:
        data = json.load(f)
    stores = data["stores"]
    return pd.DataFrame(stores)


def cluster_geo_summary(
    clusters: pd.Series,
    locations: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Geographic summary per cluster: centroid lat/lng, state distribution.

    Returns DataFrame: cluster, n_stores, mean_lat, mean_lng, top_states.
    """
    if locations is None:
        locations = load_store_locations()

    cluster_df = clusters.rename("cluster").reset_index()
    # The index name may be "store_slug" (from the matrix) or generic "index"
    idx_col = cluster_df.columns[0]
    if idx_col != "slug":
        cluster_df = cluster_df.rename(columns={idx_col: "slug"})
    merged = locations.merge(cluster_df, on="slug", how="inner")

    records = []
    for cluster_id, group in merged.groupby("cluster"):
        top_states = group["state"].value_counts().head(3)
        state_str = ", ".join(f"{s}({n})" for s, n in top_states.items())
        records.append({
            "cluster": int(cluster_id),
            "n_stores": len(group),
            "mean_lat": round(group["lat"].mean(), 4),
            "mean_lng": round(group["lng"].mean(), 4),
            "top_states": state_str,
        })

    return pd.DataFrame(records).sort_values("cluster").reset_index(drop=True)
