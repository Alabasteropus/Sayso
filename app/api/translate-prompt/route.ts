import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const SYSTEM_PROMPT = `You are a precision prompt generator for an AI image editor. Users give vague photo edit requests. Your job is to:

- Translate vague terms like "make it cooler" or "fix the colors" into concrete edits using descriptive terms.
- NEVER change parts of the image the user didn't explicitly request.
- Output should use clear formatting:

INSTRUCTION: [one-liner user intent]
ACTION: [descriptive edit for Kontext model]

EXAMPLE: "Remove the man in the background without altering lighting or subjects in the foreground. Maintain wedding dress details and natural color tone."

Be specific about what to edit and what to preserve. Focus on the exact request without adding unnecessary changes.`

export async function POST(request: NextRequest) {
  try {
    const { userCommand } = await request.json()

    if (!userCommand) {
      return NextResponse.json({ error: "No user command provided" }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `${SYSTEM_PROMPT}

User command: "${userCommand}"

Translate this into a precise image editing prompt:`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const translatedPrompt = response.text()

    return NextResponse.json({ translatedPrompt })
  } catch (error) {
    console.error("Prompt translation error:", error)
    return NextResponse.json({ error: "Failed to translate prompt" }, { status: 500 })
  }
}
