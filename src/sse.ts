import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { aopic } from "./lib/anthropic.js";

const app = new Hono();

app.get("/sse", (c) => {
  return streamSSE(
    c,
    async (stream) => {
      const thread = await getThread();

      for (let i = 0; i < thread.length; i++) {
        await stream.writeSSE({
          data: thread[i],
          event: "time-update",
          id: i.toString(),
        });

        await stream.sleep(1_000);
      }
    },
    async (err, stream) => {
      console.error("EventSource error:", err);
      stream.writeln("error");
    }
  );
});

app.get("/", (c) => {
  return c.html(`
    <html>
      <head>
        <title>sse - green thread edition</title>
        <style>
          * {
            font-family: 'Comic Sans MS', sans-serif;
            box-sizing: border-box;
          }
          
          body {
            padding: 20px;
            background-color: #f0e4d1;
            color: #800000;
            max-width: 800px;
            margin: 0 auto;
          }

          h1 {
            text-align: center;
            font-size: 2em;
            margin: 0 0 20px 0;
            padding: 10px;
          }

          h2 {
            text-align: center;
            margin: 0 0 20px 0;
            padding: 10px;
            font-size: 1.2em;
          }

          #messages {
            background-color: white;
            padding: 20px;
            border: 1px solid #800000;
            border-radius: 8px;
            white-space: pre-wrap;
            margin: 0 0 20px 0;
            min-height: 200px;
          }

          #messages li {
            margin-bottom: 10px;
            padding: 8px;
            background-color: #f8f4e8;
            border-radius: 4px;
            line-height: 1.4;
            list-style-type: none;
          }

          #messages li:last-child {
            margin-bottom: 0;
          }

          button {
            background-color: #800000;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            display: block;
            margin: 0 auto;
            transition: background-color 0.2s;
          }

          button:hover {
            background-color: #600000;
          }
        </style>

        <script>
          const eventSource = new EventSource("/sse");

          eventSource.addEventListener("time-update", (event) => {
            const messages = document.getElementById("messages");
            const lineItem = document.createElement("li");
            lineItem.textContent = event.data;
            messages.appendChild(lineItem);
            messages.scrollTop = messages.scrollHeight;
          });

          eventSource.onclose = () => {
            console.log(">mfw the connection is closed");
          };

          eventSource.onerror = (event) => {
            console.error(">mfw there's an error:", event);
            eventSource.close();
          };
        </script>
      </head>

      <body>
        <h1>green thread machine</h1>
        <ol id="messages"></ol>
        <button onclick="eventSource.close()">shut it down</button>
      </body>
    </html>
  `);
});

async function getThread() {
  // use antrhopic to generate a thread
  const response = await aopic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `generate a 4chan style green thread about niche coding topics, make sure always some drama mid way through, noah baumbach niche humor, short sentence per line, max 7 line thread:

        EXAMPLE:
        >be me, just vibing with SSE
        >server running smooth af
        >mfw everything works first try
        >implying this isn't just a counter
        >refresh hits different
        >server be like: sending data
        >just a simple chat, nothing fancy
        
        return the generated green thread only separated by newlines, no other text. remember max 7 lines.
        `,
      },
    ],
  });

  if (response.content[0].type === "text") {
    console.log(response.content[0].text);
    return response.content[0].text.split("\n");
  } else {
    throw new Error("Unexpected response from Anthropic");
  }
}

serve(app);
