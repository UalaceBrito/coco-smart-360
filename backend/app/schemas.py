from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FarmCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    municipality: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    total_area_ha: float = Field(ge=0)
    cultivated_area_ha: float = Field(ge=0)
    planted_tree_count: int = Field(ge=0)
    variety: str | None = Field(default=None, max_length=100)

    @field_validator("state")
    @classmethod
    def uppercase_state(cls, value: str) -> str:
        return value.upper()

    @model_validator(mode="after")
    def cultivated_area_within_total(self) -> "FarmCreate":
        if self.cultivated_area_ha > self.total_area_ha:
            raise ValueError("A área cultivada não pode exceder a área total.")
        return self


class FarmOut(ORMModel):
    id: int
    name: str
    municipality: str
    state: str
    total_area_ha: float
    cultivated_area_ha: float
    planted_tree_count: int
    variety: str | None
    is_demo: bool
    created_at: datetime


class TreeCreate(BaseModel):
    farm_id: int = Field(gt=0)
    identifier: str = Field(min_length=1, max_length=64)
    planted_at: date | None = None
    variety: str | None = Field(default=None, max_length=100)
    row_number: int | None = Field(default=None, ge=1)
    position_number: int | None = Field(default=None, ge=1)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class TreeOut(ORMModel):
    id: int
    farm_id: int
    identifier: str
    planted_at: date | None
    variety: str | None
    row_number: int | None
    position_number: int | None
    latitude: float | None
    longitude: float | None
    created_at: datetime


class TaskCreate(BaseModel):
    farm_id: int = Field(gt=0)
    tree_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1000)
    due_date: date
    priority: Literal["low", "normal", "high", "critical"] = "normal"


class TaskUpdate(BaseModel):
    status: Literal["pending", "in_progress", "done", "rescheduled"]


class TaskOut(ORMModel):
    id: int
    farm_id: int
    tree_id: int | None
    title: str
    description: str
    due_date: date
    priority: str
    status: str
    created_at: datetime


class SoilAnalysisCreate(BaseModel):
    farm_id: int = Field(gt=0)
    plot_name: str = Field(min_length=1, max_length=100)
    sample_date: date
    depth_cm: str = Field(min_length=1, max_length=32)
    ph: float | None = Field(default=None, ge=0, le=14)
    organic_matter_pct: float | None = Field(default=None, ge=0, le=100)
    phosphorus_mg_dm3: float | None = Field(default=None, ge=0)
    potassium_mg_dm3: float | None = Field(default=None, ge=0)
    calcium_cmolc_dm3: float | None = Field(default=None, ge=0)
    magnesium_cmolc_dm3: float | None = Field(default=None, ge=0)
    aluminum_cmolc_dm3: float | None = Field(default=None, ge=0)
    ctc_cmolc_dm3: float | None = Field(default=None, ge=0)
    base_saturation_pct: float | None = Field(default=None, ge=0, le=100)
    lab_method: str | None = Field(default=None, max_length=120)
    laboratory: str | None = Field(default=None, max_length=120)
    reviewed: bool = False


class SoilAnalysisOut(ORMModel):
    id: int
    farm_id: int
    plot_name: str
    sample_date: date
    depth_cm: str
    ph: float | None
    organic_matter_pct: float | None
    phosphorus_mg_dm3: float | None
    potassium_mg_dm3: float | None
    calcium_cmolc_dm3: float | None
    magnesium_cmolc_dm3: float | None
    aluminum_cmolc_dm3: float | None
    ctc_cmolc_dm3: float | None
    base_saturation_pct: float | None
    lab_method: str | None
    laboratory: str | None
    reviewed: bool
    created_at: datetime


class FertilizationApplicationCreate(BaseModel):
    farm_id: int = Field(gt=0)
    tree_id: int | None = Field(default=None, gt=0)
    scope: Literal["tree", "plot", "farm"] = "farm"
    plot_name: str | None = Field(default=None, max_length=100)
    product_name: str = Field(min_length=1, max_length=120)
    quantity_kg: float = Field(gt=0)
    applied_on: date
    plan_reference: str | None = Field(default=None, max_length=240)

    @model_validator(mode="after")
    def scope_has_location(self) -> "FertilizationApplicationCreate":
        if self.scope == "tree" and self.tree_id is None:
            raise ValueError("Informe o coqueiro para registrar uma aplicação individual.")
        if self.scope == "plot" and not self.plot_name:
            raise ValueError("Informe o talhão para registrar uma aplicação por talhão.")
        if self.scope != "tree" and self.tree_id is not None:
            raise ValueError("O coqueiro só pode ser informado no escopo individual.")
        return self


class FertilizationApplicationOut(ORMModel):
    id: int
    farm_id: int
    tree_id: int | None
    scope: str
    plot_name: str | None
    product_name: str
    quantity_kg: float
    applied_on: date
    plan_reference: str | None
    created_at: datetime


