import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

// Configure FAL
const FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) {
  console.error("FAL_KEY env-var missing!")
}

fal.config({
  credentials: FAL_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 })
    }

    console.log('Submitting 4 images generation to FLUX queue:', { 
      prompt: prompt.substring(0, 100) + '...', 
      aspectRatio: aspectRatio || "1:1",
    })
    
    // Prepare input for FAL text-to-image generation
    const input = {
      prompt: prompt,
      aspect_ratio: aspectRatio || "1:1",
      output_format: "jpeg",
      safety_tolerance: 2,
      num_images: 4, // Generate 4 images in parallel
      seed: Math.floor(Math.random() * 1000000),
    }
    
    // Submit to queue with webhook (much more efficient than polling)
    const { request_id } = await fal.queue.submit("fal-ai/flux-pro/kontext/text-to-image", {
      input,
      // Optional: Add webhook URL for real-time updates
      // webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/flux-complete`,
    })

    console.log('FLUX generation submitted with request_id:', request_id)
    
    return NextResponse.json({ request_id, status: "submitted" })
  } catch (error) {
    console.error("Image generation submission error:", error)
    return NextResponse.json({ error: "Failed to submit image generation" }, { status: 500 })
  }
}