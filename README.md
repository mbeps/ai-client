# AI Client

AI Client is a full-featured conversational workspace with branching message trees and interactive artefact sidecars. Send messages across alternative conversation paths, execute automated spreadsheet workflows, and inspect documents with integrated knowledge bases. Generation jobs run durably in the background, allowing uninterrupted navigation and page reloads during active streaming.

# Features

## Chat Interface, UX & Stream Resilience

- **Branching Message Trees** — Edit any message or regenerate responses to non-destructively fork sibling branches (`currentLeaf`), with interactive branch navigation and instant attachment cloning across branches.
- **Durable Background Execution** — Long-running LLM turns execute inside Inngest step functions, allowing uninterrupted navigation between chats, tab closes, or page reloads without dropping active generations.
- **Real-Time WebSocket Streaming** — Inngest Realtime channels stream assistant text deltas, reasoning tokens, tool calls, and execution trace steps directly to the browser.
- **Universal Reasoning & Thinking Traces** — Automatically extracts and renders model thinking processes across structured delta fields (`reasoning_content`, `reasoning`, `reasoning_details`) and inline delimiter tags (`<think>`, `<thought>`, `<reasoning>`).
- **Automated Synthesis Pass** — Executes a post-tool synthesis pass when a model completes multi-step tool calls without emitting a final text summary.
- **Context Window Tracking & Pair-Aware Truncation** — Live context usage pill calculates token consumption across messages, attachments, and active tool schemas while ensuring tool-call and tool-result pairs are never split during truncation.
- **Stream Watchdog & Abort Controls** — Dedicated stop endpoints, server-side abort registries, and client-side watchdog hooks detect and recover stalled or cancelled streams.
- **Slash (`/`) & Mention (`@`) Command Palettes** — Type `/` to inject reusable prompt templates or `@` to inline-select models, tools, skills, and knowledgebases directly from the chat input.
- **Citations & Tool Download Cards** — Automatically extracts structured RAG/tool citations and renders downloadable file cards for tool-generated outputs.
- **Global Search** — Unified search view for filtering chats, projects, and assistants in real time.

## AI Providers, Models & Artefacts

- **Sidecar Artefacts & Live Canvas** — Interactive split-pane viewer for HTML previews, Markdown documents, Mermaid diagrams, and multi-sheet XLSX spreadsheets with in-place editing, version history, and file export.
- **Multi-Provider Registry** — Connect to any OpenAI-compatible provider (OpenRouter, Ollama, Groq, Azure, vLLM, Anthropic, Google, local models) with AES-encrypted API keys and custom HTTP headers.
- **Dual-Endpoint Model Discovery** — Synchronises chat and embedding models via `/v1/models` and `/v1/embeddings/models`, with bulk table actions and capability badges (vision, tools, reasoning, embeddings).
- **Registry Import / Export & Caching** — Export and import provider and model configurations as portable JSON bundles, backed by an in-memory server registry cache with automatic invalidation.
- **Capability & Vision Guards** — Pre-flight capability checks warn or block requests when sending image attachments or tools to unsupported models.
- **KaTeX & Mermaid Rendering** — Native mathematical typesetting (KaTeX) and diagram rendering (Mermaid) across chat threads and artefacts.

## Subagents & Virtual Scratchpad

- **Autonomous Subagent Delegation** — The primary model can spawn specialised subagent roles with isolated context windows, custom system instructions, and filtered toolsets to solve complex subtasks.
- **Virtual Scratchpad File System** — Shared virtual file workspace (`scratchpad-service`) where subagents read, write, list, and delete intermediate notes and data files during execution.
- **Interactive Scratchpad Viewer** — Built-in modal for inspecting virtual scratchpad files and subagent execution traces directly from chat messages.
- **Per-Subagent Model Selection** — Configure dedicated models and tool permissions for subagent execution via the chat toolbar.

## Multi-File Skills Engine

- **Hierarchical Skill Trees** — Author and manage modular agent skills containing `SKILL.md` YAML frontmatter alongside nested folders of reference files, templates, and scripts.
- **ZIP Bundle Import & Export** — Package multi-file skills into `.zip` archives for backup or import external skill bundles via drag-and-drop upload.
- **In-Chat Skill Authoring Tools** — Built-in authoring tools allow the AI to create, edit, move, or delete skill files directly during a conversation.
- **Dynamic Prompt Fencing & Scoping** — Resolves active skills across global user settings, Projects, Assistants, and individual chats, injecting skill catalogues into the system prompt with XML fencing.

## Long-Term User Memory

