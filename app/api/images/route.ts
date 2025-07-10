import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const generationType = searchParams.get('generation_type')
    const modelId = searchParams.get('model_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('images')
      .select(`
        *,
        session:sessions(id, name, user_id),
        parent_image:images!parent_image_id(id, url, prompt)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by session if provided
    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    // Filter by generation type if provided
    if (generationType) {
      query = query.eq('generation_type', generationType)
    }

    // Filter by model if provided
    if (modelId) {
      query = query.eq('model_id', modelId)
    }

    // Only get images from user's sessions
    const { data: images, error } = await query

    if (error) {
      console.error('Error fetching images:', error)
      return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 })
    }

    // Filter to only include images from user's sessions
    const userImages = images?.filter(image => image.session?.user_id === user.id) || []

    return NextResponse.json({ images: userImages })
  } catch (error) {
    console.error('Images API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const {
      session_id,
      url,
      prompt,
      translated_prompt,
      model_id,
      generation_type,
      parent_image_id,
      aspect_ratio,
      seed,
      safety_tolerance,
      output_format,
      guidance_scale,
      generation_time_ms,
      width,
      height,
      file_size,
      mime_type,
      file_name
    } = await request.json()

    // Verify the session belongs to the user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', session_id)
      .single()

    if (sessionError || !session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 })
    }

    // Create the image record
    const { data: image, error } = await supabase
      .from('images')
      .insert([
        {
          session_id,
          url,
          prompt,
          translated_prompt,
          model_id: model_id || 'black-forest-labs/flux-1.1-pro',
          generation_type: generation_type || 'generate',
          parent_image_id,
          aspect_ratio: aspect_ratio || '1:1',
          seed,
          safety_tolerance: safety_tolerance || 2,
          output_format: output_format || 'jpg',
          guidance_scale,
          generation_time_ms,
          width,
          height,
          file_size,
          mime_type: mime_type || 'image/jpeg',
          file_name,
          status: 'completed'
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating image:', error)
      return NextResponse.json({ error: "Failed to create image" }, { status: 500 })
    }

    return NextResponse.json({ image })
  } catch (error) {
    console.error('Images API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}