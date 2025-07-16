import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

// Configure FAL client
fal.config({
  credentials: process.env.FAL_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, prompt, numImages = 1, aspectRatio } = await request.json()

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: 'Image URL and prompt are required' },
        { status: 400 }
      )
    }

    // Step 1: Always upload the image to FAL storage (required for Kontext)
    let falImageUrl: string
    
    console.log('Processing image URL type:', {
      isHttp: imageUrl.startsWith('http'),
      isData: imageUrl.startsWith('data:'),
      isBlob: imageUrl.startsWith('blob:'),
      isFal: imageUrl.includes('fal.media')
    })
    
    if (imageUrl.includes('fal.media')) {
      // Already a FAL URL, use directly
      console.log('Image already on FAL storage:', imageUrl)
      falImageUrl = imageUrl
    } else {
      // Need to upload to FAL storage
      console.log('Uploading image to FAL storage...')
      
      let blob: Blob
      let fileName = 'identity.jpg'
      
      if (imageUrl.startsWith('http')) {
        console.log('Fetching remote image:', imageUrl.substring(0, 100) + '...')
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`)
        }
        blob = await imageResponse.blob()
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
        const extension = contentType.split('/')[1] || 'jpg'
        fileName = `image.${extension}`
      } else if (imageUrl.startsWith('data:')) {
        console.log('Converting data URL to blob...')
        const response = await fetch(imageUrl)
        blob = await response.blob()
      } else if (imageUrl.startsWith('blob:')) {
        console.log('Fetching blob URL...')
        const response = await fetch(imageUrl)
        blob = await response.blob()
      } else {
        throw new Error('Unsupported image URL format: ' + imageUrl.substring(0, 50))
      }
      
      console.log('Blob details:', { 
        size: blob.size, 
        type: blob.type,
        validSize: blob.size > 0,
        validType: blob.type.startsWith('image/')
      })
      
      if (blob.size === 0) {
        throw new Error('Empty image blob')
      }
      
      if (!blob.type.startsWith('image/')) {
        throw new Error('Invalid image type: ' + blob.type)
      }
      
      // Create file and upload to FAL
      const imageFile = new File([blob], fileName, { type: blob.type })
      console.log('Uploading file to FAL:', { 
        name: imageFile.name, 
        size: imageFile.size, 
        type: imageFile.type 
      })
      
      falImageUrl = await fal.storage.upload(imageFile)
      console.log('Image successfully uploaded to FAL storage:', falImageUrl)
    }

    // Step 3: Use FAL.AI Kontext for image editing with the FAL-hosted image
    console.log('Starting Kontext editing with params:', {
      prompt: prompt.substring(0, 100) + '...',
      imageUrl: falImageUrl.substring(0, 50) + '...',
      numImages
    })
    
    // Ensure we have a valid FAL image URL
    if (!falImageUrl || !falImageUrl.includes('fal.media')) {
      throw new Error('Invalid FAL image URL: ' + falImageUrl)
    }
    
    // Use minimal required parameters for Kontext
    const input: any = {
      prompt: prompt,
      image_url: falImageUrl,
      num_images: numImages || 1,
    }
    
    // Add aspect ratio if provided
    if (aspectRatio) {
      input.aspect_ratio = aspectRatio
      console.log('Using aspect ratio:', aspectRatio)
    }
    
    console.log('Final input parameters:', {
      ...input,
      image_url: input.image_url.substring(0, 50) + '...'
    })
    
    const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log)
        }
      },
    })
    
    if (numImages === 1) {
      // Single image response for backward compatibility
      return NextResponse.json({
        editedImageUrl: result.data.images[0].url,
        message: 'Image edited successfully with Kontext'
      })
    } else {
      // Multiple images response
      return NextResponse.json({
        editedImageUrls: result.data.images.map((img: any) => img.url),
        message: `${result.data.images.length} images edited successfully with Kontext`
      })
    }

  } catch (error) {
    console.error('Error editing image:', error)
    
    // Log more details for debugging
    if (error instanceof Error && 'body' in error) {
      console.error('FAL API error body:', error.body)
    }
    
    return NextResponse.json(
      { error: 'Failed to edit image' },
      { status: 500 }
    )
  }
}