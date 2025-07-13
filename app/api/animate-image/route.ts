import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

// Configure FAL client
fal.config({
  credentials: process.env.FAL_KEY || "",
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, prompt } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing image URL" }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 })
    }

    console.log('Animating image with Kling:', { 
      imageUrl: imageUrl.substring(0, 50) + '...', 
      prompt: prompt?.substring(0, 100) + '...'
    })

    // Generate single video using Kling 2.1 Pro Image-to-Video
    console.log('Starting Kling video generation...')
    
    const result = await fal.subscribe("fal-ai/kling-video/v2.1/pro/image-to-video", {
      input: {
        prompt: prompt || "Bring this image to life with natural, realistic motion",
        image_url: imageUrl,
        duration: "5",
        negative_prompt: "blur, distort, and low quality",
        cfg_scale: 0.5,
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log('Kling progress:', update.status)
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.map((log) => log.message).forEach(console.log)
        }
      },
    })

    if (!result.data?.video?.url) {
      throw new Error("No video URL returned from Kling API")
    }

    // Return array with single video for consistency with frontend expectations
    const videoUrls = [result.data.video.url]

    console.log(`Generated ${videoUrls.length} videos successfully`)
    
    return NextResponse.json({ videoUrls })
  } catch (error) {
    console.error("Video generation error:", error)
    return NextResponse.json({ 
      error: "Failed to generate videos", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 