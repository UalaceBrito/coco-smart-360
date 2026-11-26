from math import ceil


HISTORICAL_FERTILIZATION_REFERENCE = {
    "source": "Nutrição e Adubação do Coqueiro — Davi José Silva, Embrapa Semiárido",
    "publication_year": 2000,
    "reference_status": "historical_not_a_universal_recommendation",
    "note": (
        "Valores históricos informados no escopo do projeto. Faixas de P2O5 e K2O dependem "
        "da análise de solo e da tabela original; valide com orientação técnica regional."
    ),
    "annual_ranges_g_per_tree": [
        {"age": "1 ano", "n": 200, "p2o5_min": None, "p2o5_max": None, "k2o_min": 60, "k2o_max": 250},
        {"age": "2 anos", "n": 450, "p2o5_min": 45, "p2o5_max": 180, "k2o_min": 125, "k2o_max": 500},
        {"age": "3 anos", "n": 600, "p2o5_min": 50, "p2o5_max": 210, "k2o_min": 150, "k2o_max": 600},
        {"age": "4 anos", "n": 750, "p2o5_min": 60, "p2o5_max": 240, "k2o_min": 175, "k2o_max": 700},
        {"age": "5 anos", "n": 900, "p2o5_min": 75, "p2o5_max": 300, "k2o_min": 210, "k2o_max": 850},
        {"age": "6 anos ou mais", "n": 1000, "p2o5_min": 100, "p2o5_max": 400, "k2o_min": 250, "k2o_max": 1000},
    ],
}

HISTORICAL_LEAF_CRITICAL_LEVELS = {
    "source": HISTORICAL_FERTILIZATION_REFERENCE["source"],
    "publication_year": 2000,
    "leaf": "folha 14",
    "variety": "híbrido",
    "reference_status": "historical_not_universal",
    "levels": [
        {"nutrient": "N", "minimum": 18, "maximum": 22, "unit": "g/kg"},
        {"nutrient": "P", "minimum": 1.2, "maximum": 1.2, "unit": "g/kg"},
        {"nutrient": "K", "minimum": 14, "maximum": 14, "unit": "g/kg"},
        {"nutrient": "Ca", "minimum": 5, "maximum": 5, "unit": "g/kg"},
        {"nutrient": "Mg", "minimum": 2, "maximum": 2.4, "unit": "g/kg"},
        {"nutrient": "S", "minimum": 2.5, "maximum": 2.5, "unit": "g/kg"},
        {"nutrient": "Cl", "minimum": 5, "maximum": 6, "unit": "g/kg"},
        {"nutrient": "B", "minimum": 10, "maximum": 10, "unit": "mg/kg"},
        {"nutrient": "Cu", "minimum": 4, "maximum": 5, "unit": "mg/kg"},
        {"nutrient": "Fe", "minimum": 40, "maximum": 100, "unit": "mg/kg"},
        {"nutrient": "Mn", "minimum": 100, "maximum": 100, "unit": "mg/kg"},
        {"nutrient": "Zn", "minimum": 15, "maximum": 20, "unit": "mg/kg"},
    ],
    "note": "Não são limites universais de toxicidade nem faixas ideais para todas as variedades.",
}


