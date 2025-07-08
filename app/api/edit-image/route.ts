import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

fal.config({
  credentials: process.env.FAL_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, prompt } = await request.json()

    if (!imageUrl || !prompt) {
      return NextResponse.json({ error: "Missing image URL or prompt" }, { status: 400 })
    }

    // Use Fal AI Kontext for image editing with new client
    const result = await fal.subscribe("fal-ai/kontext", {
      input: {
        image_url: imageUrl,
        prompt: prompt,
        negative_prompt: "blurry, low quality, distorted, artifacts",
        strength: 0.8,
        guidance_scale: 7.5,
        num_inference_steps: 20,
        seed: Math.floor(Math.random() * 1000000),
      },
    })

    const editedImageUrl = result.data?.image?.url || result.data?.images?.[0]?.url

    if (!editedImageUrl) {
      throw new Error("No edited image returned from Kontext")
    }

    return NextResponse.json({ editedImageUrl })
  } catch (error) {
    console.error("Image editing error:", error)
    return NextResponse.json({ error: "Failed to edit image" }, { status: 500 })
  }
}
