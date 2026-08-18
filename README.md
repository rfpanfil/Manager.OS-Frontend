# Manager.OS

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-red.svg)

**Manager.OS** é uma solução profissional focada em ordens de serviço, manutenção preditiva e plantas industriais.

## 🧪 Ambiente de Demonstração

Para facilitar a avaliação, o sistema conta com dados fictícios e um banco de dados de demonstração.

Acesse o frontend hospedado na Vercel: **[https://manager-os-frontend.vercel.app](https://manager-os-frontend.vercel.app)**

🔐 **Credenciais de Acesso (Mock):**
- **Administrador:** `admin@demo.com` / `Demo@2026`
- **Operador:** `operador@demo.com` / `Demo@2026`
- **Visualizador:** `viewer@demo.com` / `Demo@2026`

> **Nota:** Para evitar conflitos, os dados do banco de demonstração são **resetados automaticamente a cada 6 horas**. Sinta-se à vontade para explorar.

## 🏗️ Arquitetura

O Manager.OS utiliza uma separação estrita de camadas (Layered Architecture):

- **Frontend:** React estruturado em componentes com Hooks e Context API robustos.
- **Backend:** FastAPI modular. As rotas HTTP servem apenas como "portas" de entrada, delegando toda a lógica de negócio à camada de Serviços (Domain).
- **Banco de Dados:** PostgreSQL hospedado.

## 🔒 Segurança em Primeiro Lugar (Zero Trust)

A segurança foi implementada seguindo as melhores práticas do mercado:
- **Gestão de Segredos:** Ausência total de chaves e variáveis confidenciais versionadas.
- **Bcrypt:** Senhas fortemente armazenadas com salts aleatórios.
- **Proteção IDOR:** Validação centralizada e RLS (Row-Level Security) equivalente via código, garantindo que o usuário só atue sobre dados próprios.
- **Security Middleware:** Prevenção de ataques via Rate Limiting, CORS rigoroso e Security Headers contra *MIME Sniffing* e *Clickjacking*.

## 🚀 Como Rodar Localmente (Frontend)

1. **Clone o repositório:**
   `ash
   git clone https://github.com/rfpanfil/Manager.OS-Frontend.git
   cd Manager.OS-Frontend
   `

2. **Instale as dependências:**
   `ash
   npm install
   `

3. **Inicie o servidor de desenvolvimento:**
   `ash
   npm run dev
   `
   O frontend estará disponível em http://localhost:3000.

*(Nota: O backend de produção deste projeto possui código privado para proteger a lógica de negócios. O frontend consome a API de demonstração na nuvem).*

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.
