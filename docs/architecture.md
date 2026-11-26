# Arquitetura do COCO SMART 360

## Escopo desta versão

Esta entrega implementa o MVP web em um monólito modular: Next.js/React/TypeScript na interface e FastAPI/SQLAlchemy no serviço, com SQLite para execução local e PostgreSQL/PostGIS no Compose. O backend mantém o cálculo separado de rotas e modelos; não há microsserviços.

```mermaid
flowchart LR
  Browser["Navegador<br/>Next.js + React"] -->|REST / JSON| API["FastAPI<br/>OpenAPI /docs"]
  API --> Domain["Regras determinísticas<br/>unidades e validações"]
  API --> ORM["SQLAlchemy"]
  ORM --> DB["SQLite local<br/>ou PostgreSQL no Compose"]
  API -. "Futuro, não conectado" .-> Weather["Serviço meteorológico"]
  API -. "Futuro, não conectado" .-> IoT["MQTT / sensores / atuadores"]
```

## Modelo de dados do MVP

```mermaid
erDiagram
  FARMS ||--o{ COCONUT_TREES : contains
  FARMS ||--o{ MAINTENANCE_TASKS : schedules
  COCONUT_TREES o|--o{ MAINTENANCE_TASKS : targets
  FARMS ||--o{ SOIL_ANALYSES : records
  FARMS ||--o{ FERTILIZATION_APPLICATIONS : records
  COCONUT_TREES o|--o{ FERTILIZATION_APPLICATIONS : targets
  FARMS ||--o{ IRRIGATION_EVENTS : records
  FARMS ||--o{ INVENTORY : stores
  FARMS ||--o{ HARVESTS : records
  COCONUT_TREES o|--o{ HARVESTS : produces

  FARMS {
    int id PK
    string name
    string municipality
    string state
    float total_area_ha
    float cultivated_area_ha
    int planted_tree_count
    bool is_demo
  }
  COCONUT_TREES {
    int id PK
    int farm_id FK
    string identifier
    date planted_at
    float latitude
    float longitude
  }
  MAINTENANCE_TASKS {
    int id PK
    int farm_id FK
    int tree_id FK
    string title
    date due_date
    string priority
    string status
  }
  SOIL_ANALYSES {
    int id PK
    int farm_id FK
    string plot_name
    date sample_date
    string depth_cm
    float ph
    bool reviewed
  }
  FERTILIZATION_APPLICATIONS {
    int id PK
    int farm_id FK
    int tree_id FK
    string product_name
    float quantity_kg
    date applied_on
  }
  IRRIGATION_EVENTS {
    int id PK
    int farm_id FK
    date recorded_on
    float volume_liters
    float runtime_minutes
  }
  INVENTORY {
    int id PK
    int farm_id FK
    string name
    float quantity
    string unit
    date expires_on
  }
  HARVESTS {
    int id PK
    int farm_id FK
    int tree_id FK
    date harvested_on
    int fruits_harvested
    int fruits_discarded
    float price_per_fruit
  }
```

## API principal

- `GET /health`: disponibilidade e sinalizador do modo demonstração.
- `/api/v1/farms`, `/trees`, `/tasks`, `/soil-analyses`, `/fertilization-applications`, `/irrigation-events`, `/inventory` e `/harvests`: cadastro e consulta.
- `GET /api/v1/workspace?farm_id=...`: visão agregada do painel.
- `POST /api/v1/calculations/fertilizer`: conversão de metas fornecidas em produto e balanço de nutrientes.
- `POST /api/v1/calculations/irrigation`: estimativa ETc, lâmina, volume e duração opcional.
- `GET /api/v1/agronomic-references`: referências históricas explicitamente versionadas.
- `POST /api/v1/demo/seed`: conjunto ilustrativo, somente quando `COCO_DEMO_MODE=true`.

A especificação interativa e os schemas ficam disponíveis em `/docs` (Swagger UI) e `/openapi.json`.

## Limites e segurança

- O MVP não implementa autenticação, RBAC, isolamento multiusuário, sincronização offline ou trilha de auditoria completa. É destinado a avaliação local/rede confiável, não a exposição pública.
- A configuração CORS é restrita por origem; não há credenciais CORS habilitadas.
- A API não tem rotas de acionamento de bomba, válvula ou equipamento. Cálculos sempre retornam `execution_authorized=false`.
- Nenhuma decisão agronômica é derivada automaticamente de fotografia, análise laboratorial ou clima. A leitura manual de laudos tem flag de conferência.
- A integração de clima não está configurada e valores meteorológicos reais não são simulados.
- Use segredo próprio no `.env`, TLS, autenticação, backups e revisão de segurança antes de qualquer implantação externa.

## Evolução prevista

1. Identidade e papéis; auditoria e isolamento por propriedade.
2. Migrações e regras agronômicas revisadas com fontes regionais atuais.
3. Importação de análises laboratoriais e conector meteorológico confiável.
4. Mobile/offline, mapas georreferenciados, QR Code e ingestão IoT segura.
5. RAG e visão computacional com avaliação de dados e validação profissional.

