import hashlib
import os
from datetime import date, timedelta
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .calculations import (
    HISTORICAL_FERTILIZATION_REFERENCE,
    HISTORICAL_LEAF_CRITICAL_LEVELS,
    calculate_fertilizer,
    calculate_irrigation,
)
from .db import get_db
from .models import (
    Farm,
    FertilizationApplication,
    Harvest,
    InventoryItem,
    IrrigationEvent,
    SoilAnalysis,
    Task,
    Tree,
)
from .schemas import (
    FarmCreate,
    FarmOut,
    FertilizationApplicationCreate,
    FertilizationApplicationOut,
    FertilizerCalculationRequest,
    HarvestCreate,
    HarvestOut,
    InventoryItemCreate,
    InventoryItemOut,
    IrrigationCalculationRequest,
    IrrigationCalculationOut,
    IrrigationEventCreate,
    IrrigationEventOut,
    SoilAnalysisCreate,
    SoilAnalysisOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    TreeCreate,
    TreeOut,
    WorkspaceOut,
)


def _enabled(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


DEMO_MODE = _enabled(os.getenv("COCO_DEMO_MODE"))
cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app = FastAPI(
    title="COCO SMART 360 API",
    description=(
        "API do MVP de gestão da cocoicultura. Os cálculos são estimativas informativas; "
        "não substituem validação agronômica nem controlam equipamentos."
    ),
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)


def require_farm(db: Session, farm_id: int) -> Farm:
    farm = db.get(Farm, farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Propriedade não encontrada.")
    return farm


def require_tree_in_farm(db: Session, tree_id: int, farm_id: int) -> Tree:
    tree = db.get(Tree, tree_id)
    if tree is None or tree.farm_id != farm_id:
        raise HTTPException(status_code=404, detail="Coqueiro não encontrado nesta propriedade.")
    return tree


def fertilization_dedupe_key(payload: FertilizationApplicationCreate) -> str:
    if payload.scope == "tree":
        location = f"tree:{payload.tree_id}"
    elif payload.scope == "plot":
        location = f"plot:{payload.plot_name.strip().casefold()}"
    else:
        location = "farm"
    identity = "\x1f".join(
        [
            str(payload.farm_id),
            payload.scope,
            location,
            payload.product_name.strip().casefold(),
            payload.applied_on.isoformat(),
        ]
    )
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def workspace_payload(db: Session, farm: Farm) -> dict[str, Any]:
    trees = list(db.scalars(select(Tree).where(Tree.farm_id == farm.id).order_by(Tree.identifier)))
    tasks = list(
        db.scalars(
            select(Task).where(Task.farm_id == farm.id).order_by(Task.due_date, Task.id)
        )
    )
    soil_analyses = list(
        db.scalars(
            select(SoilAnalysis)
            .where(SoilAnalysis.farm_id == farm.id)
            .order_by(SoilAnalysis.sample_date.desc(), SoilAnalysis.id.desc())
        )
    )
    applications = list(
        db.scalars(
            select(FertilizationApplication)
            .where(FertilizationApplication.farm_id == farm.id)
            .order_by(FertilizationApplication.applied_on.desc(), FertilizationApplication.id.desc())
        )
    )
    irrigation_events = list(
        db.scalars(
            select(IrrigationEvent)
            .where(IrrigationEvent.farm_id == farm.id)
            .order_by(IrrigationEvent.recorded_on.desc(), IrrigationEvent.id.desc())
        )
    )
    inventory = list(
        db.scalars(
            select(InventoryItem).where(InventoryItem.farm_id == farm.id).order_by(InventoryItem.name)
        )
    )
    harvests = list(
        db.scalars(
            select(Harvest)
            .where(Harvest.farm_id == farm.id)
            .order_by(Harvest.harvested_on.desc(), Harvest.id.desc())
        )
    )

    today = date.today()
    month_start = today.replace(day=1)
    month_harvests = [item for item in harvests if month_start <= item.harvested_on <= today]
    recent_irrigation = [item for item in irrigation_events if item.recorded_on >= today - timedelta(days=29)]
    dashboard = {
        "tree_count": len(trees),
        "pending_tasks": sum(item.status != "done" for item in tasks),
        "overdue_tasks": sum(item.status != "done" and item.due_date < today for item in tasks),
        "critical_tasks": sum(item.status != "done" and item.priority == "critical" for item in tasks),
        "soil_sample_count": len(soil_analyses),
        "inventory_item_count": len(inventory),
        "harvested_fruits_this_month": sum(item.fruits_harvested for item in month_harvests),
        "irrigation_liters_30d": sum(item.volume_liters for item in recent_irrigation),
        "estimated_harvest_revenue_this_month": (
            sum(item.fruits_harvested * item.price_per_fruit for item in month_harvests if item.price_per_fruit is not None)
            if any(item.price_per_fruit is not None for item in month_harvests)
            else None
        ),
        "health_status": "not_assessed",
    }
    return {
        "farm": farm,
        "dashboard": dashboard,
        "trees": trees,
        "tasks": tasks,
        "soil_analyses": soil_analyses,
        "fertilization_applications": applications,
        "irrigation_events": irrigation_events,
        "inventory": inventory,
        "harvests": harvests,
    }


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "COCO SMART 360 API", "docs": "/docs", "status": "ok"}


@app.get("/health")
def health() -> dict[str, bool | str]:
    return {"status": "ok", "demo_mode": DEMO_MODE}


@app.get("/api/v1/farms", response_model=list[FarmOut])
def list_farms(db: Session = Depends(get_db)) -> list[Farm]:
    return list(db.scalars(select(Farm).order_by(Farm.name)))


@app.post("/api/v1/farms", response_model=FarmOut, status_code=status.HTTP_201_CREATED)
def create_farm(payload: FarmCreate, db: Session = Depends(get_db)) -> Farm:
    farm = Farm(**payload.model_dump())
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm


@app.get("/api/v1/workspace", response_model=WorkspaceOut)
def get_workspace(farm_id: int = Query(gt=0), db: Session = Depends(get_db)) -> dict[str, Any]:
    farm = require_farm(db, farm_id)
    return workspace_payload(db, farm)


@app.get("/api/v1/trees", response_model=list[TreeOut])
def list_trees(farm_id: int = Query(gt=0), db: Session = Depends(get_db)) -> list[Tree]:
    require_farm(db, farm_id)
    return list(
        db.scalars(select(Tree).where(Tree.farm_id == farm_id).order_by(Tree.identifier))
    )


@app.post("/api/v1/trees", response_model=TreeOut, status_code=status.HTTP_201_CREATED)
def create_tree(payload: TreeCreate, db: Session = Depends(get_db)) -> Tree:
    require_farm(db, payload.farm_id)
    tree = Tree(**payload.model_dump())
    db.add(tree)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Já existe um coqueiro com este identificador.") from exc
    db.refresh(tree)
    return tree


@app.get("/api/v1/tasks", response_model=list[TaskOut])
def list_tasks(farm_id: int = Query(gt=0), db: Session = Depends(get_db)) -> list[Task]:
    require_farm(db, farm_id)
    return list(
        db.scalars(select(Task).where(Task.farm_id == farm_id).order_by(Task.due_date, Task.id))
    )


@app.post("/api/v1/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> Task:
    require_farm(db, payload.farm_id)
    if payload.tree_id is not None:
        require_tree_in_farm(db, payload.tree_id, payload.farm_id)
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/api/v1/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    task.status = payload.status
    db.commit()
    db.refresh(task)
    return task


@app.get("/api/v1/soil-analyses", response_model=list[SoilAnalysisOut])
def list_soil_analyses(farm_id: int = Query(gt=0), db: Session = Depends(get_db)) -> list[SoilAnalysis]:
    require_farm(db, farm_id)
    return list(
        db.scalars(
            select(SoilAnalysis)
            .where(SoilAnalysis.farm_id == farm_id)
            .order_by(SoilAnalysis.sample_date.desc(), SoilAnalysis.id.desc())
        )
    )


@app.post("/api/v1/soil-analyses", response_model=SoilAnalysisOut, status_code=status.HTTP_201_CREATED)
def create_soil_analysis(payload: SoilAnalysisCreate, db: Session = Depends(get_db)) -> SoilAnalysis:
    require_farm(db, payload.farm_id)
    analysis = SoilAnalysis(**payload.model_dump())
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


@app.get(
    "/api/v1/fertilization-applications",
    response_model=list[FertilizationApplicationOut],
)
def list_fertilization_applications(
    farm_id: int = Query(gt=0), db: Session = Depends(get_db)
) -> list[FertilizationApplication]:
    require_farm(db, farm_id)
    return list(
        db.scalars(
            select(FertilizationApplication)
            .where(FertilizationApplication.farm_id == farm_id)
            .order_by(FertilizationApplication.applied_on.desc(), FertilizationApplication.id.desc())
        )
    )


@app.post(
    "/api/v1/fertilization-applications",
    response_model=FertilizationApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_fertilization_application(
    payload: FertilizationApplicationCreate, db: Session = Depends(get_db)
) -> FertilizationApplication:
    require_farm(db, payload.farm_id)
    if payload.tree_id is not None:
        require_tree_in_farm(db, payload.tree_id, payload.farm_id)

    duplicate_query = select(FertilizationApplication).where(
        FertilizationApplication.farm_id == payload.farm_id,
        func.lower(FertilizationApplication.product_name) == payload.product_name.strip().lower(),
        FertilizationApplication.applied_on == payload.applied_on,
        FertilizationApplication.scope == payload.scope,
    )
    if payload.tree_id is None:
        duplicate_query = duplicate_query.where(FertilizationApplication.tree_id.is_(None))
    else:
        duplicate_query = duplicate_query.where(FertilizationApplication.tree_id == payload.tree_id)
    if payload.scope == "plot":
        duplicate_query = duplicate_query.where(
            func.lower(FertilizationApplication.plot_name) == payload.plot_name.strip().lower()
        )
    if db.scalar(duplicate_query) is not None:
        raise HTTPException(
            status_code=409,
            detail="Já existe registro deste produto, local e data. Confira o histórico antes de continuar.",
        )

    application = FertilizationApplication(**payload.model_dump())
    application.product_name = payload.product_name.strip()
    application.plot_name = payload.plot_name.strip() if payload.plot_name else None
    application.dedupe_key = fertilization_dedupe_key(payload)
    db.add(application)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Já existe registro deste produto, local e data. Confira o histórico antes de continuar.",
        ) from exc
    db.refresh(application)
    return application


@app.post("/api/v1/calculations/fertilizer")
def fertilizer_calculation(payload: FertilizerCalculationRequest) -> dict[str, Any]:
    try:
        return calculate_fertilizer(**payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/irrigation-events", response_model=list[IrrigationEventOut])
def list_irrigation_events(
    farm_id: int = Query(gt=0), db: Session = Depends(get_db)
) -> list[IrrigationEvent]:
    require_farm(db, farm_id)
    return list(
        db.scalars(
            select(IrrigationEvent)
            .where(IrrigationEvent.farm_id == farm_id)
            .order_by(IrrigationEvent.recorded_on.desc(), IrrigationEvent.id.desc())
        )
    )


@app.post("/api/v1/calculations/irrigation", response_model=IrrigationCalculationOut)
def irrigation_calculation(payload: IrrigationCalculationRequest) -> dict[str, Any]:
    try:
        return calculate_irrigation(**payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post(
    "/api/v1/irrigation-events",
    response_model=IrrigationEventOut,
    status_code=status.HTTP_201_CREATED,
)
def create_irrigation_event(payload: IrrigationEventCreate, db: Session = Depends(get_db)) -> IrrigationEvent:
    require_farm(db, payload.farm_id)
    event = IrrigationEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@app.get("/api/v1/inventory", response_model=list[InventoryItemOut])
def list_inventory(farm_id: int = Query(gt=0), db: Session = Depends(get_db)) -> list[InventoryItem]:
    require_farm(db, farm_id)
    return list(
        db.scalars(select(InventoryItem).where(InventoryItem.farm_id == farm_id).order_by(InventoryItem.name))
    )


@app.post("/api/v1/inventory", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
def create_inventory_item(payload: InventoryItemCreate, db: Session = Depends(get_db)) -> InventoryItem:
    require_farm(db, payload.farm_id)
    item = InventoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/api/v1/harvests", response_model=list[HarvestOut])
def list_harvests(farm_id: int = Query(gt=0), db: Session = Depends(get_db)) -> list[Harvest]:
    require_farm(db, farm_id)
    return list(
        db.scalars(
            select(Harvest)
            .where(Harvest.farm_id == farm_id)
            .order_by(Harvest.harvested_on.desc(), Harvest.id.desc())
        )
    )


@app.post("/api/v1/harvests", response_model=HarvestOut, status_code=status.HTTP_201_CREATED)
def create_harvest(payload: HarvestCreate, db: Session = Depends(get_db)) -> Harvest:
    require_farm(db, payload.farm_id)
    if payload.tree_id is not None:
        require_tree_in_farm(db, payload.tree_id, payload.farm_id)
    harvest = Harvest(**payload.model_dump())
    db.add(harvest)
    db.commit()
    db.refresh(harvest)
    return harvest


@app.get("/api/v1/agronomic-references")
def agronomic_references() -> dict[str, Any]:
    return {
        "fertilization": HISTORICAL_FERTILIZATION_REFERENCE,
        "leaf_critical_levels": HISTORICAL_LEAF_CRITICAL_LEVELS,
    }


@app.post("/api/v1/demo/seed", status_code=status.HTTP_201_CREATED)
def seed_demo_data(db: Session = Depends(get_db)) -> dict[str, int | bool | str]:
    if not DEMO_MODE:
        raise HTTPException(
            status_code=403,
            detail="A demonstração está desativada. Habilite COCO_DEMO_MODE apenas em ambiente de teste.",
        )
    existing = db.scalar(select(Farm).where(Farm.is_demo.is_(True)))
    if existing is not None:
        return {"farm_id": existing.id, "is_demo": True, "created": False}

    today = date.today()
    farm = Farm(
        name="Fazenda Demonstrativa — dados fictícios",
        municipality="Município fictício",
        state="BA",
        total_area_ha=3.0,
        cultivated_area_ha=1.5,
        planted_tree_count=12,
        variety="Anão verde (exemplo)",
        is_demo=True,
    )
    db.add(farm)
    db.flush()
    trees = [
        Tree(
            farm_id=farm.id,
            identifier=f"DEMO-{index:03d}",
            planted_at=today - timedelta(days=365 * 4),
            variety=farm.variety,
            row_number=(index - 1) // 4 + 1,
            position_number=(index - 1) % 4 + 1,
        )
        for index in range(1, 13)
    ]
    db.add_all(trees)
    db.add_all(
        [
            Task(
                farm_id=farm.id,
                title="Exemplo: revisar registros do talhão",
                description="Atividade demonstrativa; confirme os dados e adapte à propriedade.",
                due_date=today + timedelta(days=1),
                priority="normal",
                status="pending",
            ),
            Task(
                farm_id=farm.id,
                title="Exemplo: registrar vistoria",
                description="Não representa diagnóstico ou recomendação agronômica.",
                due_date=today,
                priority="high",
                status="pending",
            ),
        ]
    )
    db.add(
        SoilAnalysis(
            farm_id=farm.id,
            plot_name="Talhão demonstrativo",
            sample_date=today - timedelta(days=30),
            depth_cm="0-20 cm",
            ph=5.5,
            organic_matter_pct=1.8,
            phosphorus_mg_dm3=8,
            potassium_mg_dm3=45,
            laboratory="Laboratório fictício — demonstração",
            lab_method="Valor ilustrativo",
            reviewed=False,
        )
    )
    db.add_all(
        [
            InventoryItem(
                farm_id=farm.id,
                name="Produto demonstrativo — não aplicar",
                category="fertilizante",
                quantity=50,
                unit="kg",
                unit_cost=0,
                n_pct=0,
                p2o5_pct=0,
                k2o_pct=0,
            ),
            Harvest(
                farm_id=farm.id,
                harvested_on=today - timedelta(days=5),
                fruits_harvested=120,
                fruits_discarded=3,
                weight_kg=180,
                price_per_fruit=0,
                destination="Lote fictício",
            ),
            IrrigationEvent(
                farm_id=farm.id,
                plot_name="Talhão demonstrativo",
                recorded_on=today - timedelta(days=1),
                volume_liters=18000,
                notes="Registro ilustrativo; substituir por medição real.",
            ),
        ]
    )
    db.commit()
    return {"farm_id": farm.id, "is_demo": True, "created": True}
