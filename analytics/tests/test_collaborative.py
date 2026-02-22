"""Tests for collaborative filtering: NMF, store clustering, geographic mapping."""

import numpy as np
import pandas as pd
import pytest

from analytics.data_loader import DEFAULT_DB, load_clean
from analytics.collaborative import (
    cluster_geo_summary, cluster_stores, cluster_summary, factor_top_flavors,
    load_store_locations, nmf_decompose, store_flavor_matrix,
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

@pytest.fixture(scope="module")
def nmf_results(matrix):
    return nmf_decompose(matrix, n_components=6)


class TestStoreFlavorMatrix:
    def test_shape(self, matrix, df):
        assert matrix.shape == (df["store_slug"].nunique(), df["title"].nunique())

    def test_normalized_rows_sum_to_one(self, matrix):
        np.testing.assert_allclose(matrix.sum(axis=1).values, 1.0, atol=1e-10)

    def test_non_negative(self, matrix):
        assert (matrix.values >= 0).all()

    def test_unnormalized_has_integer_counts(self, df):
        raw = store_flavor_matrix(df, normalize_rows=False)
        assert (raw.values >= 0).all() and (raw.values == raw.values.astype(int)).all()


class TestNMF:
    def test_W_shape(self, nmf_results, matrix):
        W, H, _ = nmf_results
        assert W.shape == (matrix.shape[0], 6)

    def test_H_shape(self, nmf_results, matrix):
        _, H, _ = nmf_results
        assert H.shape == (6, matrix.shape[1])

    def test_non_negative_factors(self, nmf_results):
        W, H, _ = nmf_results
        assert (W.values >= 0).all() and (H.values >= 0).all()

    def test_factor_top_flavors(self, nmf_results):
        _, H, _ = nmf_results
        tops = factor_top_flavors(H, n=5)
        assert len(tops) == 6
        assert all(len(v) == 5 for v in tops.values())


class TestClustering:
    def test_cluster_labels(self, nmf_results):
        W, _, _ = nmf_results
        clusters = cluster_stores(W, n_clusters=5)
        assert len(clusters) == len(W) and set(clusters.unique()) <= {0, 1, 2, 3, 4}

    def test_cluster_summary_keys(self, df, nmf_results):
        W, _, _ = nmf_results
        summary = cluster_summary(df, cluster_stores(W, n_clusters=5))
        assert all("size" in v and "top_flavors" in v for v in summary.values())

    def test_cluster_sizes_sum_to_total(self, df, nmf_results):
        W, _, _ = nmf_results
        summary = cluster_summary(df, cluster_stores(W, n_clusters=5))
        assert sum(v["size"] for v in summary.values()) == df["store_slug"].nunique()


class TestGeographic:
    def test_store_locations_loaded(self):
        locs = load_store_locations()
        assert len(locs) > 900 and {"slug", "lat", "lng", "state"} <= set(locs.columns)

    def test_cluster_geo_summary(self, nmf_results):
        W, _, _ = nmf_results
        geo = cluster_geo_summary(cluster_stores(W, n_clusters=5))
        assert len(geo) == 5 and "mean_lat" in geo.columns
