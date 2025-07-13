import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { fal } from "@fal-ai/client"
import { cookies } from "next/headers"

// Configure fal client
const FAL_KEY = process.env.FAL_KEY
if (FAL_KEY) {
  fal.config({
    credentials: FAL_KEY,
  })
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { 
      shot_id, 
      scene_description, 
      camera_angle, 
      camera_movement,
      characters 
    } = await request.json()

    if (!shot_id || !scene_description?.trim()) {
      return NextResponse.json({ 
        error: "Shot ID and scene description are required" 
      }, { status: 400 })
    }

    // Get authenticated user (allow null for development)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    let userId = user?.id
    
    // If no authenticated user, use a default user ID for development
    if (!userId) {
      userId = '00000000-0000-0000-0000-000000000000' // Default dev user
    }

    // First, translate the scene description into a proper image prompt using the same system as main image generation
    const promptResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/translate-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        userCommand: `Generate a cinematic ${camera_angle || 'medium'} shot image: ${scene_description.trim()}`,
        imageDescription: null 
      }),
    })

    let translatedPrompt = scene_description.trim()
    if (promptResponse.ok) {
      const promptData = await promptResponse.json()
      translatedPrompt = promptData.translatedPrompt || scene_description.trim()
    }

    console.log('Submitting to Fal.ai with prompt:', translatedPrompt.substring(0, 100) + '...')
    
    // Generate the shot image using Fal.ai directly with same format as main image generation
    const { request_id } = await fal.queue.submit("fal-ai/flux-pro/kontext/text-to-image", {
      input: {
        prompt: translatedPrompt,
        aspect_ratio: "16:9", // Cinematic aspect ratio
        output_format: "jpeg",
        safety_tolerance: 2,
        num_images: 1,
        seed: Math.floor(Math.random() * 1000000),
      },
    })

    // Poll for completion
    const finalResult = await fal.queue.result("fal-ai/flux-pro/kontext/text-to-image", {
      requestId: request_id,
    })

    if (!finalResult.images || finalResult.images.length === 0) {
      throw new Error('No images generated')
    }

    const imageUrl = finalResult.images[0].url
    console.log('Successfully generated image:', imageUrl)

    // Try to update the shot with the image URL, but don't fail if it doesn't work
    try {
      const { data: updatedShot, error } = await supabase
        .from('shots')
        .update({ 
          image_url: imageUrl,
          generation_status: 'completed'
        })
        .eq('id', shot_id)
        .select()
        .single()

      if (error) {
        console.log("Database update failed, but image generated successfully:", error)
      } else {
        console.log('Database updated successfully')
      }
    } catch (dbError) {
      console.log("Database update error, but image generated successfully:", dbError)
    }

    // Always return the image URL since generation was successful
    return NextResponse.json({ 
      image_url: imageUrl
    })
  } catch (error) {
    console.error("Generate shot image error:", error)
    // Log more details about the error
    if (error && typeof error === 'object' && 'body' in error) {
      console.error("Fal.ai error body:", error.body)
    }
    return NextResponse.json({ 
      error: "Failed to generate shot image", 
      details: error instanceof Error ? error.message : 'Unknown error',
      errorBody: error && typeof error === 'object' && 'body' in error ? error.body : undefined
    }, { status: 500 })
  }
}