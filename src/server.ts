import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getNotes, searchNotes } from "./lib/notes.js";

const server = new McpServer({
  name: "Playground MCP",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "list-notes",
  "List all notes from Apple Notes",
  {
    page: z.number().min(1).default(1).describe("Page number to retrieve"),
    pageSize: z.number().min(1).max(1000).default(10).describe("Number of notes per page"),
  },
  async ({ page = 1, pageSize = 10 }) => {
    const notes = await getNotes(page, pageSize);

    if (notes.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No notes found or error accessing Apple Notes.",
          },
        ],
      };
    }

    const formattedNotes = notes
      .map(
        (note) =>
          `Title: ${note.title}
---
${note.content.length > 200 ? note.content.slice(0, 200) + "..." : note.content}
====================`
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          //tmp trim that shit
          text: formattedNotes.slice(0, 1000),
        },
      ],
    };
  }
);

server.tool(
  "search-notes",
  "Search notes in Apple Notes",
  {
    query: z.string().describe("Search query to find in note titles and content"),
  },
  async ({ query }) => {
    const notes = await searchNotes(query);

    if (notes.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No notes found matching "${query}"`,
          },
        ],
      };
    }

    const formattedNotes = notes
      .map(
        (note) =>
          `Title: ${note.title}
---
${note.content.length > 100 ? note.content.slice(0, 100) + "..." : note.content}
====================`
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: formattedNotes,
        },
      ],
    };
  }
);

server.tool(
  "list-note-titles",
  "List only the titles of notes from Apple Notes",
  {
    page: z.number().min(1).default(1).describe("Page number to retrieve"),
    pageSize: z.number().min(1).default(50).describe("Number of notes per page"),
  },
  async ({ page = 1, pageSize = 10 }) => {
    const notes = await getNotes(page, pageSize);

    if (notes.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No notes found or error accessing Apple Notes.",
          },
        ],
      };
    }

    const titles = notes.map((note) => note.title).join("\n");
    console.log(JSON.stringify(titles, null, 2));

    return {
      content: [
        {
          type: "text",
          //tmp trim that shit
          text: titles.slice(0, 1000),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
