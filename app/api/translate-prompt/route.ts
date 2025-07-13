import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const SYSTEM_PROMPT = `You are an expert AI image generation prompt writer. Convert user requests into detailed, cinematic image generation prompts.

Guidelines:
- Create vivid, specific descriptions that paint a clear picture
- Include lighting, composition, mood, and style details
- Use cinematic and photographic terminology
- Be descriptive but concise (2-3 sentences max)
- Focus on visual elements, not abstract concepts

Examples:
User: "man in a bar" → "A man sits at a dimly lit bar counter, warm amber lighting casting dramatic shadows across his weathered face, shot with shallow depth of field, film noir aesthetic"

User: "woman walking in rain" → "A woman walks through heavy rain on a neon-lit city street at night, her silhouette illuminated by colorful reflections on wet pavement, cinematic wide shot with moody atmosphere"

Create direct, visual prompts without any formatting or labels - just the descriptive prompt itself.`

export async function POST(request: NextRequest) {
  try {
    const { userCommand, imageDescription } = await request.json()

    if (!userCommand) {
      return NextResponse.json({ error: "No user command provided" }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `${SYSTEM_PROMPT}

User request: "${userCommand}"

Convert this into a detailed, cinematic image generation prompt:`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const translatedPrompt = response.text()

    return NextResponse.json({ translatedPrompt })
  } catch (error) {
    console.error("Prompt translation error:", error)
    return NextResponse.json({ error: "Failed to translate prompt" }, { status: 500 })
  }
}
