import { NextRequest, NextResponse } from "next/server"
import { streamText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

const zen = createOpenAICompatible({
  name: "zen",
  baseURL: "https://opencode.ai/zen/v1",
  apiKey: process.env.OPENCODE_API_KEY || "",
})

export async function POST(req: NextRequest) {
  const { messages, model = "mimo-v2.5-free" } = await req.json()

  const result = streamText({
    model: zen.chatModel(model),
    system: "Ты — Zen, ИИ-движок Stella Coder. Отвечай кратко и по делу.",
    messages,
  })

  return result.toDataStreamResponse()
}
