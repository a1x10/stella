import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const z = createOpenAICompatible({
  name: "z",
  baseURL: "https://opencode.ai/zen/v1",
  apiKey: "sk-U6RlsOyn7qmvEsYEQ0c4syqtCpff0GQXd2z8Wr9m5Px2tpxrtU7GiUvTRM4arfw8",
});

const m = z.chatModel("mimo-v2.5-free");
console.log("Starting...");

const r = streamText({
  model: m,
  messages: [{ role: "user", content: "say hi" }],
});

console.log("Waiting for stream...");

for await (const p of r.fullStream) {
  if (p.type === "text-delta") process.stdout.write(p.text);
}
console.log("\nDONE");
