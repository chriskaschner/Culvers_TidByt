"""Flavor description embeddings — sentence-transformer vectors, UMAP projection.

Uses all-MiniLM-L6-v2 (80MB local model) to embed SEED_CATALOG descriptions,
then validates clusters against hand-coded SIMILARITY_GROUPS.

Requires: pip install sentence-transformers umap-learn
"""

import numpy as np
import pandas as pd

# Flavor catalog extracted from worker/src/flavor-catalog.js
SEED_CATALOG = [
    {"title": "Andes Mint Avalanche", "description": "Mint Fresh Frozen Custard with Andes Mint pieces and chocolate."},
    {"title": "Blackberry Cobbler", "description": "Blackberry Fresh Frozen Custard with pie crust pieces."},
    {"title": "Brownie Thunder", "description": "Chocolate Fresh Frozen Custard with brownie pieces and marshmallow."},
    {"title": "Butter Pecan", "description": "Butter Pecan Fresh Frozen Custard."},
    {"title": "Caramel Cashew", "description": "Vanilla Fresh Frozen Custard with caramel and cashew pieces."},
    {"title": "Caramel Fudge Cookie Dough", "description": "Vanilla Fresh Frozen Custard with caramel, fudge, and cookie dough."},
    {"title": "Caramel Pecan", "description": "Caramel Fresh Frozen Custard with pecan pieces."},
    {"title": "Caramel Turtle", "description": "Caramel Fresh Frozen Custard with pecan pieces and fudge."},
    {"title": "Chocolate Caramel Twist", "description": "Chocolate and Vanilla Fresh Frozen Custard with caramel."},
    {"title": "Chocolate Heath Crunch", "description": "Chocolate Fresh Frozen Custard with Heath bar pieces."},
    {"title": "Chocolate Oreo Volcano", "description": "Chocolate Fresh Frozen Custard with OREO cookie pieces and marshmallow."},
    {"title": "Chocolate Volcano", "description": "Chocolate Fresh Frozen Custard with fudge and marshmallow."},
    {"title": "Crazy for Cookie Dough", "description": "Vanilla Fresh Frozen Custard with cookie dough pieces and fudge."},
    {"title": "Dark Chocolate Decadence", "description": "Dark Chocolate Fresh Frozen Custard with fudge and chocolate chips."},
    {"title": "Dark Chocolate PB Crunch", "description": "Dark Chocolate Fresh Frozen Custard with peanut butter and chocolate crunch."},
    {"title": "Georgia Peach Pecan", "description": "Peach Fresh Frozen Custard with pecan pieces."},
    {"title": "Lemon Berry Layer Cake", "description": "Lemon Fresh Frozen Custard with blueberries and cake pieces."},
    {"title": "Lemon Dash Cookie", "description": "Lemon Fresh Frozen Custard with cookie pieces."},
    {"title": "Mint Cookie", "description": "Mint Fresh Frozen Custard with cookie pieces."},
    {"title": "Mint Explosion", "description": "Mint Fresh Frozen Custard with OREO cookie pieces and fudge."},
    {"title": "OREO Cheesecake", "description": "Cheesecake Fresh Frozen Custard with OREO cookie pieces."},
    {"title": "OREO Cookie Cheesecake", "description": "Cheesecake Fresh Frozen Custard with OREO cookie pieces."},
    {"title": "OREO Cookies and Cream", "description": "Vanilla Fresh Frozen Custard with OREO cookie pieces."},
    {"title": "Peanut Butter Cup", "description": "Chocolate Fresh Frozen Custard with peanut butter cup pieces."},
    {"title": "Raspberry Cheesecake", "description": "Cheesecake Fresh Frozen Custard with raspberry sauce."},
    {"title": "Really Reese's", "description": "Chocolate Fresh Frozen Custard with Reese's peanut butter cup pieces."},
    {"title": "Salted Caramel Pecan Pie", "description": "Salted Caramel Fresh Frozen Custard with pecan pie pieces."},
    {"title": "Snickers Swirl", "description": "Chocolate Fresh Frozen Custard with Snickers bar pieces and caramel."},
    {"title": "Strawberry Cheesecake", "description": "Cheesecake Fresh Frozen Custard with strawberry sauce."},
    {"title": "Turtle", "description": "Vanilla Fresh Frozen Custard with pecan pieces, caramel, and fudge."},
    {"title": "Turtle Cheesecake", "description": "Cheesecake Fresh Frozen Custard with pecan pieces, caramel, and fudge."},
    {"title": "Turtle Dove", "description": "Chocolate and Vanilla Fresh Frozen Custard with pecan pieces, caramel, and fudge."},
]

