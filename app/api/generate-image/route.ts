import { type NextRequest, NextResponse } from "next/server"
import Replicate from "replicate"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    const { prompt, aspectRatio } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 })
    }

    console.log('Generating image with Replicate FLUX:', { 
      prompt: prompt.substring(0, 100) + '...', 
      aspectRatio: aspectRatio || "1:1",
      receivedAspectRatio: aspectRatio
    })
    
    // Use Replicate FLUX Kontext Pro model for text-to-image
    const output = await replicate.run(
      "black-forest-labs/flux-kontext-pro",
      {
        input: {
          prompt: prompt,
          aspect_ratio: aspectRatio || "1:1",
          output_format: "jpg",
          safety_tolerance: 2,
          seed: Math.floor(Math.random() * 1000000),
          prompt_upsampling: false, // Can be enabled for better prompt following
        }
      }
    )

    // Handle ReadableStream response from Replicate
    let generatedImageUrl: string
    
    if (output instanceof ReadableStream) {
      // Convert ReadableStream to binary data, then to base64
      const reader = output.getReader()
      const chunks: Uint8Array[] = []
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      
      // Combine all chunks into a single Uint8Array
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const combinedArray = new Uint8Array(totalLength)
      let offset = 0
      
      for (const chunk of chunks) {
        combinedArray.set(chunk, offset)
        offset += chunk.length
      }
      
      // Convert to base64 and create data URL
      const base64String = Buffer.from(combinedArray).toString('base64')
      generatedImageUrl = `data:image/jpeg;base64,${base64String}`
    } else {
      generatedImageUrl = output as string
    }

    if (!generatedImageUrl) {
      console.error("No image returned from Replicate FLUX:", output)
      throw new Error("No image returned from Replicate FLUX")
    }

    console.log("Image generated successfully:", generatedImageUrl)
    
    // Store the generated image in Supabase Storage and database
    try {
      // Get user for session validation
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // If it's a base64 data URL, upload to Supabase Storage
        let finalImageUrl = generatedImageUrl
        
        if (generatedImageUrl.startsWith('data:image/')) {
          // Convert to blob and upload
          const base64Data = generatedImageUrl.split(',')[1]
          const mimeType = generatedImageUrl.split(';')[0].split(':')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          
          const timestamp = Date.now()
          const fileName = `${user.id}/generated/${timestamp}.jpg`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('images')
            .upload(fileName, buffer, {
              contentType: mimeType,
              cacheControl: '3600'
            })
          
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('images')
              .getPublicUrl(fileName)
            
            finalImageUrl = publicUrl
          }
        }
        
        // Store in database (if we have session info)
        // Note: We'd need session_id to be passed in the request to store in database
        console.log('Image ready for database storage:', finalImageUrl)
      }
    } catch (error) {
      console.error('Failed to store in Supabase:', error)
      // Continue with original URL if storage fails
    }
    
    return NextResponse.json({ generatedImageUrl })
  } catch (error) {
    console.error("Image generation error:", error)
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 })
  }
}