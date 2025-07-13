import { fal } from "@fal-ai/client"
import { createClient } from "@/utils/supabase/client"
import { Character, Shot, CreateCharacterRequest, CreateShotRequest, CharacterConsistentImageRequest } from './types'
import { buildConsistencyPrompt } from './film-utils'

const FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) {
  console.error("FAL_KEY env-var missing!")
}

fal.config({
  credentials: FAL_KEY,
})

const supabase = createClient()

export async function createCharacterImage(request: CreateCharacterRequest): Promise<string> {
  try {
    console.log('Generating character image for:', request.name)

    // Create detailed prompt for character consistency
    const characterPrompt = `Professional character portrait: ${request.visual_description}. 
Character name: ${request.name}. 
Character description: ${request.description}.
${request.personality_traits ? `Personality: ${request.personality_traits.join(', ')}.` : ''}
${request.backstory ? `Background: ${request.backstory}` : ''}

High quality portrait, cinematic lighting, professional photography, character study, consistent appearance for film production.`

    const result = await fal.queue.submit("fal-ai/flux-pro/text-to-image", {
      input: {
        prompt: characterPrompt,
        aspect_ratio: "3:4", // Portrait format for characters
        output_format: "jpeg",
        safety_tolerance: 2,
        num_images: 1,
        seed: Math.floor(Math.random() * 1000000),
      },
    })

    // Poll for completion
    const finalResult = await fal.queue.result("fal-ai/flux-pro/text-to-image", {
      requestId: result.request_id,
    })

    if (finalResult.images && finalResult.images.length > 0) {
      const falImageUrl = finalResult.images[0].url
      console.log('Character image generated from FAL:', falImageUrl)

      // Download and store in Supabase storage
      const imageResponse = await fetch(falImageUrl)
      const imageBlob = await imageResponse.blob()
      
      // Generate storage path
      const { data: pathData, error: pathError } = await supabase
        .rpc('generate_character_image_path', {
          project_id: request.project_id,
          character_name: request.name
        })

      if (pathError) {
        console.error('Error generating storage path:', pathError)
        return falImageUrl // Fallback to direct FAL URL
      }

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('character-images')
        .upload(pathData, imageBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        })

      if (uploadError) {
        console.error('Error uploading to storage:', uploadError)
        return falImageUrl // Fallback to direct FAL URL
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('character-images')
        .getPublicUrl(uploadData.path)

      console.log('Character image stored in Supabase:', urlData.publicUrl)
      return urlData.publicUrl
    }

    throw new Error('No images generated')
  } catch (error) {
    console.error('Character image generation error:', error)
    throw new Error(`Failed to generate character image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function createCharacterWithImage(request: CreateCharacterRequest): Promise<Character> {
  try {
    // Generate character image first
    const imageUrl = await createCharacterImage(request)

    // Save character to database
    const { data, error } = await supabase
      .from('characters')
      .insert({
        project_id: request.project_id,
        name: request.name,
        description: request.description,
        visual_description: request.visual_description,
        image_url: imageUrl,
        personality_traits: request.personality_traits || [],
        backstory: request.backstory,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error creating character:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    return data as Character
  } catch (error) {
    console.error('Create character error:', error)
    throw error
  }
}

export async function createShotImage(
  request: CreateShotRequest,
  characters: Character[]
): Promise<string> {
  try {
    console.log('Generating shot image for:', request.scene_description)

    // Get characters in this shot
    const shotCharacters = characters.filter(c => 
      request.characters_in_shot.includes(c.id)
    )

    // Build consistency prompt with character references
    const shotPrompt = buildConsistencyPrompt(
      {
        id: '', // Temporary
        script_id: request.script_id,
        project_id: request.project_id,
        sequence_number: 1,
        scene_description: request.scene_description,
        camera_angle: request.camera_angle,
        camera_movement: request.camera_movement,
        duration_seconds: request.duration_seconds,
        characters_in_shot: request.characters_in_shot,
        generation_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      shotCharacters,
      `Shot for film production.`
    )

    // If we have character reference images, use image-to-image for consistency
    const hasCharacterImages = shotCharacters.some(c => c.image_url)
    
    let result;
    
    if (hasCharacterImages && request.reference_character_images) {
      // Use image-to-image for character consistency
      result = await fal.queue.submit("fal-ai/flux-pro/image-to-image", {
        input: {
          prompt: shotPrompt,
          image_url: request.reference_character_images[0], // Primary character reference
          strength: 0.7, // Allow modification while maintaining character likeness
          aspect_ratio: "16:9", // Cinematic aspect ratio
          output_format: "jpeg",
          safety_tolerance: 2,
          num_images: 1,
          seed: Math.floor(Math.random() * 1000000),
        },
      })
    } else {
      // Use text-to-image for new shots
      result = await fal.queue.submit("fal-ai/flux-pro/text-to-image", {
        input: {
          prompt: shotPrompt,
          aspect_ratio: "16:9", // Cinematic aspect ratio
          output_format: "jpeg",
          safety_tolerance: 2,
          num_images: 1,
          seed: Math.floor(Math.random() * 1000000),
        },
      })
    }

    // Poll for completion
    const finalResult = await fal.queue.result(
      hasCharacterImages && request.reference_character_images ? 
        "fal-ai/flux-pro/image-to-image" : 
        "fal-ai/flux-pro/text-to-image",
      { requestId: result.request_id }
    )

    if (finalResult.images && finalResult.images.length > 0) {
      const falImageUrl = finalResult.images[0].url
      console.log('Shot image generated from FAL:', falImageUrl)

      // Download and store in Supabase storage
      try {
        const imageResponse = await fetch(falImageUrl)
        const imageBlob = await imageResponse.blob()
        
        // Generate storage path
        const { data: pathData, error: pathError } = await supabase
          .rpc('generate_shot_image_path', {
            project_id: request.project_id,
            script_id: request.script_id,
            sequence_number: 1 // Will be updated with actual sequence number
          })

        if (!pathError && pathData) {
          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('shot-images')
            .upload(pathData, imageBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600'
            })

          if (!uploadError && uploadData) {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('shot-images')
              .getPublicUrl(uploadData.path)

            console.log('Shot image stored in Supabase:', urlData.publicUrl)
            return urlData.publicUrl
          }
        }
      } catch (storageError) {
        console.error('Storage error, using FAL URL directly:', storageError)
      }

      // Fallback to direct FAL URL if storage fails
      return falImageUrl
    }

    throw new Error('No images generated for shot')
  } catch (error) {
    console.error('Shot image generation error:', error)
    throw new Error(`Failed to generate shot image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function createShotWithImage(
  request: CreateShotRequest,
  characters: Character[]
): Promise<Shot> {
  try {
    // Create shot in database first
    const { data: shotData, error: shotError } = await supabase
      .from('shots')
      .insert({
        script_id: request.script_id,
        project_id: request.project_id,
        scene_description: request.scene_description,
        camera_angle: request.camera_angle,
        camera_movement: request.camera_movement,
        duration_seconds: request.duration_seconds || 5,
        characters_in_shot: request.characters_in_shot,
        generation_status: 'generating',
        sequence_number: await getNextSequenceNumber(request.script_id),
      })
      .select()
      .single()

    if (shotError) {
      console.error('Database error creating shot:', shotError)
      throw new Error(`Database error: ${shotError.message}`)
    }

    // Generate image
    try {
      const imageUrl = await createShotImage(request, characters)

      // Update shot with image URL
      const { data: updatedShot, error: updateError } = await supabase
        .from('shots')
        .update({
          image_url: imageUrl,
          generation_status: 'completed',
        })
        .eq('id', shotData.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating shot with image:', updateError)
        throw new Error(`Update error: ${updateError.message}`)
      }

      return updatedShot as Shot
    } catch (imageError) {
      // Update shot status to failed if image generation fails
      await supabase
        .from('shots')
        .update({ generation_status: 'failed' })
        .eq('id', shotData.id)
      
      throw imageError
    }
  } catch (error) {
    console.error('Create shot error:', error)
    throw error
  }
}

export async function generateCharacterConsistentImage(
  request: CharacterConsistentImageRequest
): Promise<string> {
  try {
    console.log('Generating character-consistent image')

    // Build prompt with character references
    let enhancedPrompt = request.prompt
    
    if (request.character_references && request.character_references.length > 0) {
      const characterContext = request.character_references
        .map(ref => `Character reference: ${ref.character_id}`)
        .join('. ')
      
      enhancedPrompt = `${request.prompt}. ${characterContext}. ${request.scene_context || ''}`
    }

    // Use the primary character image as reference if available
    const primaryReference = request.character_references?.[0]?.reference_image_url

    let result;
    
    if (primaryReference) {
      // Use image-to-image for consistency
      result = await fal.queue.submit("fal-ai/flux-pro/image-to-image", {
        input: {
          prompt: enhancedPrompt,
          image_url: primaryReference,
          strength: 0.6, // Maintain character features while allowing scene changes
          aspect_ratio: request.aspect_ratio || "16:9",
          output_format: "jpeg",
          safety_tolerance: 2,
          num_images: 1,
          seed: Math.floor(Math.random() * 1000000),
        },
      })

      const finalResult = await fal.queue.result("fal-ai/flux-pro/image-to-image", {
        requestId: result.request_id,
      })

      if (finalResult.images && finalResult.images.length > 0) {
        return finalResult.images[0].url
      }
    } else {
      // Fallback to text-to-image
      result = await fal.queue.submit("fal-ai/flux-pro/text-to-image", {
        input: {
          prompt: enhancedPrompt,
          aspect_ratio: request.aspect_ratio || "16:9",
          output_format: "jpeg",
          safety_tolerance: 2,
          num_images: 1,
          seed: Math.floor(Math.random() * 1000000),
        },
      })

      const finalResult = await fal.queue.result("fal-ai/flux-pro/text-to-image", {
        requestId: result.request_id,
      })

      if (finalResult.images && finalResult.images.length > 0) {
        return finalResult.images[0].url
      }
    }

    throw new Error('No images generated')
  } catch (error) {
    console.error('Character consistent image generation error:', error)
    throw new Error(`Failed to generate character-consistent image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Utility function to get next sequence number for shots
async function getNextSequenceNumber(scriptId: string): Promise<number> {
  const { data, error } = await supabase
    .from('shots')
    .select('sequence_number')
    .eq('script_id', scriptId)
    .order('sequence_number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error getting sequence number:', error)
    return 1
  }

  return data && data.length > 0 ? data[0].sequence_number + 1 : 1
}

// Batch shot generation for complete storyboards
export async function generateStoryboardImages(
  scriptId: string,
  projectId: string,
  shots: { scene_description: string; characters_in_shot: string[]; camera_angle?: Shot['camera_angle'] }[],
  characters: Character[]
): Promise<Shot[]> {
  const generatedShots: Shot[] = []

  for (let i = 0; i < shots.length; i++) {
    const shotRequest: CreateShotRequest = {
      script_id: scriptId,
      project_id: projectId,
      scene_description: shots[i].scene_description,
      characters_in_shot: shots[i].characters_in_shot,
      camera_angle: shots[i].camera_angle || 'medium',
      reference_character_images: characters
        .filter(c => shots[i].characters_in_shot.includes(c.id))
        .map(c => c.image_url)
        .filter(Boolean) as string[],
    }

    try {
      const shot = await createShotWithImage(shotRequest, characters)
      generatedShots.push(shot)
    } catch (error) {
      console.error(`Failed to generate shot ${i + 1}:`, error)
      // Continue with next shot even if one fails
    }
  }

  return generatedShots
}

// Simplified shot image generation for individual shots
export async function generateShotImage(options: {
  description: string
  camera_angle?: string
  camera_movement?: string
  characters?: Character[]
  style?: string
}): Promise<string> {
  try {
    console.log('Generating shot image for description:', options.description)

    // Clean up the description to make it image-generation friendly
    let cleanDescription = options.description
      // Remove script formatting
      .replace(/^#+\s*/g, '') // Remove markdown headers
      .replace(/FADE IN:?/gi, '')
      .replace(/FADE OUT:?/gi, '')
      .replace(/CUT TO:?/gi, '')
      .replace(/INT\.|EXT\./gi, '')
      .replace(/- DAY|DAY|-/gi, 'during the day')
      .replace(/- NIGHT|NIGHT|-/gi, 'at night')
      .replace(/- MORNING|MORNING|-/gi, 'in the morning')
      .replace(/- EVENING|EVENING|-/gi, 'in the evening')
      // Remove character names in caps followed by dialogue
      .replace(/\b[A-Z]{2,}\b\s*$/g, '')
      // Clean up extra whitespace and dashes
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // If the description is too short or empty after cleaning, provide a fallback
    if (cleanDescription.length < 10) {
      cleanDescription = `A cinematic ${options.camera_angle || 'medium'} shot of a dramatic scene`
    }

    // Build cinematic prompt
    let prompt = `${cleanDescription}.`
    
    // Add camera details
    if (options.camera_angle) {
      prompt += ` ${options.camera_angle} shot.`
    }
    
    if (options.camera_movement) {
      prompt += ` Camera movement: ${options.camera_movement}.`
    }
    
    // Add character context if available
    if (options.characters && options.characters.length > 0) {
      const characterDesc = options.characters
        .map(c => `${c.name}: ${c.visual_description}`)
        .join('. ')
      prompt += ` Characters: ${characterDesc}.`
    }
    
    // Add style
    prompt += ` Cinematic ${options.style || 'dramatic'} lighting, professional film production quality, high detail.`

    console.log('Cleaned prompt for image generation:', prompt)

    const { request_id } = await fal.queue.submit("fal-ai/flux-pro/kontext/text-to-image", {
      input: {
        prompt: prompt,
        aspect_ratio: "16:9", // Cinematic aspect ratio
        output_format: "jpeg",
        safety_tolerance: 2,
        num_images: 1, // Just 1 image for shots
        seed: Math.floor(Math.random() * 1000000),
      },
    })

    // Poll for completion
    const finalResult = await fal.queue.result("fal-ai/flux-pro/kontext/text-to-image", {
      requestId: request_id,
    })

    if (finalResult.images && finalResult.images.length > 0) {
      const falImageUrl = finalResult.images[0].url
      console.log('Shot image generated from FAL:', falImageUrl)
      
      // For now, return the direct FAL URL
      // TODO: Store in Supabase storage if needed
      return falImageUrl
    }

    throw new Error('No images generated for shot')
  } catch (error) {
    console.error('Shot image generation error:', error)
    throw new Error(`Failed to generate shot image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}