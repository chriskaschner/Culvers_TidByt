"""Tests for PCA baseline analysis: decomposition, variance, clustering, alignment."""

import numpy as np
import pandas as pd
import pytest

from analytics.data_loader import DEFAULT_DB, load_clean
from analytics.collaborative import store_flavor_matrix
from analytics.embeddings import SIMILARITY_GROUPS
from analytics.pca_baseline import (
    cluster_and_silhouette,
    compare_pca_vs_nmf,
    explained_variance_report,
    group_alignment_score,
    pca_decompose,
    top_loading_flavors,
)

pytestmark = pytest.mark.skipif(
    not DEFAULT_DB.exists(), reason=f"Backfill database not found at {DEFAULT_DB}",
)


@pytest.fixture(scope="module")
def df():
    return load_clean()


@pytest.fixture(scope="module")
def matrix(df):
    return store_flavor_matrix(df, normalize_rows=True)


class TestPCADecompose:
    def test_shapes(self, matrix):
        n_components = 6
        scores, loadings, model, scaler = pca_decompose(matrix, n_components)
        assert scores.shape == (matrix.shape[0], n_components)
        assert loadings.shape == (n_components, matrix.shape[1])

    def test_scores_index_matches_matrix(self, matrix):
        scores, _, _, _ = pca_decompose(matrix, 3)
        assert list(scores.index) == list(matrix.index)

    def test_loadings_columns_match_flavors(self, matrix):
        _, loadings, _, _ = pca_decompose(matrix, 3)
        assert list(loadings.columns) == list(matrix.columns)

    def test_explained_variance_sums_below_one(self, matrix):
        _, _, model, _ = pca_decompose(matrix, 6)
        total = model.explained_variance_ratio_.sum()
        assert 0 < total <= 1.0 + 1e-10

    def test_no_scaling(self, matrix):
        scores, _, _, scaler = pca_decompose(matrix, 3, scale=False)
        assert scaler is None
        assert scores.shape[0] == matrix.shape[0]


class TestExplainedVariance:
    def test_report_columns(self, matrix):
        _, _, model, _ = pca_decompose(matrix, 6)
        report = explained_variance_report(model)
        assert set(report.columns) == {"component", "variance_ratio", "cumulative"}

    def test_cumulative_monotonic(self, matrix):
        _, _, model, _ = pca_decompose(matrix, 6)
        report = explained_variance_report(model)
        cumulative = report["cumulative"].values
        assert all(cumulative[i] <= cumulative[i + 1] for i in range(len(cumulative) - 1))


class TestTopLoadingFlavors:
    def test_returns_correct_count(self, matrix):
        _, loadings, _, _ = pca_decompose(matrix, 3)
        result = top_loading_flavors(loadings, n_top=5)
        assert len(result) == 3
        for comp, flavors in result.items():
            assert len(flavors) <= 5

    def test_flavors_are_valid(self, matrix):
        _, loadings, _, _ = pca_decompose(matrix, 3)
        result = top_loading_flavors(loadings, n_top=3)
        all_flavors = set(matrix.columns)
        for flavors in result.values():
            for f in flavors:
                assert f in all_flavors


class TestClusterAndSilhouette:
    def test_labels_shape(self, matrix):
        scores, _, _, _ = pca_decompose(matrix, 6)
        labels, score = cluster_and_silhouette(scores, n_clusters=5)
        assert len(labels) == matrix.shape[0]

    def test_silhouette_range(self, matrix):
        scores, _, _, _ = pca_decompose(matrix, 6)
        _, score = cluster_and_silhouette(scores, n_clusters=5)
        assert -1 <= score <= 1

    def test_small_input_returns_zero(self):
        tiny = pd.DataFrame(np.random.rand(3, 4))
        labels, score = cluster_and_silhouette(tiny, n_clusters=5)
        assert score == 0.0


class TestGroupAlignment:
    def test_returns_float(self, matrix):
        _, loadings, _, _ = pca_decompose(matrix, 6)
        score = group_alignment_score(loadings)
        assert isinstance(score, float)

    def test_range(self, matrix):
        _, loadings, _, _ = pca_decompose(matrix, 6)
        score = group_alignment_score(loadings)
        assert -1 <= score <= 1

    def test_custom_groups(self, matrix):
        _, loadings, _, _ = pca_decompose(matrix, 6)
        custom = {"test": ["Vanilla", "Butter Pecan"]}
        score = group_alignment_score(loadings, groups=custom)
        assert isinstance(score, float)


class TestCompareVsNMF:
    def test_comparison_keys(self, matrix):
        result = compare_pca_vs_nmf(matrix, n_components=4, n_clusters=3)
        expected_keys = {
            "pca_silhouette", "nmf_silhouette", "silhouette_delta",
            "pca_alignment", "nmf_alignment", "alignment_delta",
            "pca_cumulative_variance_at_3", "pca_components",
            "n_stores", "n_flavors", "recommendation",
        }
        assert set(result.keys()) == expected_keys

    def test_recommendation_is_valid(self, matrix):
        result = compare_pca_vs_nmf(matrix, n_components=4, n_clusters=3)
        assert result["recommendation"] in ("pca", "nmf")

    def test_dimensions_match(self, matrix):
        result = compare_pca_vs_nmf(matrix, n_components=4, n_clusters=3)
        assert result["n_stores"] == matrix.shape[0]
        assert result["n_flavors"] == matrix.shape[1]
