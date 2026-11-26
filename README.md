# COCO SMART 360

**Inteligência em cada coqueiro. Tecnologia em cada colheita.**

MVP web para organizar a gestão da cocoicultura: propriedade, plantas, calendário, análises de solo, histórico de adubação, estimativas de fertilizante e irrigação, estoque e colheita. A interface e a API funcionam localmente e os dados ficam persistidos em SQLite; o Docker Compose fornece PostgreSQL/PostGIS.

> **Limite de uso:** esta é uma primeira entrega de MVP, não a plataforma completa descrita no prompt. As referências de adubação são históricas e não constituem recomendação. O sistema não diagnostica plantas, não substitui um profissional habilitado e não aciona equipamentos.

## O que está implementado

- Cadastro de propriedade e coqueiros com variedade, data de plantio, posição e coordenadas opcionais.
- Calendário de atividades com prioridade, vínculo opcional a uma planta e conclusão/reabertura.
- Cadastro manual de análise de solo com unidades, profundidade, laboratório e confirmação de transcrição.
- Registro histórico de aplicações; bloqueio de repetição do mesmo produto, escopo/local e data.
- Calculadora determinística de produto comercial a partir de metas fornecidas e composição N–P₂O₅–K₂O, com contribuições simultâneas, excedentes, embalagens e custo estimado.
- Estimativa assistida de irrigação por ETc = ETo × Kc, chuva efetiva, eficiência, área, plantas e vazão opcional.
- Estoque básico com composição, custo, lote e validade.
- Histórico de colheita, perdas e receita estimada com preço informado.
- Dashboard com dados registrados, sem estimar “saúde” quando faltam dados.
- Modo de demonstração opcional com registros claramente identificados como fictícios.
- FastAPI com Swagger, SQLAlchemy, migrações Alembic, testes de cálculo/API e Docker Compose.

## Requisitos

- Node.js 20.9+ e npm.
- Python 3.12+ recomendado.
- Docker Desktop com Compose (opcional, para executar PostgreSQL/PostGIS).

## Executar localmente no Windows (PowerShell)

### API com SQLite

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:DATABASE_URL = "sqlite:///./coco_smart.db"
alembic upgrade head
uvicorn app.main:app --reload
```

A API fica em `http://localhost:8000`; documentação Swagger em `http://localhost:8000/docs`.

### Interface web

Em outro terminal:

```powershell
cd frontend
npm install
$env:NEXT_PUBLIC_API_URL = "http://localhost:8000"
npm run dev
```

Acesse `http://localhost:3000`. A interface apresenta erro explícito se a API não estiver disponível.

### Acessar e instalar no celular pela rede local

No Windows, conecte o computador e o celular à mesma rede privada e, em um terminal na pasta `frontend`, execute:

```powershell
npm run dev:https
```

O comando cria uma autoridade certificadora local e um certificado HTTPS para o IPv4 privado do computador. O servidor HTTPS fica na porta `13001` e se vincula somente a esse endereço privado. OpenSSL precisa estar instalado. O certificado público para o celular fica em `frontend/public/local-https/coco-smart-360-root.cer`; a chave privada da autoridade fica em `%LOCALAPPDATA%\CocoSmart360\certificates` e nunca deve ser compartilhada.

Antes de abrir o app por HTTPS, transfira o arquivo `.cer` para o celular e instale-o como certificado de autoridade confiável. Se o servidor HTTP normal ainda estiver rodando, o arquivo também pode ser baixado pela rede local em `http://<IP-do-computador>:<porta-HTTP>/local-https/coco-smart-360-root.cer`. No Android, instale o certificado em **Configurações > Segurança > Instalar certificado > Certificado de CA** (os nomes variam por fabricante). No iPhone, instale o perfil baixado e depois habilite a confiança em **Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados**.

Para confiar também no certificado no Windows atual, execute `certutil -user -addstore Root .\public\local-https\coco-smart-360-root.cer` dentro da pasta `frontend`. O script mostra a impressão digital da CA; para removê-la depois do repositório de confiança do Windows, use `certutil -user -delstore Root <impressao-digital>`. Remova também o certificado instalado no celular se deixar de usar este HTTPS local.

Depois de confiar no certificado, abra `https://<IP-do-computador>:13001` no celular. No Android, use Chrome > menu > **Instalar app** ou **Adicionar à tela inicial**. No iPhone, use Safari > **Compartilhar** > **Adicionar à Tela de Início**. Se o IP privado mudar, pare o servidor HTTPS atual com `Ctrl+C`, execute `npm run dev:https` novamente e use o novo endereço mostrado no terminal.

Em HTTPS confiável, o service worker guarda a interface e as últimas respostas GET de `/api/v1` consultadas no aparelho. Para consultar esses dados offline, abra as telas online antes. Cadastros e alterações não são guardados nem sincronizados sem conexão e mostram erro explícito. O certificado local é apenas para desenvolvimento nesta rede privada; não publique a chave privada nem exponha a API diretamente.

## Executar com Docker Compose

```powershell
Copy-Item .env.example .env
# Edite .env e troque POSTGRES_PASSWORD por um segredo local próprio.
docker compose up --build
```

Abra `http://localhost:3000` e `http://localhost:8000/docs`. O Compose espera um banco saudável, aplica migrações e sobe API e interface. Não use a senha de exemplo em ambientes compartilhados.

## Testes e verificações

```powershell
cd backend
python -m pytest
```

```powershell
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Modo de demonstração

Ative apenas em ambiente de teste, alterando `COCO_DEMO_MODE=true` no ambiente da API e reiniciando o serviço. O botão de demonstração cria uma propriedade e registros fictícios, identificados no painel. O endpoint é bloqueado quando a opção está desativada.

## Escopo ainda não implementado

Aplicativo mobile nativo, gravações e sincronização offline, autenticação e papéis, isolamento multiusuário, mapas interativos, QR Code, importação de PDFs/OCR, análise foliar assistida, visão computacional, RAG/chatbot, serviço meteorológico, diagnóstico fitossanitário, validação AGROFIT, sensoriamento MQTT, automação de atuadores, relatórios avançados e gestão financeira de despesas/fluxo de caixa não estão implementados. Integrações futuras devem exigir credenciais, hardware e validações próprias; não são representadas por dados simulados neste MVP.

## Documentação

- [Arquitetura e modelo de dados](./docs/architecture.md)
- [Manual do produtor](./docs/manual-produtor.md)
- [Referências agronômicas e limites](./docs/referencias-agronomicas.md)
