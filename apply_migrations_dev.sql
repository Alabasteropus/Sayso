-- Apply Film Tool Database Migrations (Development Version)
-- Run this in your Supabase SQL Editor
-- This version removes foreign key constraints for easier development

-- First, create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create film_projects table (without foreign key constraint for development)
CREATE TABLE IF NOT EXISTS film_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- Removed foreign key constraint for development
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'development', 'pre-production', 'production', 'post-production', 'completed')),
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create characters table
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES film_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    visual_description TEXT,
    personality_traits TEXT[],
    backstory TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scripts table
CREATE TABLE IF NOT EXISTS scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES film_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    character_count INTEGER DEFAULT 0,
    estimated_duration INTEGER, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shots table
CREATE TABLE IF NOT EXISTS shots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES film_projects(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    scene_description TEXT NOT NULL,
    camera_angle TEXT CHECK (camera_angle IN ('wide', 'medium', 'close-up', 'extreme-close-up', 'overhead', 'low-angle', 'high-angle')),
    camera_movement TEXT CHECK (camera_movement IN ('static', 'pan', 'tilt', 'zoom', 'dolly', 'handheld')),
    duration_seconds INTEGER,
    notes TEXT,
    characters_in_shot TEXT[], -- Array of character IDs
    image_url TEXT,
    video_url TEXT,
    generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storyboards table
CREATE TABLE IF NOT EXISTS storyboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES film_projects(id) ON DELETE CASCADE,
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    shot_sequence UUID[], -- Array of shot IDs in order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_film_projects_user_id ON film_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_film_projects_status ON film_projects(status);

CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);

CREATE INDEX IF NOT EXISTS idx_scripts_project_id ON scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_scripts_version ON scripts(project_id, version);

CREATE INDEX IF NOT EXISTS idx_shots_script_id ON shots(script_id);
CREATE INDEX IF NOT EXISTS idx_shots_project_id ON shots(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_sequence ON shots(script_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_shots_generation_status ON shots(generation_status);

CREATE INDEX IF NOT EXISTS idx_storyboards_project_id ON storyboards(project_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_script_id ON storyboards(script_id);

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_film_projects_updated_at ON film_projects;
CREATE TRIGGER update_film_projects_updated_at BEFORE UPDATE ON film_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_characters_updated_at ON characters;
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scripts_updated_at ON scripts;
CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON scripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shots_updated_at ON shots;
CREATE TRIGGER update_shots_updated_at BEFORE UPDATE ON shots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_storyboards_updated_at ON storyboards;
CREATE TRIGGER update_storyboards_updated_at BEFORE UPDATE ON storyboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for development (much simpler)
ALTER TABLE film_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE characters DISABLE ROW LEVEL SECURITY;
ALTER TABLE scripts DISABLE ROW LEVEL SECURITY;
ALTER TABLE shots DISABLE ROW LEVEL SECURITY;
ALTER TABLE storyboards DISABLE ROW LEVEL SECURITY;