import { createClient } from "@/utils/supabase/client"

export interface DatabaseImage {
  id: string
  session_id: string
  url: string
  prompt: string
  translated_prompt: string | null
  aspect_ratio: string
  width: number | null
  height: number | null
  generation_type: 'generate' | 'edit'
  model_id: string
  created_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

export interface DatabaseSession {
  id: string
  name: string
  user_id: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export class ImageDatabase {
  private supabase = createClient()

  async saveImage(imageData: {
    sessionId: string
    url: string
    prompt: string
    translatedPrompt?: string
    aspectRatio: string
    width?: number
    height?: number
    generationType: 'generate' | 'edit'
    modelId?: string
  }): Promise<DatabaseImage> {
    const { data, error } = await this.supabase
      .from('images')
      .insert({
        session_id: imageData.sessionId,
        url: imageData.url,
        prompt: imageData.prompt,
        translated_prompt: imageData.translatedPrompt || null,
        aspect_ratio: imageData.aspectRatio,
        width: imageData.width || null,
        height: imageData.height || null,
        generation_type: imageData.generationType,
        model_id: imageData.modelId || 'fal-ai/flux-pro',
        status: 'completed'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving image:', error)
      throw error
    }

    return data
  }

  async saveImages(images: Array<{
    sessionId: string
    url: string
    prompt: string
    translatedPrompt?: string
    aspectRatio: string
    width?: number
    height?: number
    generationType: 'generate' | 'edit'
    modelId?: string
  }>): Promise<DatabaseImage[]> {
    const { data, error } = await this.supabase
      .from('images')
      .insert(images.map(img => ({
        session_id: img.sessionId,
        url: img.url,
        prompt: img.prompt,
        translated_prompt: img.translatedPrompt || null,
        aspect_ratio: img.aspectRatio,
        width: img.width || null,
        height: img.height || null,
        generation_type: img.generationType,
        model_id: img.modelId || 'fal-ai/flux-pro',
        status: 'completed'
      })))
      .select()

    if (error) {
      console.error('Error saving images:', error)
      throw error
    }

    return data
  }

  async getSessionImages(sessionId: string): Promise<DatabaseImage[]> {
    const { data, error } = await this.supabase
      .from('images')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading session images:', error)
      throw error
    }

    return data || []
  }

  async getAllUserImages(): Promise<DatabaseImage[]> {
    const { data, error } = await this.supabase
      .from('images')
      .select(`
        *,
        sessions!inner (
          user_id
        )
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading user images:', error)
      throw error
    }

    return data || []
  }

  async createSession(name: string): Promise<DatabaseSession> {
    const { data: { user } } = await this.supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await this.supabase
      .from('sessions')
      .insert({
        name,
        user_id: user.id,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      throw error
    }

    return data
  }

  async getUserSessions(): Promise<DatabaseSession[]> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error loading sessions:', error)
      throw error
    }

    return data || []
  }

  async updateSession(sessionId: string, updates: Partial<Pick<DatabaseSession, 'name' | 'is_active'>>): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)

    if (error) {
      console.error('Error updating session:', error)
      throw error
    }
  }

  async deleteImage(imageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('images')
      .delete()
      .eq('id', imageId)

    if (error) {
      console.error('Error deleting image:', error)
      throw error
    }
  }
}

export const imageDatabase = new ImageDatabase()