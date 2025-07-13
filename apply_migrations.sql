-- Apply Film Tool Database Migrations
-- Run this in your Supabase SQL Editor

-- First, create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create film_projects table
CREATE TABLE IF NOT EXISTS film_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE TRIGGER update_film_projects_updated_at BEFORE UPDATE ON film_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON scripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shots_updated_at BEFORE UPDATE ON shots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_storyboards_updated_at BEFORE UPDATE ON storyboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE film_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyboards ENABLE ROW LEVEL SECURITY;

-- RLS policies for film_projects
CREATE POLICY "Users can view their own film projects" ON film_projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own film projects" ON film_projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own film projects" ON film_projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own film projects" ON film_projects
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for characters
CREATE POLICY "Users can view characters from their projects" ON characters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = characters.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert characters to their projects" ON characters
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = characters.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update characters in their projects" ON characters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = characters.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete characters from their projects" ON characters
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = characters.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

-- RLS policies for scripts
CREATE POLICY "Users can view scripts from their projects" ON scripts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = scripts.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert scripts to their projects" ON scripts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = scripts.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update scripts in their projects" ON scripts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = scripts.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete scripts from their projects" ON scripts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = scripts.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

-- RLS policies for shots
CREATE POLICY "Users can view shots from their projects" ON shots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = shots.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert shots to their projects" ON shots
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = shots.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update shots in their projects" ON shots
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = shots.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete shots from their projects" ON shots
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = shots.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

-- RLS policies for storyboards
CREATE POLICY "Users can view storyboards from their projects" ON storyboards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = storyboards.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert storyboards to their projects" ON storyboards
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = storyboards.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update storyboards in their projects" ON storyboards
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = storyboards.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete storyboards from their projects" ON storyboards
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = storyboards.project_id 
            AND film_projects.user_id = auth.uid()
        )
    );

-- Storage setup for film assets
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('character-images', 'character-images', true),
    ('shot-images', 'shot-images', true),
    ('film-exports', 'film-exports', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload character images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'character-images' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Anyone can view character images" ON storage.objects
    FOR SELECT USING (bucket_id = 'character-images');

CREATE POLICY "Users can upload shot images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'shot-images' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Anyone can view shot images" ON storage.objects
    FOR SELECT USING (bucket_id = 'shot-images');

-- Helper functions for storage paths
CREATE OR REPLACE FUNCTION generate_character_image_path(project_id UUID, character_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN auth.uid()::text || '/' || project_id::text || '/characters/' || 
           regexp_replace(lower(character_name), '[^a-z0-9_-]', '_', 'g') || '_' || 
           extract(epoch from now())::bigint || '.jpg';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_shot_image_path(project_id UUID, script_id UUID, sequence_number INTEGER)
RETURNS TEXT AS $$
BEGIN
    RETURN auth.uid()::text || '/' || project_id::text || '/shots/' || script_id::text || 
           '/shot_' || sequence_number || '_' || extract(epoch from now())::bigint || '.jpg';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;