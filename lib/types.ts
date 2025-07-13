// Film Tool Types - extending existing GeneratedImage and Session types

export interface FilmProject {
  id: string
  user_id: string
  title: string
  description?: string
  genre?: string
  created_at: string
  updated_at: string
  thumbnail_url?: string
  status: 'draft' | 'in_progress' | 'completed'
}

export interface Character {
  id: string
  project_id: string
  name: string
  description: string
  visual_description: string
  image_url?: string
  personality_traits?: string[]
  backstory?: string
  created_at: string
  updated_at: string
}

export interface Script {
  id: string
  project_id: string
  title: string
  content: string
  version: number
  created_at: string
  updated_at: string
  character_count?: number
  estimated_duration?: number
}

export interface Shot {
  id: string
  script_id: string
  project_id: string
  sequence_number: number
  scene_description: string
  camera_angle?: 'wide' | 'medium' | 'close-up' | 'extreme-close-up' | 'overhead' | 'low-angle' | 'high-angle'
  camera_movement?: 'static' | 'pan' | 'tilt' | 'zoom' | 'dolly' | 'handheld'
  duration_seconds?: number
  notes?: string
  characters_in_shot: string[] // Array of character IDs
  image_url?: string
  video_url?: string
  created_at: string
  updated_at: string
  generation_status: 'pending' | 'generating' | 'completed' | 'failed'
}

export interface Storyboard {
  id: string
  project_id: string
  script_id: string
  shots: Shot[]
  created_at: string
  updated_at: string
  total_estimated_duration?: number
}

// AI Assistant Context for film projects
export interface FilmAssistantContext {
  project: FilmProject
  characters: Character[]
  scripts: Script[]
  shots: Shot[]
  currentTask?: 'character_creation' | 'script_writing' | 'shot_planning' | 'storyboard_review'
}

// API Response types
export interface CreateCharacterRequest {
  project_id: string
  name: string
  description: string
  visual_description: string
  personality_traits?: string[]
  backstory?: string
}

export interface CreateCharacterResponse {
  character: Character
  image_url?: string
}

export interface GenerateScriptRequest {
  project_id: string
  prompt: string
  characters?: Character[]
  genre?: string
  target_duration?: number
}

export interface GenerateScriptResponse {
  script: Script
  character_count: number
  estimated_duration: number
}

export interface CreateShotRequest {
  script_id: string
  project_id: string
  scene_description: string
  characters_in_shot: string[]
  camera_angle?: Shot['camera_angle']
  camera_movement?: Shot['camera_movement']
  duration_seconds?: number
  reference_character_images?: string[]
}

export interface CreateShotResponse {
  shot: Shot
  image_url?: string
}

export interface FilmAssistantRequest {
  project_id: string
  query: string
  context: FilmAssistantContext
}

export interface FilmAssistantResponse {
  response: string
  suggested_actions?: {
    type: 'create_character' | 'generate_script' | 'create_shot' | 'review_storyboard'
    description: string
    data?: any
  }[]
}

// Utility types for shot planning
export interface ShotPlanningOptions {
  script_content: string
  characters: Character[]
  target_shot_count?: number
  preferred_shot_types?: Shot['camera_angle'][]
  include_character_close_ups?: boolean
}

export interface BreakdownShot {
  sequence_number: number
  scene_description: string
  suggested_camera_angle: Shot['camera_angle']
  suggested_duration: number
  characters_mentioned: string[]
  dialogue_snippet?: string
}

// Extended types for existing image generation with character consistency
export interface CharacterConsistentImageRequest {
  prompt: string
  character_references: {
    character_id: string
    reference_image_url: string
  }[]
  aspect_ratio?: string
  scene_context?: string
}

// Film export types
export interface StoryboardExport {
  format: 'pdf' | 'video' | 'image_sequence'
  include_metadata: boolean
  include_script: boolean
  shots: Shot[]
}