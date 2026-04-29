export const PROMPTS = {
  SYSTEM: {
    FILE_BRIDGE_SPREADSHEET_ACCESS_TEMPLATE: (lines: string): string =>
      `## File Access\nIMPORTANT: The user has attached spreadsheet files. They have been downloaded to the local filesystem for you to analyse using the available Excel MCP tools. You MUST use the Excel MCP tools (e.g. get_workbook_metadata, read_cells, profile_data, etc.) to read and analyse these files. Do NOT ask the user for a file path — the paths are provided below. Pass the exact path to the file_path parameter of any Excel MCP tool call:\n${lines}`,
  },
  TOOLS: {
    MANAGE_ARTIFACT: {
      DESCRIPTION:
        "Manage and display an interactive artifact to the user. Use this when the user asks for a document, email, text, spreadsheet, HTML UI, or Mermaid diagram.\n\n" +
        "WHAT TO DO:\n" +
        "- Set the type to strictly one of: 'markdown', 'spreadsheet', 'html', or 'mermaid'.\n" +
        "- Use 'markdown' for emails, letters, code snippets, or general text.\n" +
        "- Place the entire requested content inside the tool's 'content' parameter.\n" +
        "- After calling the tool, respond to the user with a brief 1-2 sentence summary saying the artifact was created.\n\n" +
        "WHAT NOT TO DO:\n" +
        "- NEVER repeat the content of the artifact in your main chat response.\n" +
        "- Do not provide a preview or copy of the content outside the artifact.\n" +
        "- DO NOT use this tool to read an artifact. Past artifacts (including user edits) are already fully visible in your message history.\n\n" +
        "SUCCESS CRITERIA:\n" +
        "- The user sees the rich content exclusively in the artifact panel, and your chat message only contains a short confirmation.",
      SUCCESS_MESSAGE:
        "Artifact successfully displayed to the user in a separate UI panel. SUCCESS CRITERIA CHECK: DO NOT repeat the content in your text response. Simply acknowledge that the artifact is ready.",
      DEFAULT_TITLE: "Generated Artifact",
    },
  },
  SCHEMA: {
    MANAGE_ARTIFACT: {
      TYPE_DESCRIPTION:
        "The type of artifact: 'markdown', 'spreadsheet', 'html', or 'mermaid'",
      TITLE_DESCRIPTION: "The title of the artifact",
      CONTENT_DESCRIPTION:
        "The content of the artifact. For spreadsheet, provide a JSON array of objects. For HTML, provide raw HTML. For markdown, provide markdown text. For mermaid, provide the mermaid diagram code.",
    },
  },
  COMPOSITION: {
    SLASH_PROMPT_SEPARATOR: "\n\n",
  },
  UI: {
    EXAMPLES: {
      ASSISTANT_SYSTEM_PROMPT_PLACEHOLDER_CREATE:
        "e.g., You are a helpful code reviewer...",
      ASSISTANT_SYSTEM_PROMPT_PLACEHOLDER_EDIT:
        "e.g., You are a friendly helpful assistant.",
      PROJECT_GLOBAL_PROMPT_PLACEHOLDER_EDIT:
        "e.g., You are an expert code reviewer specializing in React.",
      PROMPT_CONTENT_PLACEHOLDER_CREATE: "You are an expert at...",
      PROMPT_CONTENT_PLACEHOLDER_EDIT:
        "The instructions associated with this shortcut.",
    },
  },
} as const;