- **Hybrid Vector & Keyword Memory** — Stores persistent user facts and preferences in PostgreSQL paired with dedicated per-user Qdrant vector collections.
- **Contextual Memory Retrieval** — Combines semantic similarity search and keyword matching to inject only relevant memories into the system prompt on each turn.
- **Autonomous & Manual Memory Control** — Models automatically save, update, or delete memories via built-in memory tools, complemented by a dedicated `/settings/memory` management interface and global opt-out toggle.

## Knowledge Bases (Hybrid RAG)

- **Agentic RAG Retrieval** — Models autonomously invoke knowledgebase search tools when user queries require domain-specific document context.
- **Hybrid Search with Reciprocal Rank Fusion (RRF)** — Fuses dense vector similarity search in Qdrant with PostgreSQL full-text search (`tsvector`) using RRF scoring.
- **Multi-Format Document Ingestion** — Asynchronous Inngest pipeline extracts, recursively chunks, and embeds content from PDFs (`unpdf`), Excel spreadsheets (`xlsx`), and Markdown/Plain text files.
- **Dimensionless Vectors & Auto-Reindexing** — Supports arbitrary embedding dimensions per knowledgebase, prefix-aware embedding models (e.g., E5/Nomic), and automated background re-indexing when switching default embedding models.
- **Document Lifecycle & Truncation Tracking** — Tracks document processing states, token counts, error diagnostics, and truncation indicators.

## Model Context Protocol (MCP)

- **HTTP Transport Connectors** — Connect to remote HTTP MCP servers using the official TypeScript SDK to extend assistants with external tools, resources, and prompts.
- **MCP OAuth 2.0 (RFC 9728)** — Built-in OAuth authorisation flow with automated client metadata discovery, callback handling, and encrypted credential storage.
- **Discovery of Tools, Resources & Prompts** — Automatically discovers remote MCP tools, readable resources, and server-defined prompts (accessible directly in the `/` prompt picker) with timeout protection.
- **Public Server Marketplace** — Publish MCP server configurations to a shared instance catalogue where other users can install connectors with their own encrypted authentication headers.
- **SSRF & DNS Rebinding Protection** — Validates MCP URLs and resolves DNS records prior to connection, blocking loopback, link-local, and private IPv4/IPv6 network ranges.

## Specialised Workflows & Background Jobs

- **SheetFlow (Transform Agents)** — Multi-step spreadsheet and document automation pipelines with sequential LLM turns, tool filtering, heartbeat monitoring, and failsafe guards.
- **In-Place Spreadsheet Mutations** — Dedicated spreadsheet mutation tools and workbook fallbacks that transform `.xlsx` files across workflow steps.
- **Human-in-the-Loop Review Gates** — Configurable approval checkpoints that pause background workflow runs until a user inspects the preview pane and approves continuation.
- **Real-Time Translation Workflow** — Side-by-side translation workspace supporting language auto-detection, language pair swapping, and live token streaming.
- **Background Jobs Monitor (`/jobs`)** — Unified dashboard for tracking active, completed, and failed Inngest runs across local dev and cloud environments with live polling, filtering, and one-click job cancellation.
- **Presigned S3 File Routing** — Passes presigned S3/MinIO URLs directly to external tools and workflows to process large files without payload bottlenecks.

## Collaboration & Workspace Organisation

- **Projects** — Organise related chats under shared workspaces with custom system prompts, bound knowledgebases, default tools, and scoped skills.
- **Assistants** — Build reusable AI personas with custom avatars, system instructions, default models, and pre-selected tools and skills.
- **Prompt Library** — Centralised CRUD interface for managing system and user prompt templates with group categorisation.

## Authentication, Security & Architecture

- **Multi-Method Authentication** — Email/Password, GitHub and Discord OAuth, account linking, and WebAuthn Passkeys powered by Better Auth.
- **Two-Factor Authentication (2FA)** — TOTP authenticator app setup and verification with single-use recovery backup codes.
- **Session & Account Governance** — Active device session inspection with remote revocation, plus self-service account deletion with email verification.
- **Transactional Email Pipeline** — Postmark-integrated emails for welcome onboarding, email verification, password resets, and account deletion alerts.
- **Defence-in-Depth Security** — AES encryption at rest for API keys and headers, API route rate limiting, strict resource ownership verification, and edge Content Security Policy (CSP) headers via `proxy.ts`.
- **Type-Safe Persistence & Error Contracts** — PostgreSQL 17 with Drizzle ORM, S3 orphaned attachment sweeping, LogTape structured logging, and a compile-time `Result<T, E>` error-handling pattern enforced via Biome GritQL rules.


# Requirements

- Node.js 24 or higher
- pnpm 10 or higher
- PostgreSQL 17
- Qdrant
- MinIO or AWS S3
- Inngest
- OpenAI-compatible AI provider (such as OpenRouter, Ollama, Groq, Azure, or local models)

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

