# AI Client

AI Client is a full-featured conversational workspace with branching message trees and interactive artifact sidecars. Send messages across alternative conversation paths, execute automated spreadsheet workflows, and inspect documents with integrated knowledge bases. Generation jobs run durably in the background, allowing uninterrupted navigation and page reloads during active streaming.

# Features

## Chat Interface & UX
- **Branching conversations** — Edit any message to create sibling branches non-destructively; navigate trees intuitively.
- **Durable background execution** — Long-running AI response generation runs as background jobs with Inngest, allowing navigation between chats or browser reloads without losing generation progress.
- **Real-time streaming** — Inngest Realtime streams text, reasoning tokens (`<Thinking>`), and tool calls over WebSockets directly to the chat interface.
- **Global Search** — Unified interface for searching chats, projects, and assistants with type-based grouping and real-time filtering.
- **Message trees** — Explore alternative conversation paths via interactive branch controls with state persistence across branches.

## AI & Artifacts
- **Artifacts & Canvas** — Sidecar rendering for Markdown, HTML, Mermaid diagrams, and XLSX spreadsheets with persistent edits, AI-driven updates, and export capabilities.
- **Multi-Provider Model Support** — Connect to any OpenAI-compatible provider (OpenRouter, Ollama, Groq, Azure, local models). Register multiple providers with encrypted credentials and select per-message model configuration.
- **Automatic Model Discovery** — Dual-endpoint synchronisation discovers both chat and embedding models from any OpenAI-compatible provider via `/v1/models` and `/v1/embeddings/models` endpoints.
- **Slash-commands** — Palette-based shortcuts (`/`) to inject pre-defined system or user prompts for rapid templating.
- **KaTeX & Mermaid** — Full support for mathematical notation (KaTeX) and sophisticated diagramming (Mermaid) within the chat and artifact panels.

## Knowledge Bases (RAG)
- **Agentic RAG implementation** — LLM-driven knowledge retrieval where the AI uses specialised tools to query context based on intent.
- **Flexible Embedding Models** — Select any embedding model from registered providers for knowledge base indexing. Dimensionless vector storage supports arbitrary embedding dimensions.
- **Hybrid Semantic Search** — Combines vector embeddings (pgvector) with Postgres Full-Text Search using Reciprocal Rank Fusion (RRF) for precise semantic retrieval.
- **Multi-format Ingestion** — Automated pipeline for extracting and indexing content from PDFs, Excel spreadsheets, and Markdown/Plain text files.
- **Document Management** — Full lifecycle tracking for indexed documents including token counting and status monitoring.

## Model Context Protocol (MCP)
- **HTTP Transport Integration** — Connect to remote MCP servers via the official TypeScript SDK to extend AI capabilities with custom toolsets.
- **Granular Tool Control** — Searchable tool picker for per-message tool selection and resource management.
- **Default Tooling** — Automatically enable specific tools for chats associated with particular Projects or Assistants.
- **SSRF Protection** — Mandatory URL validation for MCP server registrations to ensure secure communication with remote services.

## Specialised Workflows
- **Transform Workflow** — Multi-step spreadsheet automation engine with Inngest durable job execution and manual review/approval gates.
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
- **Inngest Event Engine** — Durable background job orchestration with local dev server and subscription token-based WebSocket channels.
- **Hybrid State Management** — Optimistic UI updates via Zustand paired with robust Server Action-based persistence.
- **MinIO/S3 Storage** — Secure storage for conversation attachments and RAG documents with controlled access via presigned URLs.

# Requirements

- Node.js 22 or higher
- npm 9 or higher
- PostgreSQL 17
- MinIO or AWS S3
- Inngest dev server (via Docker or Podman) or Inngest Cloud
- OpenAI-compatible AI provider (such as OpenRouter, Ollama, Groq, Azure, or local models)
- Postmark account (Optional)
- HTTP MCP servers (Optional)

# Stack

