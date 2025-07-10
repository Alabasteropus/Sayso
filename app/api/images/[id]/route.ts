import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get image with session info
    const { data: image, error } = await supabase
      .from('images')
      .select(`
        *,
        session:sessions(id, name, user_id),
        parent_image:images!parent_image_id(id, url, prompt),
        child_images:images!parent_image_id(id, url, prompt, created_at)
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching image:', error)
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Check if user owns the session
    if (image.session?.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json({ image })
  } catch (error) {
    console.error('Image API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const updates = await request.json()

    // Get image with session info first
    const { data: existingImage, error: fetchError } = await supabase
      .from('images')
      .select(`
        *,
        session:sessions(user_id)
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !existingImage) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Check if user owns the session
    if (existingImage.session?.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update image
    const { data: image, error } = await supabase
      .from('images')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating image:', error)
      return NextResponse.json({ error: "Failed to update image" }, { status: 500 })
    }

    return NextResponse.json({ image })
  } catch (error) {
    console.error('Image API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get image with session info first
    const { data: existingImage, error: fetchError } = await supabase
      .from('images')
      .select(`
        *,
        session:sessions(user_id)
      `)
      .eq('id', params.id)
      .single()

    if (fetchError || !existingImage) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Check if user owns the session
    if (existingImage.session?.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Delete image
    const { error } = await supabase
      .from('images')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting image:', error)
      return NextResponse.json({ error: "Failed to delete image" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Image API error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}