class IrrigationCalculationRequest(BaseModel):
    eto_mm_day: float = Field(ge=0)
    kc: float = Field(gt=0)
    effective_rain_mm_day: float = Field(ge=0)
    efficiency_percent: float = Field(gt=0, le=100)
    area_ha: float = Field(gt=0)
    tree_count: int = Field(gt=0)
    emitters_per_tree: int | None = Field(default=None, gt=0)
    flow_liters_per_hour: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def paired_emitter_inputs(self) -> "IrrigationCalculationRequest":
        if (self.emitters_per_tree is None) != (self.flow_liters_per_hour is None):
            raise ValueError("Informe juntos o número de emissores e a vazão de cada emissor.")
        return self


class IrrigationCalculationOut(BaseModel):
    etc_mm_day: float
    net_irrigation_depth_mm_day: float
    gross_irrigation_depth_mm_day: float
    total_volume_m3_day: float
    total_volume_liters_day: float
    liters_per_tree_day: float
    runtime_hours_estimate: float | None
    execution_authorized: Literal[False] = False
    note: str


class IrrigationEventCreate(BaseModel):
    farm_id: int = Field(gt=0)
    plot_name: str | None = Field(default=None, max_length=100)
    recorded_on: date
    volume_liters: float = Field(gt=0)
    runtime_minutes: float | None = Field(default=None, gt=0)
    area_ha: float | None = Field(default=None, gt=0)
    notes: str | None = Field(default=None, max_length=500)


class IrrigationEventOut(ORMModel):
    id: int
    farm_id: int
    plot_name: str | None
    recorded_on: date
    volume_liters: float
    runtime_minutes: float | None
    area_ha: float | None
    notes: str | None
    created_at: datetime


class InventoryItemCreate(BaseModel):
    farm_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    quantity: float = Field(ge=0)
    unit: str = Field(min_length=1, max_length=20)
    unit_cost: float | None = Field(default=None, ge=0)
    lot: str | None = Field(default=None, max_length=80)
    expires_on: date | None = None
    n_pct: float | None = Field(default=None, ge=0, le=100)
    p2o5_pct: float | None = Field(default=None, ge=0, le=100)
    k2o_pct: float | None = Field(default=None, ge=0, le=100)


class InventoryItemOut(ORMModel):
    id: int
    farm_id: int
    name: str
    category: str
    quantity: float
    unit: str
    unit_cost: float | None
    lot: str | None
    expires_on: date | None
    n_pct: float | None
    p2o5_pct: float | None
    k2o_pct: float | None
    created_at: datetime


class HarvestCreate(BaseModel):
    farm_id: int = Field(gt=0)
    tree_id: int | None = Field(default=None, gt=0)
    harvested_on: date
    fruits_harvested: int = Field(ge=0)
    fruits_discarded: int = Field(default=0, ge=0)
    weight_kg: float | None = Field(default=None, ge=0)
    price_per_fruit: float | None = Field(default=None, ge=0)
    destination: str | None = Field(default=None, max_length=100)


class HarvestOut(ORMModel):
    id: int
    farm_id: int
    tree_id: int | None
    harvested_on: date
    fruits_harvested: int
    fruits_discarded: int
    weight_kg: float | None
    price_per_fruit: float | None
    destination: str | None
    created_at: datetime


class FertilizerCalculationRequest(BaseModel):
    target_n_g_per_tree: float = Field(ge=0)
    target_p2o5_g_per_tree: float = Field(ge=0)
    target_k2o_g_per_tree: float = Field(ge=0)
    composition_n_pct: float = Field(ge=0, le=100)
    composition_p2o5_pct: float = Field(ge=0, le=100)
    composition_k2o_pct: float = Field(ge=0, le=100)
    tree_count: int = Field(gt=0)
    package_kg: float | None = Field(default=None, gt=0)
    price_per_package: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def paired_package_inputs(self) -> "FertilizerCalculationRequest":
        if self.price_per_package is not None and self.package_kg is None:
            raise ValueError("Informe o tamanho da embalagem para estimar o custo.")
        return self


class FertilizerCalculationOut(BaseModel):
    product_grams_per_tree: float
    total_product_kg: float
    package_count: int | None
    estimated_purchase_cost: float | None
    supplied_n_g_per_tree: float
    supplied_p2o5_g_per_tree: float
    supplied_k2o_g_per_tree: float
    excess_n_g_per_tree: float
    excess_p2o5_g_per_tree: float
    excess_k2o_g_per_tree: float
    execution_authorized: Literal[False] = False
    note: str


class DashboardSummary(BaseModel):
    tree_count: int
    pending_tasks: int
    overdue_tasks: int
    critical_tasks: int
    soil_sample_count: int
    inventory_item_count: int
    harvested_fruits_this_month: int
    irrigation_liters_30d: float
    estimated_harvest_revenue_this_month: float | None
    health_status: Literal["not_assessed"] = "not_assessed"


class WorkspaceOut(BaseModel):
    farm: FarmOut
    dashboard: DashboardSummary
    trees: list[TreeOut]
    tasks: list[TaskOut]
    soil_analyses: list[SoilAnalysisOut]
    fertilization_applications: list[FertilizationApplicationOut]
    irrigation_events: list[IrrigationEventOut]
    inventory: list[InventoryItemOut]
    harvests: list[HarvestOut]
