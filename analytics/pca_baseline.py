"""PCA baseline analysis for flavor-space dimensionality reduction.

Compares PCA with the existing NMF approach to determine whether PCA
components better capture flavor similarity structure for map/front
category overlays.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from analytics.collaborative import nmf_decompose, store_flavor_matrix
from analytics.embeddings import SIMILARITY_GROUPS


def pca_decompose(
    matrix: pd.DataFrame,
    n_components: int = 6,
    scale: bool = True,
) -> tuple[pd.DataFrame, pd.DataFrame, PCA, StandardScaler | None]:
    """PCA decomposition of the store x flavor matrix.

    Args:
        matrix: stores x flavors frequency matrix (from store_flavor_matrix).
        n_components: number of principal components.
        scale: whether to standardize features before PCA.

    Returns:
        scores: stores x components (store projections).
        loadings: components x flavors (flavor loadings).
        model: fitted PCA model.
        scaler: fitted StandardScaler (or None if scale=False).
    """
    scaler = None
    X = matrix.values
    if scale:
        scaler = StandardScaler()
        X = scaler.fit_transform(X)

    model = PCA(n_components=n_components, random_state=42)
    scores_arr = model.fit_transform(X)

    scores = pd.DataFrame(scores_arr, index=matrix.index,
                          columns=[f"PC{i+1}" for i in range(n_components)])
    loadings = pd.DataFrame(model.components_, index=scores.columns,
                            columns=matrix.columns)
    return scores, loadings, model, scaler


def explained_variance_report(model: PCA) -> pd.DataFrame:
    """Summarize explained variance per component."""
    return pd.DataFrame({
        "component": [f"PC{i+1}" for i in range(model.n_components_)],
        "variance_ratio": model.explained_variance_ratio_,
        "cumulative": np.cumsum(model.explained_variance_ratio_),
    })


def top_loading_flavors(loadings: pd.DataFrame, n_top: int = 5) -> dict[str, list[str]]:
    """For each component, return the n highest-magnitude-loading flavors."""
    result = {}
    for comp in loadings.index:
        row = loadings.loc[comp].abs().sort_values(ascending=False)
        result[comp] = row.head(n_top).index.tolist()
    return result


def cluster_and_silhouette(
    embeddings: pd.DataFrame | np.ndarray,
    n_clusters: int = 5,
    random_state: int = 42,
) -> tuple[np.ndarray, float]:
    """K-Means clustering with silhouette score.

    Returns:
        labels: cluster assignment per row.
        score: silhouette score (-1 to 1, higher = better separation).
    """
    X = embeddings.values if isinstance(embeddings, pd.DataFrame) else embeddings
    if X.shape[0] <= n_clusters:
        return np.zeros(X.shape[0], dtype=int), 0.0
    km = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
    labels = km.fit_predict(X)
    if len(set(labels)) < 2:
        return labels, 0.0
    score = silhouette_score(X, labels)
    return labels, score


def group_alignment_score(
    loadings: pd.DataFrame,
    groups: dict[str, list[str]] | None = None,
) -> float:
    """Measure how well latent components align with hand-coded SIMILARITY_GROUPS.

    For each group, compute mean pairwise cosine similarity of flavor loadings
    within the group, then average across groups. Higher = better alignment.
    Flavors not in the loadings columns are silently skipped.
    """
    if groups is None:
        groups = SIMILARITY_GROUPS

    from sklearn.metrics.pairwise import cosine_similarity

    scores = []
    for _group_name, flavors in groups.items():
        present = [f for f in flavors if f in loadings.columns]
        if len(present) < 2:
            continue
        vecs = loadings[present].values.T  # (n_flavors, n_components)
        # Skip flavors with zero-norm vectors (cause NaN in cosine similarity)
        norms = np.linalg.norm(vecs, axis=1)
        nonzero_mask = norms > 1e-10
        vecs = vecs[nonzero_mask]
        if vecs.shape[0] < 2:
            continue
        sim_matrix = cosine_similarity(vecs)
        # Mean of upper triangle (excluding diagonal)
        n = sim_matrix.shape[0]
        triu_indices = np.triu_indices(n, k=1)
        mean_sim = sim_matrix[triu_indices].mean()
        scores.append(mean_sim)

    return float(np.mean(scores)) if scores else 0.0


def compare_pca_vs_nmf(
    matrix: pd.DataFrame,
    n_components: int = 6,
    n_clusters: int = 5,
) -> dict:
    """Run both PCA and NMF, compare silhouette scores and group alignment.

    Returns dict with all comparison metrics.
    """
    # PCA
    pca_scores, pca_loadings, pca_model, _ = pca_decompose(matrix, n_components)
    pca_labels, pca_silhouette = cluster_and_silhouette(pca_scores, n_clusters)
    pca_alignment = group_alignment_score(pca_loadings)
    pca_var = explained_variance_report(pca_model)

    # NMF
    W, H, nmf_model = nmf_decompose(matrix, n_components)
    nmf_labels, nmf_silhouette = cluster_and_silhouette(W, n_clusters)
    H_df = pd.DataFrame(H, index=[f"NMF{i+1}" for i in range(n_components)],
                        columns=matrix.columns)
    nmf_alignment = group_alignment_score(H_df)

    return {
        "pca_silhouette": pca_silhouette,
        "nmf_silhouette": nmf_silhouette,
        "silhouette_delta": pca_silhouette - nmf_silhouette,
        "pca_alignment": pca_alignment,
        "nmf_alignment": nmf_alignment,
        "alignment_delta": pca_alignment - nmf_alignment,
        "pca_cumulative_variance_at_3": float(pca_var["cumulative"].iloc[min(2, len(pca_var)-1)]),
        "pca_components": n_components,
        "n_stores": matrix.shape[0],
        "n_flavors": matrix.shape[1],
        "recommendation": _recommend(pca_silhouette, nmf_silhouette,
                                      pca_alignment, nmf_alignment),
    }


def _recommend(pca_sil: float, nmf_sil: float,
               pca_align: float, nmf_align: float) -> str:
    """Decision gate: recommend PCA if silhouette >0.05 better AND alignment better."""
    if (pca_sil - nmf_sil) > 0.05 and pca_align > nmf_align:
        return "pca"
    return "nmf"
