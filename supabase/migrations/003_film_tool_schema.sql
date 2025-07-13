-- Film Tool Database Schema
-- This extends the existing schema with film-specific tables

-- Create film_projects table
CREATE TABLE IF NOT EXISTS film_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    thumbnail_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create characters table
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES film_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    visual_description TEXT NOT NULL,
    image_url TEXT,
    personality_traits TEXT[], -- Array of traits
    backstory TEXT,
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
    character_count INTEGER,
    estimated_duration INTEGER, -- Duration in seconds
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
    title TEXT DEFAULT 'Storyboard',
    total_estimated_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_film_projects_user_id ON film_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_film_projects_status ON film_projects(status);
CREATE INDEX IF NOT EXISTS idx_film_projects_created_at ON film_projects(created_at DESC);

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

-- Add updated_at triggers for film tables
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

-- Enable RLS on film tables
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

-- RLS policies for characters (access through project ownership)
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

-- Create a function to automatically create thumbnails from first shot
CREATE OR REPLACE FUNCTION update_project_thumbnail()
RETURNS TRIGGER AS $$
BEGIN
    -- Update project thumbnail when first shot with image is created
    IF NEW.image_url IS NOT NULL AND NEW.sequence_number = 1 THEN
        UPDATE film_projects 
        SET thumbnail_url = NEW.image_url,
            updated_at = NOW()
        WHERE id = NEW.project_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_thumbnail_trigger
    AFTER INSERT OR UPDATE ON shots
    FOR EACH ROW
    EXECUTE FUNCTION update_project_thumbnail();

-- Create a function to automatically update script metadata
CREATE OR REPLACE FUNCTION update_script_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Count characters mentioned in script
    NEW.character_count := (
        SELECT COUNT(DISTINCT c.id)
        FROM characters c
        WHERE c.project_id = NEW.project_id
        AND LOWER(NEW.content) LIKE '%' || LOWER(c.name) || '%'
    );
    
    -- Estimate duration (rough: 250 words = 1 minute)
    NEW.estimated_duration := (
        LENGTH(NEW.content) - LENGTH(REPLACE(NEW.content, ' ', '')) + 1
    ) / 250 * 60;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_script_metadata_trigger
    BEFORE INSERT OR UPDATE ON scripts
    FOR EACH ROW
    EXECUTE FUNCTION update_script_metadata();