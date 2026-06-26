export const PROMPTS = {
  SYSTEM: {
    FILE_BRIDGE_SPREADSHEET_ACCESS_TEMPLATE: (lines: string): string =>
      `## File Access\nIMPORTANT: The user has attached spreadsheet files. They have been downloaded to the local filesystem for you to analyse using the available Excel MCP tools. You MUST use the Excel MCP tools (e.g. get_workbook_metadata, read_cells, profile_data, etc.) to read and analyse these files. Do NOT ask the user for a file path — the paths are provided below. Pass the exact path to the file_path parameter of any Excel MCP tool call:\n${lines}`,
    KNOWLEDGE_BASE_TOOL_INSTRUCTION:
      "A knowledge base is attached to this conversation with company-specific documents and domain context. " +
      "ALWAYS search the knowledge base first when answering questions, unless the query is clearly off-topic or requires only common knowledge. " +
      "Examples of when to search: product details, policies, technical specs, process documentation, historical data, user requirements, any domain-specific content. " +
      "Use precise, focused search queries. After retrieving results, synthesise them into your response.",
  },
  TOOLS: {
    MANAGE_ARTIFACT: {
      DESCRIPTION:
        "Manage and display an interactive artifact to the user. Use this when the user asks for a document, email, text, spreadsheet, HTML UI, or Mermaid diagram.\n\n" +
        "TYPE GUIDELINES:\n" +
        "- 'markdown': Use for text, reports, emails, or code. Supports GitHub Flavored Markdown (tables, lists, etc). Use this by default.\n" +
        '- \'spreadsheet\': Use for rich tabular data. Pass the full multi-sheet JSON via the `sheets` argument: [{ "name": "SheetName", "data": [[values]] }]. Values can be primitives or objects { "v": value, "s": { "bold": boolean, "italic": boolean, "textAlign": \'left\'|\'center\'|\'right\', "backgroundColor": string, "color": string } }.\n' +
        "- 'html': Use for interactive designs, custom layouts, or web-like dashboards. Provide standalone HTML snippets.\n" +
        "- 'mermaid': Strictly for diagrams (flowcharts, sequence, etc). Provide raw Mermaid.js markup.\n\n" +
        "SPREADSHEET UPDATES — IMPORTANT:\n" +
        "There is NO 'update' action and NO partial-update mechanism. To add, remove, or modify sheets, you MUST call this tool again with the COMPLETE set of all sheets (existing + new/modified). Do NOT use action='update', artifact_id, or updates fields — they are not supported and will be ignored. Always re-emit the full spreadsheet.\n\n" +
        "CONSTRAINTS:\n" +
        "- NEVER repeat artifact content in your main chat response.\n" +
        "- Provide a brief confirmation: 'I've created/updated the [Title] artifact for you.'\n" +
        "- DO NOT use this tool to read artifacts; they are already visible in history.\n" +
        "- CRITICAL: Do NOT wrap arguments in an 'artifact' or 'updates' key. Pass all arguments at the top level of the tool call.",
      SUCCESS_MESSAGE:
        "Artifact successfully displayed to the user in a separate UI panel. SUCCESS CRITERIA CHECK: DO NOT repeat the content in your text response. Simply acknowledge that the artifact is ready.",
      DEFAULT_TITLE: "Generated Artifact",
    },
    SEARCH_KNOWLEDGE_BASE: {
      DESCRIPTION:
        "Search the knowledge base for relevant information. Call this when the user asks about their documents, references specific topics that may be in the knowledge base, or when you need domain-specific context not already in the conversation. Formulate a focused, specific search query — avoid overly broad queries. After retrieving results, synthesise the information into your response. Do not call this tool for general knowledge questions.",
    },
  },
  SCHEMA: {
    MANAGE_ARTIFACT: {
      TYPE_DESCRIPTION:
        "The type of artifact: 'markdown', 'spreadsheet', 'html', or 'mermaid'",
      TITLE_DESCRIPTION: "The title of the artifact",
      CONTENT_DESCRIPTION:
        'The content of the artifact. For spreadsheet, provide a multi-sheet JSON object like { "sheets": [{ "name": "Sheet1", "data": [["A1", "B1"], ["A2", "B2"]] }] }. Values in data can be simple types or objects { "v": value, "s": { "bold": true } }. For HTML, provide raw HTML. For markdown, provide markdown text. For mermaid, provide diagram code.',
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
  WORKFLOWS: {
    TRANSLATE: (
      sourceDesc: string,
      targetLanguage: string,
      text: string,
      hasImage?: boolean,
    ): string =>
      hasImage
        ? `I have attached an image containing text. Please perform the following steps:\n1. OCR: Accurately identify and extract all text from the image.\n2. Translate: Translate the extracted text from ${sourceDesc} to ${targetLanguage}.\n3. Formatting: Maintain the original formatting as much as possible.\n\nOnly return the translated text. Do not include explanations, original text, or extra commentary.`
        : `Translate the following text from ${sourceDesc} to ${targetLanguage}. \nOnly return the translated text. Do not include any explanations or extra text.\n\nText to translate:\n${text}`,
  },
} as const;
