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
    
    const { imageUrl, prompt, aspectRatio } = await request.json()

    if (!imageUrl || !prompt) {
      return NextResponse.json({ error: "Missing image URL or prompt" }, { status: 400 })
    }

    console.log('Attempting image edit with Replicate FLUX:', { 
      imageUrl: imageUrl.substring(0, 50) + '...', 
      prompt,
      aspectRatio: aspectRatio || "match_input_image",
      receivedAspectRatio: aspectRatio
    })
    
    // Handle base64 data URL for Replicate
    let inputImage: any = imageUrl
    
    if (imageUrl.startsWith('data:image/')) {
      // Convert base64 data URL to Buffer for Replicate
      const base64Data = imageUrl.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      inputImage = buffer
    }
    
    // Use Replicate FLUX Kontext Pro model for image editing
    const output = await replicate.run(
      "black-forest-labs/flux-kontext-pro",
      {
        input: {
          input_image: inputImage,
          prompt: prompt,
          aspect_ratio: aspectRatio || "match_input_image",
          output_format: "jpg",
          safety_tolerance: 2,
          seed: Math.floor(Math.random() * 1000000),
          prompt_upsampling: false, // Can be enabled for better prompt following
        }
      }
    )

    // Handle ReadableStream response from Replicate
    let editedImageUrl: string
    
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
      editedImageUrl = `data:image/jpeg;base64,${base64String}`
    } else {
      editedImageUrl = output as string
    }

    if (!editedImageUrl) {
      console.error("No edited image returned from Replicate FLUX:", output)
      throw new Error("No edited image returned from Replicate FLUX")
    }

    console.log("Image edited successfully:", editedImageUrl)
    
    // Store the edited image in Supabase Storage and database
    try {
      // Get user for session validation
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // If it's a base64 data URL, upload to Supabase Storage
        let finalImageUrl = editedImageUrl
        
        if (editedImageUrl.startsWith('data:image/')) {
          // Convert to blob and upload
          const base64Data = editedImageUrl.split(',')[1]
          const mimeType = editedImageUrl.split(';')[0].split(':')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          
          const timestamp = Date.now()
          const fileName = `${user.id}/edited/${timestamp}.jpg`
          
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
    
    return NextResponse.json({ editedImageUrl })
  } catch (error) {
    console.error("Image editing error:", error)
    return NextResponse.json({ error: "Failed to edit image" }, { status: 500 })
  }
}
