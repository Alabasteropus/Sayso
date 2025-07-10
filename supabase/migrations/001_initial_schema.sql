-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Untitled Session',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session metadata
    aspect_ratio TEXT DEFAULT '1:1',
    original_image_url TEXT,
    original_image_description TEXT,
    current_image_description TEXT,
    
    -- Session state
    is_active BOOLEAN DEFAULT false,
    
    -- Indexes
    CONSTRAINT sessions_aspect_ratio_check CHECK (aspect_ratio IN ('1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21', '2:1', '1:2'))
);

-- Create images table
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Image metadata
    url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'image/jpeg',
    width INTEGER,
    height INTEGER,
    aspect_ratio TEXT DEFAULT '1:1',
    
    -- Generation metadata
    prompt TEXT NOT NULL,
    translated_prompt TEXT,
    model_id TEXT NOT NULL DEFAULT 'black-forest-labs/flux-kontext-pro',
    generation_type TEXT NOT NULL DEFAULT 'generate', -- 'generate' or 'edit'
    
    -- Generation parameters
    seed INTEGER,
    safety_tolerance INTEGER DEFAULT 2,
    output_format TEXT DEFAULT 'jpg',
    guidance_scale NUMERIC(3,1),
    
    -- Relationships
    parent_image_id UUID REFERENCES images(id) ON DELETE SET NULL, -- For edits
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generation_time_ms INTEGER, -- How long it took to generate
    
    -- Status
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    -- Indexes
    CONSTRAINT images_generation_type_check CHECK (generation_type IN ('generate', 'edit')),
    CONSTRAINT images_aspect_ratio_check CHECK (aspect_ratio IN ('1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21', '2:1', '1:2'))
);

-- Create session_history table (for tracking navigation history within a session)
CREATE TABLE IF NOT EXISTS session_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    
    -- History metadata
    position INTEGER NOT NULL, -- 0 = original, 1 = first edit, etc.
    is_current BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one current position per session
    CONSTRAINT unique_current_per_session UNIQUE (session_id, is_current) DEFERRABLE INITIALLY DEFERRED
);

-- Create user_preferences table (for storing user settings)
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- UI preferences
    default_aspect_ratio TEXT DEFAULT '1:1',
    auto_save_sessions BOOLEAN DEFAULT true,
    max_history_length INTEGER DEFAULT 50,
    
    -- AI preferences
    preferred_model TEXT DEFAULT 'black-forest-labs/flux-kontext-pro',
    default_safety_tolerance INTEGER DEFAULT 2,
    enable_auto_translate BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_images_session_id ON images(session_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_parent_image_id ON images(parent_image_id);
CREATE INDEX IF NOT EXISTS idx_images_generation_type ON images(generation_type);
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
CREATE INDEX IF NOT EXISTS idx_images_model_id ON images(model_id);

CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_position ON session_history(session_id, position);
CREATE INDEX IF NOT EXISTS idx_session_history_is_current ON session_history(session_id, is_current) WHERE is_current = true;

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS (Row Level Security) policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can view their own sessions" ON sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Images policies (access through session ownership)
CREATE POLICY "Users can view images from their sessions" ON images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = images.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert images to their sessions" ON images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = images.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update images in their sessions" ON images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = images.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete images from their sessions" ON images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = images.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- Session history policies
CREATE POLICY "Users can view session history for their sessions" ON session_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = session_history.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert session history for their sessions" ON session_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = session_history.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update session history for their sessions" ON session_history
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = session_history.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete session history for their sessions" ON session_history
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE sessions.id = session_history.session_id 
            AND sessions.user_id = auth.uid()
        )
    );

-- User preferences policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);