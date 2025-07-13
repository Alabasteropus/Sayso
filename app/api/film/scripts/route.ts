import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const { data: scripts, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ scripts })
  } catch (error) {
    console.error("Get scripts error:", error)
    return NextResponse.json({ error: "Failed to fetch scripts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { project_id, title, content } = await request.json()

    if (!project_id || !title?.trim() || !content?.trim()) {
      return NextResponse.json({ 
        error: "Project ID, title, and content are required" 
      }, { status: 400 })
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('film_projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const { data: script, error } = await supabase
      .from('scripts')
      .insert({
        project_id,
        title: title.trim(),
        content: content.trim(),
        version: 1,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ script })
  } catch (error) {
    console.error("Create script error:", error)
    return NextResponse.json({ error: "Failed to create script" }, { status: 500 })
  }
}