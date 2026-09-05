# OS.Manager 🏭

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-Tested-2EAD33?logo=playwright&logoColor=white)

**OS.Manager** é uma plataforma industrial para gestão de ordens de serviço, manutenção preditiva e orquestração de plantas (Usinas e Centros de Distribuição).

## 🧪 Ambiente de Demonstração
Acesse o frontend hospedado na Vercel: **[https://manager-os-frontend.vercel.app](https://manager-os-frontend.vercel.app)**

🔐 **Credenciais de Acesso (Mock):**
- **Administrador:** `admin@demo.com` / `Demo@2026`
- **Operador:** `operador@demo.com` / `Demo@2026`
- **Visualizador:** `viewer@demo.com` / `Demo@2026`

## 🛠️ Stack Tecnológico

**Frontend**
- **Framework:** React 18 + Vite
- **Gestão de Estado & Fetching:** Context API / Hooks customizados focados em re-renderização otimizada
- **Integrações Nativas:** Uso de IndexedDB para operações modais offline-first e `@capacitor/camera` para captura fotográfica em campo
- **Interatividade:** Drag & Drop dinâmico (Kanban) e virtualização de listas DOM (Calendário de 52 Semanas)
- **Deploy:** Vercel

**Backend**
- **Framework:** Python + FastAPI (Alta performance e assíncrono)
- **Banco de Dados:** PostgreSQL Serverless (Hospedado na Neon.tech)
- **ORM & Pooling:** SQLAlchemy com gestão avançada de Connection Pooling
- **Segurança:** JWT, RBAC granular e bloqueio de rotas via dependências rígidas

**DevOps & Automação de Qualidade (QA)**
- **Testes E2E:** Playwright (Validação cega por acessibilidade simulando mecânicos e gestores)
- **Infraestrutura:** Render.com (API) e Vercel (Front)
- **Conteinerização:** Docker Ready

## 🏗 Arquitetura e Engenharia
> 🔒 **Nota de Privacidade:** O código-fonte do Backend (API em FastAPI) e a infraestrutura de banco de dados encontram-se em um repositório **privado** por diretrizes de segurança e proteção de propriedade intelectual. Toda a arquitetura e governança descritas neste documento referem-se ao motor que opera ativamente em produção na nuvem para alimentar esta interface.

- **Backend (Python/FastAPI):** Arquitetura baseada em microsserviços lógicos, preparada para alta concorrência. Utiliza SQLAlchemy com connection pooling (`pool_recycle`) otimizado para lidar com conexões persistentes no PostgreSQL serverless (Neon.tech).
- **Frontend (React):** Foco massivo em UX para uso em chãos de fábrica (tablets/desktops). Emprega Drag & Drop dinâmico, captura de mídia avançada e execução de modais stateful.

## 🛡️ Segurança e Governança (Zero Trust)
- **Matriz RBAC Granular:** Controle de acesso baseado em funções. Operadores não podem ver telas de faturamento; Visualizadores não possuem permissão de escrita (POST/PUT/DELETE bloqueados diretamente na injeção de dependência da API).
- **Proteção de Rotas:** O projeto passou por varredura AST (Abstract Syntax Tree) para garantir que 100% das rotas destrutivas contenham os bloqueios de segurança, mitigando riscos de SSRF e Path Traversal.
- **SaaS Switcher Seguro:** O isolamento Multi-Tenant garante que usinas diferentes operem no mesmo banco de dados relacional sem nenhum risco de cruzamento de informações.

## 🏆 Desafios Técnicos Vencidos
1. **Gerenciamento de Estado no Kanban:** Construir um board Kanban de alta performance em React exigiu otimizações rigorosas de re-renderização. A comunicação com a API ao arrastar um card é feita de forma assíncrona (Optimistic UI), mantendo a interface instantânea para o técnico de manutenção.
2. **Grid de 52 Semanas (Render Performance):** Renderizar um calendário anual completo com milhares de células DOM ativas sem travar a thread principal do navegador exigiu virtualização e memorização estruturada (`useMemo`/`useCallback`).
3. **Automação de Testes Robustos (E2E):** O ecossistema inteiro é validado por robôs do Playwright que navegam pelas rotas simulando fluxos vitais (criação de OS, manipulação de Kanban), impedindo falhas em novas implementações.

## 🎯 Módulos Principais
- **Painel Kanban:** Gestão de OS em tempo real com filtros por usina e técnico.
- **Calendário Preditivo:** Visão de 52 semanas e operações em lote.
- **Planos de Manutenção:** Geração em cascata para padronização de serviços.

## ⚙️ Como Executar Localmente

**Pré-requisitos:**
- Node.js v18+
- Python 3.11+
- Instância PostgreSQL (Local ou Cloud)

**1. Inicializando a API (Backend):**
```bash
cd backend
python -m venv venv
# Ative o ambiente virtual (Windows: venv\Scriptsctivate | Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
# Crie um arquivo .env baseado nas variáveis necessárias (DATABASE_URL, SECRET_KEY, etc)
uvicorn main:app --reload
```

**2. Inicializando a Aplicação (Frontend):**
```bash
cd frontend
npm install
# Configure o .env local apontando para o backend (ex: VITE_API_URL=http://localhost:8000)
npm run dev
```

---
*Projeto proprietário - Portfólio de Engenharia de Software.*
