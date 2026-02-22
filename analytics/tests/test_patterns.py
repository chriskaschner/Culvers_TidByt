"""Tests for pattern detection and Markov transition matrices."""

import numpy as np
import pandas as pd
import pytest

from analytics.data_loader import DEFAULT_DB, load_clean
from analytics.patterns import (
    dow_chi_squared, dow_frequency_matrix, recurrence_intervals,
    seasonal_flavors, seasonal_heatmap,
)
from analytics.markov import (
    build_transition_counts, self_transition_rate, top_transitions, transition_matrix,
)

pytestmark = pytest.mark.skipif(
    not DEFAULT_DB.exists(), reason=f"Backfill database not found at {DEFAULT_DB}",
)

@pytest.fixture(scope="module")
def df():
    return load_clean()


class TestDayOfWeek:
    def test_dow_matrix_shape(self, df):
        mat = dow_frequency_matrix(df)
        assert mat.shape[1] == 7 and mat.shape[0] > 30

    def test_dow_matrix_counts_match(self, df):
        mat = dow_frequency_matrix(df)
        expected = df["title"].value_counts()
        for flavor in mat.index:
            assert mat.loc[flavor].sum() == expected[flavor]

    def test_chi_squared_returns_results(self, df):
        results = dow_chi_squared(df)
        assert len(results) > 0 and "chi2" in results.columns and "p_value" in results.columns

    def test_chi_squared_p_values_valid(self, df):
        results = dow_chi_squared(df)
        assert (results["p_value"] >= 0).all() and (results["p_value"] <= 1).all()

    def test_some_flavors_have_dow_bias(self, df):
        assert len(dow_chi_squared(df).query("p_value < 0.05")) >= 3


class TestRecurrenceIntervals:
    def test_global_intervals_cover_most_flavors(self, df):
        assert len(recurrence_intervals(df)) > 30

    def test_mean_gap_in_reasonable_range(self, df):
        median = recurrence_intervals(df)["mean_gap"].median()
        assert 20 < median < 90

    def test_store_scoped_intervals(self, df):
        assert len(recurrence_intervals(df, store_slug="mt-horeb")) > 10

    def test_intervals_have_expected_columns(self, df):
        assert {"title", "mean_gap", "median_gap", "std_gap", "min_gap", "max_gap", "n_intervals"} <= set(recurrence_intervals(df).columns)


class TestSeasonal:
    def test_heatmap_12_months(self, df):
        assert seasonal_heatmap(df).shape[1] == 12

    def test_heatmap_counts_match(self, df):
        assert seasonal_heatmap(df).values.sum() == len(df)

    def test_seasonal_flavors_detected(self, df):
        assert len(seasonal_flavors(df, concentration_threshold=0.5)) >= 1

    def test_seasonal_concentration_valid(self, df):
        s = seasonal_flavors(df, concentration_threshold=0.5)
        if len(s) > 0:
            assert (s["concentration"] >= 0.5).all() and (s["concentration"] <= 1.0).all()


class TestMarkov:
    def test_transition_counts_symmetric_shape(self, df):
        counts, labels = build_transition_counts(df)
        assert counts.shape[0] == counts.shape[1] == len(labels)

    def test_transition_matrix_rows_sum_to_one(self, df):
        tm = transition_matrix(df)
        active = tm.sum(axis=1)
        np.testing.assert_allclose(active[active > 0].values, 1.0, atol=1e-10)

    def test_transition_matrix_non_negative(self, df):
        assert (transition_matrix(df).values >= 0).all()

    def test_top_transitions_returns_results(self, df):
        top = top_transitions(df, "Turtle")
        assert len(top) > 0 and all("flavor" in t and "probability" in t for t in top)

    def test_top_transitions_probabilities_valid(self, df):
        assert all(0 < t["probability"] <= 1 for t in top_transitions(df, "Turtle", n=10))

    def test_top_transitions_unknown_flavor(self, df):
        assert top_transitions(df, "Nonexistent Flavor XYZ") == []

    def test_self_transition_low(self, df):
        assert self_transition_rate(df).median() < 0.15

    def test_self_transition_bounded(self, df):
        st = self_transition_rate(df)
        assert (st >= 0).all() and (st <= 1).all()
