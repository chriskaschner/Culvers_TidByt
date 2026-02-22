"""Tests for embeddings and forecast writer."""

import pandas as pd
import pytest

from analytics.data_loader import DEFAULT_DB, load_clean
from analytics.embeddings import SEED_CATALOG, nearest_neighbors, validate_against_groups
from analytics.forecast_writer import build_forecast_context, format_forecast_template, generate_forecast_json
from analytics.predict import FrequencyRecencyModel
from analytics.evaluate import time_split

pytestmark = pytest.mark.skipif(
    not DEFAULT_DB.exists(), reason=f"Backfill database not found at {DEFAULT_DB}",
)


class TestEmbeddingLogic:
    @pytest.fixture(scope="class")
    def tfidf_embeddings(self):
        from sklearn.feature_extraction.text import TfidfVectorizer
        import numpy as np
        texts = [f"{f['title']}: {f['description']}" for f in SEED_CATALOG]
        titles = [f["title"] for f in SEED_CATALOG]
        embeddings = TfidfVectorizer().fit_transform(texts).toarray().astype(np.float32)
        return titles, embeddings

    def test_nearest_neighbors_turtle(self, tfidf_embeddings):
        titles, emb = tfidf_embeddings
        names = [n["title"] for n in nearest_neighbors(emb, titles, "Turtle", n=5)]
        assert len({"Caramel Turtle", "Turtle Dove", "Turtle Cheesecake"} & set(names)) >= 1

    def test_nearest_neighbors_mint(self, tfidf_embeddings):
        titles, emb = tfidf_embeddings
        names = [n["title"] for n in nearest_neighbors(emb, titles, "Mint Cookie", n=5)]
        assert len({"Andes Mint Avalanche", "Mint Explosion"} & set(names)) >= 1

    def test_validate_groups_ratios(self, tfidf_embeddings):
        titles, emb = tfidf_embeddings
        results = validate_against_groups(emb, titles)
        assert sum(1 for k, v in results.items() if k != "_overall" and v["ratio"] > 1.0) >= 3

    def test_validate_overall_ratio(self, tfidf_embeddings):
        titles, emb = tfidf_embeddings
        assert validate_against_groups(emb, titles)["_overall"]["mean_ratio"] > 1.0


@pytest.fixture(scope="module")
def forecast_fixtures():
    df = load_clean()
    train, _ = time_split(df, "2026-01-01")
    return FrequencyRecencyModel().fit(train), df


class TestForecastWriter:
    def test_build_context_keys(self, forecast_fixtures):
        model, df = forecast_fixtures
        ctx = build_forecast_context(model, df, "mt-horeb", pd.Timestamp("2026-02-15"))
        assert {"store_slug", "store_name", "date", "day_of_week", "predictions", "overdue_flavors", "recent_history"} <= set(ctx.keys())

    def test_context_predictions_sorted(self, forecast_fixtures):
        model, df = forecast_fixtures
        probs = [p["probability"] for p in build_forecast_context(model, df, "mt-horeb", pd.Timestamp("2026-02-15"))["predictions"]]
        assert probs == sorted(probs, reverse=True)

    def test_template_forecast_nonempty(self, forecast_fixtures):
        model, df = forecast_fixtures
        prose = format_forecast_template(build_forecast_context(model, df, "mt-horeb", pd.Timestamp("2026-02-15")))
        assert len(prose) > 50 and "Mt Horeb" in prose

    def test_generate_forecast_json_structure(self, forecast_fixtures):
        model, df = forecast_fixtures
        result = generate_forecast_json(model, df, "mt-horeb", pd.Timestamp("2026-02-15"))
        assert "predictions" in result and "prose" in result
        assert abs(result["total_probability"] - 1.0) < 0.01 and len(result["predictions"]) == 10

    def test_forecast_probabilities_sum(self, forecast_fixtures):
        model, df = forecast_fixtures
        result = generate_forecast_json(model, df, "mt-horeb", pd.Timestamp("2026-02-15"))
        assert sum(p["probability"] for p in result["predictions"]) > 0.15
