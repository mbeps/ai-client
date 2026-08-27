# Project Learnings

## Tools & MCPs
- **Internal vs External Tools**: Built-in tools such as Artifacts / Canvas (`internal:tool:manage_artifact`) are registered within the application's internal tool registry and do not depend on external MCP servers.
- **Tools Picker Availability**: The "Select Tools" dialog trigger must only be disabled when the selected model does not support tool calling (`capTools` is false / `supportsTools` is false). It should remain enabled even when zero MCP servers are configured or enabled so users can select internal tools like Canvas.
- **Prop Defaults**: Always default `servers = []` in components dealing with MCP server lists (`AttachmentsMenu`, `ToolPickerList`) to avoid `undefined.forEach` runtime errors or unintentional falsy disabling.

## Message Tree & Streaming
- **Assistant Message Parent ID**: In `useStreamResponse`, when inserting the finished assistant message via `addMessage`, `parentId` must be the triggering user message's ID (`userMsgId`), NOT the user message's own `parentId`. Setting it to the user's `parentId` turns the assistant message into a sibling rather than a child, causing `reconstructThread` to omit the user message from the active thread.

## Vitest Testing
- When writing tests for UI components that import backend or store dependencies, mock `@/lib/env`, `@/drizzle/db`, and `@/lib/auth/auth` to prevent live service initialization (e.g. Postmark token checks) during test runs.

## AI SDK v7 Multi-Step Tool Calls & Artifacts
- **Aggregation across Steps**: In AI SDK v7, `finish.toolCalls` and `finish.toolResults` aggregate across all steps in the multi-step turn, whereas `finish.finalStep.toolCalls` only reflects tool calls executed during the very last step. For assistant turns where tool invocation happens in step 1 and textual summary in step 2 (`finalStep`), reading from `finalStep` discards the tool calls and produces empty metadata.
- **Property Normalization**: AI SDK v7 represents tool call arguments on `input` and tool results on `output`, whereas application metadata schemas expect `args` and `result`. Map `tc.args ?? tc.input` and `tr.result ?? tr.output` when serializing to database metadata.
- **Historical Tool Call Serialization**: In AI SDK v7, provider serializers convert historical `ToolCallPart` objects by reading `part.input`. Setting only `args` leaves `part.input` undefined, causing providers (like OpenAI) to serialize `{}` (empty arguments) into the model message prompt. Always populate `input: parsedInput` in `assembleModelMessages`.
- **`stopWhen` and Multi-Step Tools**: When tools are registered for file attachments (`get_file_url`), `stopWhen` must be configured with `isStepCount(...)` even if no MCP servers are enabled (`hasMcpTools` is false). Otherwise `streamText` defaults to `maxSteps: 1` and stops after tool execution without producing an assistant reply.
- **BlockNote Markdown Serialization**: `editor.blocksToMarkdownLossy(editor.document)` is an asynchronous function returning a `Promise<string>`. Calling it synchronously passes an unresolved Promise that stringifies to `"[object Promise]"`. Always `await` it before calling update handlers.
- **Transform Workflow Resumption**: When resuming a transform workflow run from a review step (`startFromStep > 0`), only the latest predecessor output file (`outputAttachmentIds[outputAttachmentIds.length - 1]`) should be passed to `buildFileContext` as the active input. In addition, `activeWorkbookFilePath` must be cleared (`null`) whenever a new artifact is persisted from `manage_artifact` so downstream steps do not reuse stale local temporary files.


