import asyncio
import os

os.environ["DATABASE_URL"] = "sqlite://"

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app


def test_application_endpoint_rejects_duplicate_records() -> None:
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    test_session = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        async def run_requests() -> None:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                farm_response = await client.post(
                    "/api/v1/farms",
                    json={
                        "name": "Fazenda de teste",
                        "municipality": "Exemplo",
                        "state": "ba",
                        "total_area_ha": 5,
                        "cultivated_area_ha": 2,
                        "planted_tree_count": 10,
                    },
                )
                assert farm_response.status_code == 201
                farm_id = farm_response.json()["id"]

                payload = {
                    "farm_id": farm_id,
                    "scope": "farm",
                    "product_name": "Produto X",
                    "quantity_kg": 10,
                    "applied_on": "2026-01-15",
                }
                first = await client.post("/api/v1/fertilization-applications", json=payload)
                second = await client.post(
                    "/api/v1/fertilization-applications",
                    json={**payload, "product_name": "produto x"},
                )

                assert first.status_code == 201
                assert second.status_code == 409

        asyncio.run(run_requests())
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


def test_irrigation_endpoint_rejects_unpaired_emitter_inputs() -> None:
    async def run_request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                "/api/v1/calculations/irrigation",
                json={
                    "eto_mm_day": 4,
                    "kc": 0.8,
                    "effective_rain_mm_day": 0,
                    "efficiency_percent": 85,
                    "area_ha": 1,
                    "tree_count": 100,
                    "emitters_per_tree": 2,
                },
            )

    response = asyncio.run(run_request())
    assert response.status_code == 422