## Frontend
- [Next.js](https://nextjs.org/docs): React framework with App Router and Server Components.
- [React](https://react.dev): Component-based UI library.
- [TypeScript](https://www.typescriptlang.org/docs): Type-safe programming language.
- [Tailwind CSS](https://tailwindcss.com/docs): Utility-first CSS framework.
- [Shadcn UI](https://ui.shadcn.com): Composable React component library.
- [Radix UI](https://www.radix-ui.com/docs/primitives/overview/introduction): Accessible, unstyled component primitives.
- [Zustand](https://zustand.docs.pmnd.rs): Client-side state store.
- [React Markdown](https://github.com/remarkjs/react-markdown): Markdown parsing and rendering for React.
- [Mermaid](https://mermaid.js.org): Diagram and flowchart rendering.
- [KaTeX](https://katex.org): Mathematical typesetting library.
- [BlockNote](https://www.blocknote.dev): Rich text editor.

## Backend
- [Inngest](https://www.inngest.com/docs): Durable execution engine for background workflows and real-time streaming.
- [Better Auth](https://better-auth.com/docs): Multi-method authentication supporting email, OAuth, passkeys, and two-factor authentication.
- [Postmark](https://postmark.com): Transactional email delivery service.
- [MinIO](https://docs.min.io): S3-compatible object storage service.

## Database
- [PostgreSQL](https://www.postgresql.org/docs): Relational database with vector search extension.
- [Drizzle ORM](https://orm.drizzle.team): Type-safe SQL query builder and migrations.

## AI & Tooling
- [Vercel AI SDK](https://sdk.vercel.ai/docs): Streaming responses and tool integration with multi-provider support.
- [Model Context Protocol](https://modelcontextprotocol.io): Standardised protocol for connecting AI models to external tools and resources.

# Database Schema

The application uses PostgreSQL with Drizzle ORM. Core tables include:
- **`user`** — Profiles, auth states, and preferences
- **`ai_provider`** — OpenAI-compatible provider registrations (base URL, API key, custom headers) with encryption
- **`ai_model`** — Model catalogue per provider with capability flags (tools, vision, reasoning, structured output, embeddings)
- **`user_settings`** — Per-user preferences including global system prompt and default chat/embedding model selection
- **`chat`** — Conversation sessions tied to users, projects, or assistants
- **`message`** — Tree-structured entries with `parent_id` for branching; stores content and tool metadata
- **`mcp_server`** — Remote HTTP MCP configurations (`url`, `headers`)
- **`attachment`** — S3 file metadata (`key`, `mime_type`) linked to messages or transform runs
- **`project`** / **`assistant`** — Shared prompts and tool configurations for chats
- **`knowledgebase`** — RAG metadata and document chunk tracking for semantic search

# Setting Up Project

Follow these steps to set up and run the AI Client locally.

## 1. Clone the Repository

Clone the repository to your local machine:

```bash
git clone https://github.com/mbeps/ai-client.git
cd ai-client
```

## 2. Install Dependencies

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

The `docker-compose.yml` file reads from `.env` to configure PostgreSQL, MinIO, and Inngest. Key variables:

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

# Inngest (docker-compose)
INNGEST_DEV=1
```

### Example `.env.local` (for Application)

```bash
# Database (Next.js application)
DATABASE_URL=postgresql://postgres:password@localhost:5432/better_auth_tutorial

# Authentication
BETTER_AUTH_SECRET=your-secure-random-string-here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD=true

# Inngest
INNGEST_DEV=1
INNGEST_BASE_URL=http://localhost:8288
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

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

# Logging (LogTape)
LOG_LEVEL=info
```

### Environment Variable Reference

**Core Application**
- `DATABASE_URL` (required) — PostgreSQL connection string. Format: `postgresql://user:password@host:port/database`.
- `BETTER_AUTH_SECRET` (required) — Authentication secret key generated with `openssl rand -base64 32`.
- `BETTER_AUTH_URL` (required) — Auth callback URL (`http://localhost:3000` for development).
- `NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD` — Set to `false` to disable email and password credential authentication; defaults to `true`.
- `ALLOW_PRIVATE_NETWORK_MCP` — Set to `true` to allow connecting to private network or localhost MCP servers during development.

**Inngest**
- `INNGEST_DEV` — Set to `1` to run Inngest in local development mode against the local dev server.
- `INNGEST_BASE_URL` — Inngest server endpoint URL (`http://localhost:8288` for the local container).
- `INNGEST_EVENT_KEY` — Inngest event publication key (optional for local dev, required in production).
- `INNGEST_SIGNING_KEY` — Webhook signing key for verifying Inngest requests (optional for local dev, required in production).

**Storage**
- `S3_ENDPOINT` — MinIO or S3 endpoint URL (`http://localhost:9000` for local MinIO).
- `S3_REGION` — AWS region or MinIO region (default: `us-east-1`).
- `S3_ACCESS_KEY` — MinIO root user or AWS access key.
- `S3_SECRET_KEY` — MinIO root password or AWS secret key.
- `S3_BUCKET` — S3 bucket name for uploads (default: `ai-client-uploads`).

**Email Service**
- `POSTMARK_SERVER_TOKEN` (required for email delivery) — API token from Postmark.
- `POSTMARK_FROM_EMAIL` (required for email delivery) — Verified sender email address.

**OAuth (Optional)**
- `CLIENT_ID_GITHUB` / `CLIENT_SECRET_GITHUB` — GitHub OAuth credentials.
- `CLIENT_ID_DISCORD` / `CLIENT_SECRET_DISCORD` — Discord OAuth credentials.

**Logging**
- `LOG_LEVEL` — Minimum log severity threshold (`debug` | `info` | `warn` | `error` | `fatal`; default: `info`).

## 4. Start Infrastructure Containers

Start PostgreSQL, MinIO, and Inngest using Docker or Podman:

```bash
docker-compose up -d
```

Verify that all services are running:

```bash
docker ps
```

You should see `postgres`, `minio`, and `inngest` containers. MinIO console is available at http://localhost:9001 and Inngest dev dashboard is available at http://localhost:8288.

## 5. Set Up Database

Run database migrations:

```bash
npm run db:migrate
```

# Run Application

Start the development server:

```bash
npm run dev
```

Alternatively, you can build the whole app and run it using the following commands:

```bash
npm run build
npm start
```

The application should now be running at http://localhost:3000.

# References

- [Next.js](https://nextjs.org/docs/app) — React meta-framework with App Router, Server Components, and Server Actions
- [React](https://react.dev) — Component-based UI library for building interactive interfaces
- [TypeScript](https://www.typescriptlang.org/docs) — Typed superset of JavaScript with compile-time safety
- [Inngest](https://www.inngest.com/docs) — Durable execution engine for background workflows and real-time streaming
- [Better Auth](https://better-auth.com/docs) — Multi-method authentication supporting credentials, OAuth, passkeys, and two-factor authentication
- [PostgreSQL](https://www.postgresql.org/docs) — Relational database for persistent storage
- [Drizzle ORM](https://orm.drizzle.team) — Type-safe SQL query builder with migrations and introspection
- [Vercel AI SDK](https://sdk.vercel.ai/docs) — Streaming responses, tool integration, and multi-provider language model abstraction
- [OpenAI API Compatibility](https://platform.openai.com/docs/api-reference) — Universal interface for chat and embedding model access across any OpenAI-compatible provider
- [Model Context Protocol](https://modelcontextprotocol.io) — Protocol for AI tool and server integration
- [Shadcn UI](https://ui.shadcn.com) — Composable React component library built on Radix UI
- [Radix UI](https://www.radix-ui.com) — Unstyled, accessible component primitives for custom design systems
- [Tailwind CSS](https://tailwindcss.com/docs) — Utility-first CSS framework for rapid styling
- [React Markdown](https://github.com/remarkjs/react-markdown) — Parse and render Markdown to React components
- [Mermaid](https://mermaid.js.org) — Diagram rendering for flowcharts, sequence diagrams, and more
- [KaTeX](https://katex.org) — Mathematical typesetting and LaTeX notation rendering
- [unpdf](https://github.com/pdfjs-express/pdfjs-express) — PDF text extraction and processing
- [React Hook Form](https://react-hook-form.com) — Performant form handling with minimal re-renders
- [Zod](https://zod.dev) — TypeScript-first schema validation for runtime safety
- [Zustand](https://zustand.docs.pmnd.rs) — Lightweight, flexible state management without boilerplate
- [MinIO](https://docs.min.io) — S3-compatible object storage for file uploads and assets
- [AWS SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/) — AWS service client for S3/MinIO
- [xlsx](https://github.com/SheetJS/sheetjs) — Excel file parsing, generation, and manipulation
- [UUID](https://github.com/uuidjs/uuid) — Standard UUID generation for unique identifiers
- [Date-fns](https://date-fns.org) — Date manipulation, formatting, and parsing utilities
- [cmdk](https://github.com/pacocoursey/cmdk) — Fast command/search interface component
- [Resizable Panels](https://github.com/bvaughn/react-resizable-panels) — Draggable, resizable layout panels
- [Vaul](https://github.com/emilkowalski/vaul) — Mobile drawer/sheet component
- [BlockNote](https://www.blocknote.dev) — Rich text editor for document editing
- [Postmark](https://postmark.com) — Transactional email service for reliable delivery
- [Node PostgreSQL](https://node-postgres.com) — Node.js PostgreSQL client library
- [Turbopack](https://turbo.build/pack) — Next-generation bundler integrated with Next.js
- [Biome](https://biomejs.dev) — Fast formatter and linter for JavaScript, TypeScript, and JSX
- [LogTape](https://logtape.org) — Fast, zero-dependency structured logging framework with hierarchical categories and pluggable sinks
