import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json()

    if (!imageBase64) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not configured")
      return NextResponse.json({ error: "Gemini API not configured" }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `Analyze this image and provide a detailed description focusing on:
- Main subjects and objects
- Visual style, colors, and composition
- Lighting and mood
- Any text or notable details
- Overall scene context

Keep the description concise but comprehensive, suitable for AI image editing context.`

    // Detect MIME type from base64 data or default to JPEG
    let mimeType = "image/jpeg"
    if (imageBase64.startsWith("/9j/")) mimeType = "image/jpeg"
    else if (imageBase64.startsWith("iVBORw0KGgo")) mimeType = "image/png"
    else if (imageBase64.startsWith("R0lGODlh")) mimeType = "image/gif"
    else if (imageBase64.startsWith("UklGR")) mimeType = "image/webp"

    console.log("Calling Gemini Vision API with MIME type:", mimeType)

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType
        }
      }
    ])

    const response = result.response
    if (!response) {
      throw new Error("No response from Gemini")
    }

    const description = response.text()
    if (!description) {
      throw new Error("Empty response from Gemini")
    }

    console.log("Image description successful, length:", description.length)
    return NextResponse.json({ description })
  } catch (error) {
    console.error("Image description error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ 
      error: "Failed to describe image", 
      details: errorMessage 
    }, { status: 500 })
  }
}