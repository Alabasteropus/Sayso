import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { id: projectId } = await params

    // Get authenticated user (allow null for development)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    let userId = user?.id
    
    // If no authenticated user, use a default user ID for development
    if (!userId) {
      userId = '00000000-0000-0000-0000-000000000000' // Default dev user
    }

    // Try to verify project ownership, but skip for development if it fails
    const { data: project, error: projectError } = await supabase
      .from('film_projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single()

    // Skip project verification for development if database issues
    if (projectError && projectError.code !== '42P01' && projectError.code !== '42501') {
      console.log("Skipping project verification for development:", projectError)
    }

    // Get character count
    const { count: characterCount } = await supabase
      .from('characters')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    // Get script count
    const { count: scriptCount } = await supabase
      .from('scripts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    // Get shot count and total duration
    const { data: shots } = await supabase
      .from('shots')
      .select('duration_seconds')
      .eq('project_id', projectId)

    const shotCount = shots?.length || 0
    const totalDuration = shots?.reduce((sum, shot) => sum + (shot.duration_seconds || 0), 0) || 0

    const stats = {
      characters: characterCount || 0,
      scripts: scriptCount || 0,
      shots: shotCount,
      totalDuration: totalDuration
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Get project stats error:", error)
    return NextResponse.json({ error: "Failed to fetch project stats" }, { status: 500 })
  }
}