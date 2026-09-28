# Skills Configuration for Projects, Assistants, and Automations Spec

## Goal
Allow skills to be configured and utilized across Projects, Assistants, and Step-by-Step Automations (Transform Agents).
Support three skill modes:
1. **Dynamic Loading (Default)**: AI dynamically loads necessary skills on demand via `load_skill`.
2. **No Skills**: Completely disables agent skills.
3. **Specific Skills**: Pre-loads selected skills directly into the system instructions for continuous guidance AND allows dynamic loading of other skills via `load_skill`.

A shared, reusable configuration component (`SkillsConfigTab`) will provide a consistent user experience across Projects, Assistants, and Automations.

---

## 1. Database Schema

Add `skillMode` and `skillIds` columns to:
- `project` (`drizzle/schemas/project-schema.ts`)
- `assistant` (`drizzle/schemas/assistant-schema.ts`)
- `transform_agent` (`drizzle/schemas/transform-agent-schema.ts`)

```typescript
// Columns added to project, assistant, and transformAgent tables
skillMode: text("skill_mode", { enum: ["dynamic", "none", "specific"] })
  .notNull()
  .default("dynamic"),
skillIds: text("skill_ids")
  .array()
  .notNull()
  .default(sql`'{}'::text[]`),
```

A migration script will be generated and run via `drizzle-kit generate` and applied to PostgreSQL.

---

## 2. Validation Schemas and Types

Create `schemas/skill/skill-config.ts`:
- `skillModeSchema = z.enum(["dynamic", "none", "specific"]).default("dynamic")`
- `skillIdsSchema = z.array(z.string()).default([])`

Update:
- `schemas/project/project.ts`: Add `skillMode` and `skillIds` to `createProjectSchema`, `updateProjectSchema`, and `projectSchema`.
- `schemas/assistant/assistant.ts`: Add `skillMode` and `skillIds` to `createAssistantSchema`, `updateAssistantSchema`, and `assistantSchema`.
- `schemas/workflows/transform-agent.ts`: Add `skillMode` and `skillIds` to `createTransformAgentSchema` and `updateTransformAgentSchema`.
- Corresponding TypeScript types in `types/project/`, `types/assistant/`, and `types/transform/`.

---

## 3. Shared UI Component: `SkillsConfigTab`

Path: `components/shared/skills-config-tab.tsx`

Features:
- Mode selection cards (RadioGroup/Card buttons):
  - **Dynamic (Default)**: "Dynamic loading — AI automatically loads relevant skills when needed."
  - **No Skills**: "Disabled — No skills available."
  - **Specific Skills**: "Pre-load selected skills — Always active in instructions, with dynamic access to others."
- When "Specific Skills" is selected, embeds `SkillsPicker` (search, select all, deselect all, skill cards with badges and descriptions).
- Reusable across:
  - `app/(main)/projects/[id]/page.tsx`
  - `app/(main)/assistants/[id]/page.tsx`
  - `app/workflows/transform/[id]/page.tsx`
- Includes save button with loading indicator.

---

## 4. UI Tab Placements

Add a dedicated **Skills** tab (`<SidebarTabsTrigger value="skills">` with `BrainCircuit` icon):
- `ProjectPage`: After `Tools` tab (or alongside `Knowledge` and `Tools`).
- `AssistantPage`: After `Tools` tab.
- `TransformAgentPage`: In sidebar tabs alongside `Knowledge Bases` and `Tools`.

---

## 5. Execution Integration

### 5.1 Chat Context (`lib/chat/load-chat-context.ts`)
1. Resolve skill configuration:
   - If chat belongs to an assistant with custom skill config, inherit assistant's `skillMode` and `skillIds`.
   - Else if chat belongs to a project with custom skill config, inherit project's `skillMode` and `skillIds`.
   - Default: `skillMode = "dynamic"`, `skillIds = []`.
2. Behavior:
   - `none`:
     - If user manually selected skills in chat attachments menu, respect user override; otherwise, `availableSkills = []`, `selectedSkills = []`.
   - `specific`:
     - Pre-load matching skills into `selectedSkills` (merged with any chat-level selections).
     - Provide remaining enabled skills in `availableSkills` for dynamic `load_skill` invocation ("both").
   - `dynamic`:
     - Pre-load chat-level selections into `selectedSkills` (if any).
     - Provide all other enabled user skills in `availableSkills` for dynamic `load_skill` invocation.

### 5.2 Automation / Transform Step Execution (`lib/transform/load-transform-context.ts` & `lib/transform/run-steps.ts`)
1. In `loadTransformContext`:
   - Query user's enabled skills from `skill` table.
   - Resolve `agentRow.skillMode` and `agentRow.skillIds`.
   - Construct `availableSkills` and `selectedSkills`.
   - If any skills are active or dynamically available, register `registerSkillTool(userId)` in tools map.
2. In `run-steps.ts`:
   - Inject pre-loaded `selectedSkills` into step instructions (with bundled reference files).
   - Inject `<available_skills>` catalog and progressive disclosure guidance into step instructions if `availableSkills.length > 0`.
   - Provide `load_skill` tool in step execution toolset.

---

## 6. Testing & Verification

1. Unit tests for schema validation (`createProjectSchema`, `createAssistantSchema`, `createTransformAgentSchema`).
2. Unit tests for `loadChatContext` and `loadTransformContext` skill resolution across all 3 modes (`dynamic`, `none`, `specific`).
3. Unit tests for `SkillsConfigTab` component rendering and mode switching.
4. E2E / regression test: run `npm run test` and `npm run build` or typecheck.
