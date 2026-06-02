# AI Client

A full-featured Next.js 16 AI chat application featuring branching message trees, real-time streaming responses, multi-format artifact rendering (Markdown, HTML, XLSX, Mermaid diagrams), file handling, and integrated Model Context Protocol (MCP) servers. Built with TypeScript, PostgreSQL, Better Auth, and the Vercel AI SDK—deploy with confidence.

# Features

## Chat Interface & UX
- **Branching conversations** — Edit any message to create sibling branches non-destructively; navigate trees intuitively.
- **Real-time streaming** — Server-Sent Events (SSE) support for text, reasoning tokens (`<Thinking>`), and real-time tool orchestration.
- **Global Search** — Unified interface for searching chats, projects, and assistants with type-based grouping and real-time filtering.
- **Message trees** — Explore alternative conversation paths via interactive branch controls with state persistence across branches.

## AI & Artifacts
- **Artifacts & Canvas** — Sidecar rendering for Markdown, HTML, Mermaid diagrams, and XLSX spreadsheets with persistent edits, AI-driven updates, and export capabilities.
- **Streaming via OpenRouter** — Access multiple LLMs (GPT-4, Claude, Mistral, etc.) with configurable model selection per message.
- **Slash-commands** — Palette-based shortcuts (`/`) to inject pre-defined system or user prompts for rapid templating.
- **KaTeX & Mermaid** — Full support for mathematical notation (KaTeX) and sophisticated diagramming (Mermaid) within the chat and artifact panels.

## Knowledge Bases (RAG)
- **Agentic RAG implementation** — LLM-driven knowledge retrieval where the AI uses specialised tools to query context based on intent.
- **Hybrid Semantic Search** — Combines 2048-dimensional vector embeddings (pgvector) with Postgres Full-Text Search using Reciprocal Rank Fusion (RRF).
- **Multi-format Ingestion** — Automated pipeline for extracting and indexing content from PDFs, Excel spreadsheets, and Markdown/Plain text files.
- **Document Management** — Full lifecycle tracking for indexed documents including token counting and status monitoring.

## Model Context Protocol (MCP)
- **HTTP Transport Integration** — Connect to remote MCP servers via the official TypeScript SDK to extend AI capabilities with custom toolsets.
- **Granular Tool Control** — Searchable tool picker for per-message tool selection and resource management.
- **Default Tooling** — Automatically enable specific tools for chats associated with particular Projects or Assistants.
- **SSRF Protection** — Mandatory URL validation for MCP server registrations to ensure secure communication with remote services.

## Specialised Workflows
- **Transform Workflow** — Multi-step spreadsheet automation engine with SSE-powered execution and manual review/approval gates.
- **Translation Workflow** — Dedicated side-by-side interface for linguistic translation with auto-detection and language swapping.
- **S3-Integrated Processing** — Efficient file handling using presigned S3 URLs passed directly to AI tools, avoiding large payload transfers.

## Authentication & Security
- **Comprehensive Authorisation** — Multi-method login via Email/Password, GitHub/Discord OAuth, and WebAuthn Passkeys.
- **Enhanced Security** — TOTP-based Multi-Factor Authentication (MFA) with secure recovery via backup codes.
- **Session Governance** — Fingerprinted session tracking with a management interface for global session revocation.
- **Global System Prompts** — Per-user preference layer that prepends global instructions across all conversation contexts.

## Collaboration & Organisation
- **Projects** — Group related chats with shared system prompts, knowledge bases, and default tool configurations.
- **Assistants** — Define distinct AI personas with unique avatars and system instructions for re-use across the application.
- **Resource Management** — Centralised management of prompts, knowledge bases, and MCP server configurations.

## Architecture & Persistence
- **Postgres 17 & Drizzle ORM** — Relational data integrity with type-safe schema management.
- **Hybrid State Management** — Optimistic UI updates via Zustand paired with robust Server Action-based persistence.
- **MinIO/S3 Storage** — Secure storage for conversation attachments and RAG documents with controlled access via presigned URLs.

# Database Schema

The application uses PostgreSQL with Drizzle ORM. Core tables include:
- **`user`** — Profiles, auth states, and preferences
- **`chat`** — Conversation sessions tied to users, projects, or assistants
- **`message`** — Tree-structured entries with `parent_id` for branching; stores content and tool metadata
- **`mcp_server`** — Remote HTTP MCP configurations (`url`, `headers`)
- **`attachment`** — S3 file metadata (`key`, `mime_type`) linked to messages or transform runs
- **`project`** / **`assistant`** — Shared prompts and tool configurations for chats
- **`knowledgebase`** — RAG metadata and document chunk tracking for semantic search

# Tech Stack

