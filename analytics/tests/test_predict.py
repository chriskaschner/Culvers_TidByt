"""Tests for prediction models and evaluation framework."""

import numpy as np
import pandas as pd
import pytest

from analytics.data_loader import DEFAULT_DB, load_clean
from analytics.evaluate import compare_models, evaluate_model, time_split
from analytics.predict import FrequencyRecencyModel, MarkovRecencyModel

pytestmark = pytest.mark.skipif(
    not DEFAULT_DB.exists(), reason=f"Backfill database not found at {DEFAULT_DB}",
)

@pytest.fixture(scope="module")
def df():
    return load_clean()

@pytest.fixture(scope="module")
def train_test(df):
    return time_split(df, split_date="2026-01-01")

@pytest.fixture(scope="module")
def freq_model(train_test):
    train, _ = train_test
    return FrequencyRecencyModel().fit(train)

@pytest.fixture(scope="module")
def markov_model(train_test):
    train, _ = train_test
    return MarkovRecencyModel().fit(train)


class TestTimeSplit:
    def test_no_leakage(self, train_test):
        train, test = train_test
        assert train["flavor_date"].max() < pd.Timestamp("2026-01-01")
        assert test["flavor_date"].min() >= pd.Timestamp("2026-01-01")

    def test_both_non_empty(self, train_test):
        train, test = train_test
        assert len(train) > 1000 and len(test) > 100


class TestFrequencyRecencyModel:
    def test_predict_proba_sums_to_one(self, freq_model):
        assert abs(freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")).sum() - 1.0) < 1e-10

    def test_predict_proba_non_negative(self, freq_model):
        assert (freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")) >= 0).all()

    def test_predict_proba_has_all_flavors(self, freq_model):
        assert len(freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15"))) == len(freq_model.all_flavors)

    def test_top_prediction_is_plausible(self, freq_model, df):
        top = freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")).idxmax()
        assert top in df[df["store_slug"] == "mt-horeb"]["title"].unique()


class TestMarkovRecencyModel:
    def test_predict_proba_sums_to_one(self, markov_model):
        assert abs(markov_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")).sum() - 1.0) < 1e-10

    def test_predict_proba_non_negative(self, markov_model):
        assert (markov_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")) >= 0).all()


class TestEvaluation:
    def test_evaluate_frequency_model(self, freq_model, train_test):
        _, test = train_test
        m = evaluate_model(freq_model, test, max_samples=100)
        assert 0 <= m["top_1_accuracy"] <= 1 and 0 <= m["top_5_recall"] <= 1
        assert m["mean_log_loss"] >= 0 and m["n_samples"] == 100

    def test_top_1_beats_random(self, freq_model, train_test):
        _, test = train_test
        assert evaluate_model(freq_model, test, max_samples=500)["top_1_accuracy"] >= 0.02

    def test_top_5_recall_reasonable(self, freq_model, train_test):
        _, test = train_test
        assert evaluate_model(freq_model, test, max_samples=500)["top_5_recall"] > 0.08

    def test_compare_models(self, freq_model, markov_model, train_test):
        _, test = train_test
        comp = compare_models({"freq": freq_model, "markov": markov_model}, test, max_samples=50)
        assert len(comp) == 2 and "top_1_accuracy" in comp.columns
