import pytest

from app.calculations import calculate_fertilizer, calculate_irrigation


def test_fertilizer_calculation_uses_product_contributions_and_rounds_packages() -> None:
    result = calculate_fertilizer(
        target_n_g_per_tree=200,
        target_p2o5_g_per_tree=0,
        target_k2o_g_per_tree=0,
        composition_n_pct=46,
        composition_p2o5_pct=0,
        composition_k2o_pct=0,
        tree_count=10,
        package_kg=1,
        price_per_package=12,
    )

    assert result["product_grams_per_tree"] == pytest.approx(200 / 0.46)
    assert result["total_product_kg"] == pytest.approx((200 / 0.46) * 10 / 1000)
    assert result["package_count"] == 5
    assert result["estimated_purchase_cost"] == 60
    assert result["supplied_n_g_per_tree"] == pytest.approx(200)
    assert result["execution_authorized"] is False


def test_fertilizer_calculation_reports_excess_from_combined_nutrients() -> None:
    result = calculate_fertilizer(
        target_n_g_per_tree=100,
        target_p2o5_g_per_tree=50,
        target_k2o_g_per_tree=0,
        composition_n_pct=20,
        composition_p2o5_pct=20,
        composition_k2o_pct=0,
        tree_count=1,
    )

    assert result["product_grams_per_tree"] == pytest.approx(500)
    assert result["supplied_n_g_per_tree"] == pytest.approx(100)
    assert result["supplied_p2o5_g_per_tree"] == pytest.approx(100)
    assert result["excess_p2o5_g_per_tree"] == pytest.approx(50)


def test_fertilizer_calculation_rejects_missing_target_nutrient() -> None:
    with pytest.raises(ValueError, match="não contém P2O5"):
        calculate_fertilizer(
            target_n_g_per_tree=10,
            target_p2o5_g_per_tree=1,
            target_k2o_g_per_tree=0,
            composition_n_pct=46,
            composition_p2o5_pct=0,
            composition_k2o_pct=0,
            tree_count=1,
        )


def test_irrigation_calculation_applies_effective_rain_and_efficiency() -> None:
    result = calculate_irrigation(
        eto_mm_day=5,
        kc=0.8,
        effective_rain_mm_day=1,
        efficiency_percent=80,
        area_ha=2,
        tree_count=100,
        emitters_per_tree=2,
        flow_liters_per_hour=4,
    )

    assert result["etc_mm_day"] == pytest.approx(4)
    assert result["net_irrigation_depth_mm_day"] == pytest.approx(3)
    assert result["gross_irrigation_depth_mm_day"] == pytest.approx(3.75)
    assert result["total_volume_m3_day"] == pytest.approx(75)
    assert result["total_volume_liters_day"] == pytest.approx(75_000)
    assert result["liters_per_tree_day"] == pytest.approx(750)
    assert result["runtime_hours_estimate"] == pytest.approx(93.75)
    assert result["execution_authorized"] is False


def test_effective_rain_can_reduce_irrigation_estimate_to_zero() -> None:
    result = calculate_irrigation(
        eto_mm_day=4,
        kc=1,
        effective_rain_mm_day=5,
        efficiency_percent=80,
        area_ha=1,
        tree_count=10,
    )

    assert result["net_irrigation_depth_mm_day"] == 0
    assert result["total_volume_liters_day"] == 0
