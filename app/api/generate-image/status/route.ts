import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

// Configure FAL
const FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) {
  console.error("FAL_KEY env-var missing!")
}

fal.config({
  credentials: FAL_KEY,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 })
    }

    console.log('Checking FLUX generation status for:', requestId)
    
    // Check the status first
    const status = await fal.queue.status("fal-ai/flux-pro/kontext/text-to-image", {
      requestId: requestId,
      logs: true,
    })

    console.log('FLUX status:', status.status)

    if (status.status === "COMPLETED") {
      // Get the result
      const result = await fal.queue.result("fal-ai/flux-pro/kontext/text-to-image", {
        requestId: requestId
      })

      console.log('FLUX result:', result.data)

      // Return full image objects with dimensions
      const generatedImages = result.data.images || []

      if (generatedImages.length === 0) {
        console.error("No images returned from FLUX")
        return NextResponse.json({ 
          status: "ERROR", 
          error: "No images returned from FLUX" 
        }, { status: 500 })
      }

      console.log(`Retrieved ${generatedImages.length} generated images`)
      
      return NextResponse.json({ 
        status: "COMPLETED", 
        generatedImageUrls: generatedImages, // Now contains full objects with width/height
        requestId 
      })
    } else if (String(status.status) === "FAILED") {
      return NextResponse.json({ 
        status: "FAILED", 
        error: "Image generation failed",
        requestId 
      }, { status: 500 })
    } else {
      // Still in progress (IN_PROGRESS, IN_QUEUE, etc.)
      return NextResponse.json({ 
        status: String(status.status), 
        requestId 
      })
    }
  } catch (error) {
    console.error("Status check error:", error)
    return NextResponse.json({ error: "Failed to check generation status" }, { status: 500 })
  }
} 