## Frontend
- [**Next.js**](https://nextjs.org/docs) — React framework with App Router and Server Components
- [**React**](https://react.dev) — Component-based UI library
- [**TypeScript**](https://www.typescriptlang.org/docs) — Type-safe JavaScript
- [**Tailwind CSS**](https://tailwindcss.com/docs) — Utility-first CSS framework
- [**Shadcn UI**](https://ui.shadcn.com) — Composable React component library
- [**Radix UI / Base UI**](https://www.radix-ui.com/docs/primitives/overview/introduction) — Accessible, unstyled component primitives
- [**Sonner**](https://sonner.emilkowal.ski) — Toast notifications
- [**Zustand**](https://zustand.docs.pmnd.rs) — Lightweight client-side state store
- [**React Markdown**](https://github.com/remarkjs/react-markdown) — Markdown to React components
- [**Mermaid**](https://mermaid.js.org) — Diagram and flowchart rendering
- [**KaTeX**](https://katex.org) — Mathematical typesetting
- [**unpdf**](https://github.com/pdfjs-express/pdfjs-express) — PDF text extraction
- [**BlockNote**](https://www.blocknote.dev) — Rich text editor

## Backend
- [**Better Auth**](https://better-auth.com/docs) — Email/password, OAuth, passkeys, and TOTP support
- [**Postmark**](https://postmark.com) — Transactional email service
- [**MinIO (AWS SDK v3)**](https://docs.min.io) — S3-compatible object storage

## Database & ORM
- [**PostgreSQL**](https://www.postgresql.org/docs) — Relational database
- [**Drizzle ORM**](https://orm.drizzle.team) — Type-safe SQL query builder and migrations

## AI & Language Models
- [**Vercel AI SDK**](https://sdk.vercel.ai/docs) — Streaming responses and tool integration
- [**OpenRouter API**](https://openrouter.ai) — Multi-model LLM provider
- [**@ai-sdk/mcp**](https://github.com/vercel/ai-sdk) — Model Context Protocol integration
- [**@modelcontextprotocol/sdk**](https://modelcontextprotocol.io) — Official MCP TypeScript SDK

# Requirements

## System Requirements

- **Node.js**: 22.x or higher
- **npm**: 9.x or higher (bundled with Node.js)
- **PostgreSQL 17.0** — Primary data store for users, chats, messages, and application state
- **S3/MinIO** — S3-compatible object storage for file uploads and attachments (or AWS S3 in production)
- **OpenRouter API** — LLM provider for AI conversation capabilities (account required; free tier available)
- **Postmark** — Transactional email service for authentication and notifications (account required)
- **HTTP MCP Servers (Optional)** — Required if you want to extend AI capabilities via remote toolsets

> Docker/Podman can be used to run PostgreSQL and MinIO locally without cloud dependencies.

# Setup

Follow these steps to set up and run the AI Client locally.

## 1. Clone Repository

Clone the repository to your local machine:

```bash
git clone https://github.com/mbeps/ai-client.git
cd ai-client
```


Install all required Node.js dependencies:

```bash
npm install
```

## 3. Configure Environment Variables

For local development, create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

### Environment Variables for Docker Containers

The `docker-compose.yml` file reads from `.env` to configure PostgreSQL and MinIO. Key variables:

- **`DB_HOST`**, **`DB_PORT`**, **`DB_USER`**, **`DB_PASSWORD`**, **`DB_NAME`** — PostgreSQL configuration
- **`S3_ACCESS_KEY`**, **`S3_SECRET_KEY`** — MinIO root credentials

These are referenced in `docker-compose.yml` and should be defined in `.env` (defaults are provided).

### Example `.env` (for Docker)

```bash
# PostgreSQL (docker-compose)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=better_auth_tutorial

# MinIO (docker-compose)
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
```

### Example `.env.local` (for Application)

```bash
# Database (Next.js application)
DATABASE_URL=postgresql://postgres:password@localhost:5432/better_auth_tutorial

# Authentication
BETTER_AUTH_SECRET=your-secure-random-string-here
BETTER_AUTH_URL=http://localhost:3000

# AI & Language Models

# Storage (MinIO/S3)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=ai-client-uploads

# Email Service
POSTMARK_SERVER_TOKEN=your-postmark-token-here
POSTMARK_FROM_EMAIL=noreply@yourdomain.com

# OAuth (optional)
CLIENT_ID_GITHUB=your-github-oauth-client-id
CLIENT_SECRET_GITHUB=your-github-oauth-secret
CLIENT_ID_DISCORD=your-discord-oauth-client-id
CLIENT_SECRET_DISCORD=your-discord-oauth-secret
```

### Environment Variable Reference

**Core Application**
- **`DATABASE_URL`** (required) — PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Ensure it matches your `.env` variables for the container
- **`BETTER_AUTH_SECRET`** (required) — Authentication secret key
  - Generate: `openssl rand -base64 32`
  - Keep secure; never commit to version control
- **`BETTER_AUTH_URL`** (required) — Auth callback URL (`http://localhost:3000` for dev)
- **`NEXT_PUBLIC_ALLOW_PRIVATE_NETWORK_MCP`** — Set to `true` to allow connecting to Localhost/Private MCP servers during development (bypasses SSRF guard)

**Storage**
- **`S3_ENDPOINT`** — MinIO/S3 endpoint URL (default: `http://localhost:9000`)
- **`S3_REGION`** — AWS region or MinIO region (default: `us-east-1`)
- **`S3_ACCESS_KEY`** — MinIO root user (default: `minioadmin`)
- **`S3_SECRET_KEY`** — MinIO root password (default: `minioadmin`)
- **`S3_BUCKET`** — Bucket name for uploads (default: `ai-client-uploads`)

**Email Service**
- **`POSTMARK_SERVER_TOKEN`** (required) — API token from https://postmark.com
- **`POSTMARK_FROM_EMAIL`** (required) — Verified sender email address

**OAuth (Optional)**
- **`CLIENT_ID_GITHUB`** / **`CLIENT_SECRET_GITHUB`** — GitHub OAuth credentials
- **`CLIENT_ID_DISCORD`** / **`CLIENT_SECRET_DISCORD`** — Discord OAuth credentials

## 4. Start Infrastructure (Optional)
These instructions are needed if you wish to run PostgreSQL and MinIO locally using Docker (or Podman). You can also connect to external services (e.g., managed PostgreSQL, AWS S3) by configuring the appropriate environment variables.

Start PostgreSQL and MinIO using Docker (or Podman):

```bash
docker-compose up -d
```

Verify both services are running:

```bash
docker ps
```

You should see `postgres` and `minio` containers. MinIO console is available at http://localhost:9001.

## 5. Set Up Database

Run database migrations:

```bash
npm run db:migrate
```

## 6. Run Development Server

Start the development server:

```bash
npm run dev
```
> The application will be available at http://localhost:3000.

Alternatively, you can build and run the application:

```bash
npm run build
npm start
```

# References

## Framework & Build
- [**Next.js**](https://nextjs.org/docs/app) — React meta-framework with App Router, Server Components, and Server Actions
- [**React**](https://react.dev) — Component-based UI library for building interactive interfaces
- [**TypeScript**](https://www.typescriptlang.org/docs) — Typed superset of JavaScript with compile-time safety

## Authentication & Security
- [**Better Auth**](https://better-auth.com/docs) — Multi-method authentication (email/password, OAuth, passkeys, TOTP 2FA)
- [**Radix UI**](https://www.radix-ui.com) — Unstyled, accessible component primitives for custom design systems

## Database & ORM
- [**PostgreSQL**](https://www.postgresql.org/docs) — Relational database for persistent storage
- [**Drizzle ORM**](https://orm.drizzle.team) — Type-safe SQL query builder with migrations and introspection

## AI & Language Models
- [**Vercel AI SDK**](https://sdk.vercel.ai/docs) — Streaming responses, tool integration, and language model abstraction
- [**OpenRouter API**](https://openrouter.ai) — Multi-model LLM provider with unified API
- [**Model Context Protocol**](https://modelcontextprotocol.io) — Protocol for AI tool and server integration

## UI & Styling
- [**Shadcn UI**](https://ui.shadcn.com) — Copy-paste React component library built on Radix UI
- [**Tailwind CSS**](https://tailwindcss.com/docs) — Utility-first CSS framework for rapid styling
- [**Sonner**](https://sonner.emilkowal.ski) — Toast notification component library

## Forms & Validation
- [**React Hook Form**](https://react-hook-form.com) — Performant form handling with minimal re-renders
- [**Zod**](https://zod.dev) — TypeScript-first schema validation for runtime safety

## State Management
- [**Zustand**](https://zustand.docs.pmnd.rs) — Lightweight, flexible state management without boilerplate

## Content Rendering
- [**React Markdown**](https://github.com/remarkjs/react-markdown) — Parse and render Markdown to React components
- [**Mermaid**](https://mermaid.js.org) — Diagram rendering for flowcharts, sequence diagrams, and more
- [**KaTeX**](https://katex.org) — Mathematical typesetting and LaTeX notation rendering
- [**unpdf**](https://github.com/pdfjs-express/pdfjs-express) — PDF text extraction and processing

## Storage & Files
- [**MinIO**](https://docs.min.io) — S3-compatible object storage for file uploads and assets
- [**AWS SDK v3**](https://docs.aws.amazon.com/sdk-for-javascript/) — AWS service client for S3/MinIO
- [**xlsx**](https://github.com/SheetJS/sheetjs) — Excel file parsing, generation, and manipulation

## Utilities
- [**UUID**](https://github.com/uuidjs/uuid) — Standard UUID generation for unique identifiers
- [**Date-fns**](https://date-fns.org) — Date manipulation, formatting, and parsing utilities
- [**cmdk**](https://github.com/pacocoursey/cmdk) — Fast command/search interface component
- [**Resizable Panels**](https://github.com/bvaughn/react-resizable-panels) — Draggable, resizable layout panels
- [**Vaul**](https://github.com/emilkowalski/vaul) — Mobile drawer/sheet component
- [**BlockNote**](https://www.blocknote.dev) — Rich text editor for document editing

## Services
- [**Postmark**](https://postmark.com) — Transactional email service for reliable delivery
- [**Node PostgreSQL**](https://node-postgres.com) — Node.js PostgreSQL client library

## Development
- [**Turbopack**](https://turbo.build/pack) — Next-generation bundler integrated with Next.js
- [**ESLint**](https://eslint.org) — JavaScript linter for code quality and consistency
