import { type NextRequest, NextResponse } from "next/server"
import { generateCharacterDescription } from "@/lib/llm"

export async function POST(request: NextRequest) {
  try {
    const { name, description, genre, project_context } = await request.json()

    if (!name?.trim() || !description?.trim()) {
      return NextResponse.json({ 
        error: "Name and description are required" 
      }, { status: 400 })
    }

    const enhanced = await generateCharacterDescription(
      name.trim(),
      description.trim(),
      project_context?.trim(),
      genre?.trim()
    )

    return NextResponse.json(enhanced)
  } catch (error) {
    console.error("Character enhancement error:", error)
    return NextResponse.json({ error: "Failed to enhance character" }, { status: 500 })
  }
}