# Hand-coded similarity groups from worker/src/flavor-matcher.js (for validation)
SIMILARITY_GROUPS = {
    "mint": ["Andes Mint Avalanche", "Mint Cookie", "Mint Explosion"],
    "chocolate": ["Chocolate Caramel Twist", "Chocolate Heath Crunch", "Chocolate Volcano",
                  "Dark Chocolate Decadence", "Dark Chocolate PB Crunch", "Chocolate Oreo Volcano"],
    "caramel": ["Caramel Cashew", "Caramel Fudge Cookie Dough", "Caramel Pecan",
                "Caramel Turtle", "Salted Caramel Pecan Pie", "Chocolate Caramel Twist"],
    "cheesecake": ["OREO Cheesecake", "OREO Cookie Cheesecake", "Raspberry Cheesecake",
                   "Strawberry Cheesecake", "Turtle Cheesecake"],
    "turtle": ["Turtle", "Turtle Dove", "Turtle Cheesecake", "Caramel Turtle"],
}


def embed_flavors(
    catalog: list[dict] | None = None,
    model_name: str = "all-MiniLM-L6-v2",
) -> tuple[pd.DataFrame, np.ndarray]:
    """Embed flavor descriptions using sentence-transformers.

    Returns:
        df: DataFrame with title, description columns
        embeddings: (n_flavors, embedding_dim) array
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        raise ImportError(
            "sentence-transformers required. Install with: uv sync --extra ml"
        )

    if catalog is None:
        catalog = SEED_CATALOG

    model = SentenceTransformer(model_name)
    texts = [f"{f['title']}: {f['description']}" for f in catalog]
    embeddings = model.encode(texts, show_progress_bar=False)

    df = pd.DataFrame(catalog)
    return df, np.array(embeddings)


def nearest_neighbors(
    embeddings: np.ndarray,
    titles: list[str],
    query_title: str,
    n: int = 5,
) -> list[dict]:
    """Find n nearest neighbors by cosine similarity."""
    idx = titles.index(query_title)
    query = embeddings[idx]

    norms = np.linalg.norm(embeddings, axis=1) * np.linalg.norm(query)
    norms = np.where(norms == 0, 1, norms)
    similarities = embeddings @ query / norms

    ranked = np.argsort(-similarities)
    results = []
    for i in ranked:
        if titles[i] == query_title:
            continue
        results.append({
            "title": titles[i],
            "similarity": round(float(similarities[i]), 4),
        })
        if len(results) >= n:
            break
    return results


def umap_project(
    embeddings: np.ndarray,
    n_components: int = 2,
    random_state: int = 42,
) -> np.ndarray:
    """Project embeddings to 2D via UMAP for visualization."""
    try:
        import umap
    except ImportError:
        raise ImportError("umap-learn required. Install with: uv sync --extra ml")

    reducer = umap.UMAP(n_components=n_components, random_state=random_state, n_neighbors=8)
    return reducer.fit_transform(embeddings)


def validate_against_groups(
    embeddings: np.ndarray,
    titles: list[str],
    groups: dict[str, list[str]] | None = None,
) -> dict:
    """Validate embedding clusters against hand-coded SIMILARITY_GROUPS.

    For each group, measures average intra-group cosine similarity vs
    average inter-group similarity. Higher ratio = better alignment.
    """
    if groups is None:
        groups = SIMILARITY_GROUPS

    title_to_idx = {t: i for i, t in enumerate(titles)}

    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    normed = embeddings / norms

    results = {}
    for group_name, members in groups.items():
        member_indices = [title_to_idx[m] for m in members if m in title_to_idx]
        if len(member_indices) < 2:
            continue

        group_embs = normed[member_indices]
        sim_matrix = group_embs @ group_embs.T
        n = len(member_indices)
        intra_sim = (sim_matrix.sum() - n) / (n * (n - 1)) if n > 1 else 0

        non_member_indices = [i for i in range(len(titles)) if i not in member_indices]
        if non_member_indices:
            non_member_embs = normed[non_member_indices]
            inter_sim = (group_embs @ non_member_embs.T).mean()
        else:
            inter_sim = 0

        results[group_name] = {
            "intra_similarity": round(float(intra_sim), 4),
            "inter_similarity": round(float(inter_sim), 4),
            "ratio": round(float(intra_sim / inter_sim), 4) if inter_sim > 0 else float("inf"),
            "n_members": len(member_indices),
        }

    ratios = [v["ratio"] for v in results.values() if v["ratio"] != float("inf")]
    results["_overall"] = {
        "mean_ratio": round(float(np.mean(ratios)), 4) if ratios else 0,
        "n_groups": len(results) - 1,
    }

    return results