- [PostgreSQL](https://www.postgresql.org/docs): Primary relational database.
- [Qdrant](https://qdrant.tech): Vector database for semantic chunk embeddings and keyword retrieval.
- [Drizzle ORM](https://orm.drizzle.team): Type-safe SQL query builder and migrations.

## AI & Tooling

- [Vercel AI SDK](https://sdk.vercel.ai/docs): Streaming responses and tool integration with multi-provider support.
- [Model Context Protocol](https://modelcontextprotocol.io): Standardised protocol for connecting AI models to external tools and resources.

# Setting Up Project

Follow these steps to set up and run the AI Client locally.

## 1. Clone the Repository

Clone the repository to your local machine:

```bash
git clone [https://github.com/mbeps/ai-client.git](https://github.com/mbeps/ai-client.git)
cd ai-client

```

## 2. Install Dependencies

Install all required Node.js dependencies using pnpm (v10+):

```bash
pnpm install

```

## 3. Configure Environment Variables

Create `.env.local` in the project root from the example template:

```bash
cp .env.example .env.local

```

> [!Note]
> If you use a `.env` file for Docker Compose variable interpolation, copy or symlink the relevant container variables into `.env` as well.

### Environment Variables for Docker Containers

The `docker-compose.yml` file configures PostgreSQL, MinIO, Inngest, and Qdrant using the following variables (with built-in defaults for local development):

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
INNGEST_PORT=8288
INNGEST_INTERNAL_URL=[http://host.docker.internal:3000/api/inngest](http://host.docker.internal:3000/api/inngest)

# Qdrant (docker-compose)
QDRANT_PORT=6333

```

### Example `.env.local` (for Application)

```bash
# Database (Next.js application)
DATABASE_URL=postgresql://postgres:password@localhost:5432/better_auth_tutorial

# Application & Authentication (Better Auth)
BETTER_AUTH_SECRET=your-secure-random-string-here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD=true

# Encryption at Rest (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your-base64-encoded-32-byte-key-here

# Vector Database (Qdrant for RAG & Long-Term Memory)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Inngest (Background Jobs & Realtime Streaming)
INNGEST_DEV=1
INNGEST_BASE_URL=http://localhost:8288
NEXT_PUBLIC_INNGEST_BASE_URL=http://localhost:8288
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Storage (MinIO / S3)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=ai-client-uploads

# Email Service (Postmark - Optional for local dev if email verification is not triggered)
POSTMARK_SERVER_TOKEN=your-postmark-token-here
POSTMARK_FROM_EMAIL=noreply@yourdomain.com

# OAuth Providers (Optional)
CLIENT_ID_GITHUB=your-github-oauth-client-id
CLIENT_SECRET_GITHUB=your-github-oauth-secret
CLIENT_ID_DISCORD=your-discord-oauth-client-id
CLIENT_SECRET_DISCORD=your-discord-oauth-secret

# MCP Security (Optional)
ALLOW_PRIVATE_NETWORK_MCP=false

# Logging (LogTape)
LOG_LEVEL=info

```

### Environment Variable Reference

**Core Application & Security**

- `DATABASE_URL` (required) — PostgreSQL connection string. Format: `postgresql://user:password@host:port/database`.
- `BETTER_AUTH_SECRET` (required) — Authentication secret key generated with `openssl rand -base64 32`.
- `BETTER_AUTH_URL` (required) — Base URL for Better Auth server callbacks (`http://localhost:3000` for development).
- `NEXT_PUBLIC_APP_URL` — Public base URL used by the auth client and MCP OAuth client metadata (default: `http://localhost:3000`).
- `ENCRYPTION_KEY` (required in production) — Base64-encoded 32-byte key used to encrypt AI provider API keys, custom headers, and MCP OAuth tokens at rest with AES-256-GCM. Generate with `openssl rand -base64 32`. Falls back to deriving a key from `BETTER_AUTH_SECRET` in local development if omitted.
- `NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD` — Set to `false` to disable email and password authentication; defaults to `true`.
- `ALLOW_PRIVATE_NETWORK_MCP` — Set to `true` to allow connecting to private network or `localhost` HTTP MCP servers during development (bypasses SSRF IP/DNS blocks).

**Vector Database (Qdrant)**

- `QDRANT_URL` — Qdrant HTTP endpoint URL for RAG document chunks and long-term user memories (default: `http://localhost:6333`).
- `QDRANT_API_KEY` (optional) — API key for authenticated Qdrant Cloud or secured instances (leave empty for local container).
- `QDRANT_PORT` — Host port mapping for the local Qdrant Docker container (default: `6333`).

**Inngest (Background Jobs & Realtime Streaming)**

- `INNGEST_DEV` — Set to `1` to run Inngest in local development mode.
- `INNGEST_BASE_URL` — Server-side Inngest endpoint URL (`http://localhost:8288` for local container).
- `NEXT_PUBLIC_INNGEST_BASE_URL` — Client-side Inngest URL used for realtime stream subscriptions (`http://localhost:8288` for local dev).
- `INNGEST_PORT` — Host port mapping for the Inngest dev server container (default: `8288`).
- `INNGEST_INTERNAL_URL` — URL used by the Dockerised Inngest dev server to reach the Next.js API route (default: `http://host.docker.internal:3000/api/inngest`).
- `INNGEST_EVENT_KEY` — Inngest event key (optional in local dev, required in production).
- `INNGEST_SIGNING_KEY` — Inngest webhook signing key (optional in local dev, required in production).

**Storage (MinIO / S3)**

- `S3_ENDPOINT` (required) — MinIO or S3-compatible endpoint URL (`http://localhost:9000` for local MinIO).
- `S3_REGION` — Storage region (default: `us-east-1`).
- `S3_ACCESS_KEY` (required) — MinIO root user or AWS access key ID.
- `S3_SECRET_KEY` (required) — MinIO root password or AWS secret access key.
- `S3_BUCKET` — Bucket name for file attachments and artefacts (default: `ai-client-uploads`). Automatically provisioned on first upload if it does not exist.

**Email Service**

- `POSTMARK_SERVER_TOKEN` (required for email delivery) — Server API token from Postmark.
- `POSTMARK_FROM_EMAIL` (required for email delivery) — Verified sender email address.

**OAuth (Optional)**

- `CLIENT_ID_GITHUB` / `CLIENT_SECRET_GITHUB` — GitHub OAuth credentials.
- `CLIENT_ID_DISCORD` / `CLIENT_SECRET_DISCORD` — Discord OAuth credentials.

**Logging**

- `LOG_LEVEL` — Minimum log severity threshold (`debug` | `info` | `warn` | `error` | `fatal`; default: `info`).

## 4. Start Infrastructure Containers

Start PostgreSQL, MinIO, Inngest, and Qdrant using Docker Compose (or Podman):

```bash
docker compose up -d

```

Verify that all four services are running:

```bash
docker ps

```

You should see `postgres`, `minio`, `inngest`, and `qdrant` containers running:

- **MinIO Console**: `http://localhost:9001` (default login: `minioadmin` / `minioadmin`)
- **Inngest Dev Dashboard**: `http://localhost:8288`
- **Qdrant Dashboard**: `http://localhost:6333/dashboard`

## 5. Set Up Database

Run Drizzle database migrations (the target PostgreSQL database is automatically created if it does not exist):

```bash
pnpm run db:migrate

```

_(Optional)_ Open Drizzle Studio to inspect the database schema:

```bash
pnpm run db:studio

```

## 6. Start the Development Server

Launch the Next.js development server (powered by Turbopack):

```bash
pnpm run dev

```

Open [http://localhost:3000](http://localhost:3000) in your browser.

# Run Application

Start the development server:

```bash
pnpm run dev

```

Alternatively, you can build the whole app and run it using the following commands:

```bash
pnpm run build
pnpm start

```

The application should now be running at http://localhost:3000.

# References

- [Next.js](https://nextjs.org/docs/app)
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs)
- [Inngest](https://www.inngest.com/docs)
- [Better Auth](https://better-auth.com/docs)
- [PostgreSQL](https://www.postgresql.org/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenAI API Compatibility](https://platform.openai.com/docs/api-reference)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Shadcn UI](https://ui.shadcn.com)
- [Radix UI](https://www.radix-ui.com)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Markdown](https://github.com/remarkjs/react-markdown)
- [Mermaid](https://mermaid.js.org)
- [KaTeX](https://katex.org)
- [unpdf](https://github.com/pdfjs-express/pdfjs-express)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)
- [Zustand](https://zustand.docs.pmnd.rs)
- [MinIO](https://docs.min.io)
- [AWS SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/)
- [xlsx](https://github.com/SheetJS/sheetjs)
- [UUID](https://github.com/uuidjs/uuid)
- [Date-fns](https://date-fns.org)
- [cmdk](https://github.com/pacocoursey/cmdk)
- [Resizable Panels](https://github.com/bvaughn/react-resizable-panels)
- [Vaul](https://github.com/emilkowalski/vaul)
- [BlockNote](https://www.blocknote.dev)
- [Postmark](https://postmark.com)
- [Node PostgreSQL](https://node-postgres.com)
- [Turbopack](https://turbo.build/pack)
- [Biome](https://biomejs.dev)
- [LogTape](https://logtape.org)
