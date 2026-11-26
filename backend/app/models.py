from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    municipality: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)
    total_area_ha: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    cultivated_area_ha: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    planted_tree_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    variety: Mapped[str | None] = mapped_column(String(100))
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class Tree(Base):
    __tablename__ = "coconut_trees"
    __table_args__ = (UniqueConstraint("farm_id", "identifier", name="uq_tree_farm_identifier"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    identifier: Mapped[str] = mapped_column(String(64), nullable=False)
    planted_at: Mapped[date | None] = mapped_column(Date)
    variety: Mapped[str | None] = mapped_column(String(100))
    row_number: Mapped[int | None] = mapped_column(Integer)
    position_number: Mapped[int | None] = mapped_column(Integer)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class Task(Base):
    __tablename__ = "maintenance_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    tree_id: Mapped[int | None] = mapped_column(ForeignKey("coconut_trees.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class SoilAnalysis(Base):
    __tablename__ = "soil_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    plot_name: Mapped[str] = mapped_column(String(100), nullable=False)
    sample_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    depth_cm: Mapped[str] = mapped_column(String(32), nullable=False)
    ph: Mapped[float | None] = mapped_column(Float)
    organic_matter_pct: Mapped[float | None] = mapped_column(Float)
    phosphorus_mg_dm3: Mapped[float | None] = mapped_column(Float)
    potassium_mg_dm3: Mapped[float | None] = mapped_column(Float)
    calcium_cmolc_dm3: Mapped[float | None] = mapped_column(Float)
    magnesium_cmolc_dm3: Mapped[float | None] = mapped_column(Float)
    aluminum_cmolc_dm3: Mapped[float | None] = mapped_column(Float)
    ctc_cmolc_dm3: Mapped[float | None] = mapped_column(Float)
    base_saturation_pct: Mapped[float | None] = mapped_column(Float)
    lab_method: Mapped[str | None] = mapped_column(String(120))
    laboratory: Mapped[str | None] = mapped_column(String(120))
    reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class FertilizationApplication(Base):
    __tablename__ = "fertilization_applications"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_fertilization_applications_dedupe_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    tree_id: Mapped[int | None] = mapped_column(ForeignKey("coconut_trees.id", ondelete="SET NULL"), index=True)
    scope: Mapped[str] = mapped_column(String(16), nullable=False)
    plot_name: Mapped[str | None] = mapped_column(String(100))
    product_name: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    applied_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    dedupe_key: Mapped[str] = mapped_column(String(64), nullable=False)
    plan_reference: Mapped[str | None] = mapped_column(String(240))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class IrrigationEvent(Base):
    __tablename__ = "irrigation_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    plot_name: Mapped[str | None] = mapped_column(String(100))
    recorded_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    volume_liters: Mapped[float] = mapped_column(Float, nullable=False)
    runtime_minutes: Mapped[float | None] = mapped_column(Float)
    area_ha: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class InventoryItem(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Float)
    lot: Mapped[str | None] = mapped_column(String(80))
    expires_on: Mapped[date | None] = mapped_column(Date)
    n_pct: Mapped[float | None] = mapped_column(Float)
    p2o5_pct: Mapped[float | None] = mapped_column(Float)
    k2o_pct: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)


class Harvest(Base):
    __tablename__ = "harvests"

    id: Mapped[int] = mapped_column(primary_key=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    tree_id: Mapped[int | None] = mapped_column(ForeignKey("coconut_trees.id", ondelete="SET NULL"), index=True)
    harvested_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    fruits_harvested: Mapped[int] = mapped_column(Integer, nullable=False)
    fruits_discarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    price_per_fruit: Mapped[float | None] = mapped_column(Float)
    destination: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