def calculate_fertilizer(
    *,
    target_n_g_per_tree: float,
    target_p2o5_g_per_tree: float,
    target_k2o_g_per_tree: float,
    composition_n_pct: float,
    composition_p2o5_pct: float,
    composition_k2o_pct: float,
    tree_count: int,
    package_kg: float | None = None,
    price_per_package: float | None = None,
) -> dict[str, float | int | None | bool | str]:
    targets = {
        "n": target_n_g_per_tree,
        "p2o5": target_p2o5_g_per_tree,
        "k2o": target_k2o_g_per_tree,
    }
    composition = {
        "n": composition_n_pct,
        "p2o5": composition_p2o5_pct,
        "k2o": composition_k2o_pct,
    }

    if tree_count <= 0:
        raise ValueError("A quantidade de coqueiros deve ser maior que zero.")
    if not any(target > 0 for target in targets.values()):
        raise ValueError("Informe pelo menos um alvo de nutriente maior que zero.")
    for nutrient, target in targets.items():
        if target > 0 and composition[nutrient] <= 0:
            raise ValueError(f"O fertilizante não contém {nutrient.upper()}, necessário para o alvo informado.")

    product_grams_per_tree = max(
        target / (composition[nutrient] / 100)
        for nutrient, target in targets.items()
        if target > 0
    )
    supplied = {
        nutrient: product_grams_per_tree * composition[nutrient] / 100
        for nutrient in targets
    }
    excess = {nutrient: max(supplied[nutrient] - targets[nutrient], 0) for nutrient in targets}
    total_product_kg = product_grams_per_tree * tree_count / 1000
    package_count = ceil(total_product_kg / package_kg) if package_kg is not None else None
    estimated_cost = (
        package_count * price_per_package
        if package_count is not None and price_per_package is not None
        else None
    )

    return {
        "product_grams_per_tree": product_grams_per_tree,
        "total_product_kg": total_product_kg,
        "package_count": package_count,
        "estimated_purchase_cost": estimated_cost,
        "supplied_n_g_per_tree": supplied["n"],
        "supplied_p2o5_g_per_tree": supplied["p2o5"],
        "supplied_k2o_g_per_tree": supplied["k2o"],
        "excess_n_g_per_tree": excess["n"],
        "excess_p2o5_g_per_tree": excess["p2o5"],
        "excess_k2o_g_per_tree": excess["k2o"],
        "execution_authorized": False,
        "note": (
            "Cálculo matemático com alvos e composição informados pelo usuário. "
            "Não define dose agronômica nem autoriza aplicação; valide o plano, a análise "
            "e a compatibilidade dos nutrientes com profissional habilitado."
        ),
    }


def calculate_irrigation(
    *,
    eto_mm_day: float,
    kc: float,
    effective_rain_mm_day: float,
    efficiency_percent: float,
    area_ha: float,
    tree_count: int,
    emitters_per_tree: int | None = None,
    flow_liters_per_hour: float | None = None,
) -> dict[str, float | None | bool | str]:
    if eto_mm_day < 0 or effective_rain_mm_day < 0:
        raise ValueError("ETo e chuva efetiva não podem ser negativos.")
    if kc <= 0 or efficiency_percent <= 0 or efficiency_percent > 100:
        raise ValueError("Kc deve ser positivo e a eficiência deve estar entre 0 e 100%.")
    if area_ha <= 0 or tree_count <= 0:
        raise ValueError("Área e número de coqueiros devem ser maiores que zero.")
    if (emitters_per_tree is None) != (flow_liters_per_hour is None):
        raise ValueError("Informe juntos o número de emissores e a vazão de cada emissor.")
    if emitters_per_tree is not None and emitters_per_tree <= 0:
        raise ValueError("O número de emissores deve ser maior que zero.")
    if flow_liters_per_hour is not None and flow_liters_per_hour <= 0:
        raise ValueError("A vazão do emissor deve ser maior que zero.")

    etc = eto_mm_day * kc
    net_depth = max(etc - effective_rain_mm_day, 0)
    gross_depth = net_depth / (efficiency_percent / 100)
    total_m3 = gross_depth * area_ha * 10
    total_liters = total_m3 * 1000
    liters_per_tree = total_liters / tree_count
    runtime_hours = None
    if emitters_per_tree is not None and flow_liters_per_hour is not None:
        flow_per_tree = emitters_per_tree * flow_liters_per_hour
        runtime_hours = liters_per_tree / flow_per_tree

    return {
        "etc_mm_day": etc,
        "net_irrigation_depth_mm_day": net_depth,
        "gross_irrigation_depth_mm_day": gross_depth,
        "total_volume_m3_day": total_m3,
        "total_volume_liters_day": total_liters,
        "liters_per_tree_day": liters_per_tree,
        "runtime_hours_estimate": runtime_hours,
        "execution_authorized": False,
        "note": (
            "Estimativa de balanço hídrico a partir dos dados informados; chuva efetiva, "
            "Kc, armazenamento no solo, qualidade da água e eficiência precisam ser validados. "
            "Este cálculo não controla bombas ou válvulas."
        ),
    }
