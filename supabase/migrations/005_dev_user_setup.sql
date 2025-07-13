-- Create a default development user and adjust RLS for development
-- This allows the film tool to work without authentication during development

-- Insert a default development user (this will be the fallback user)
-- Note: This requires the auth schema, but we'll make the policies more permissive instead

-- Temporarily make RLS policies more permissive for development
-- You can remove these or make them more restrictive later

-- More permissive policies for film_projects (allow access if user_id matches OR is the default dev user)
DROP POLICY IF EXISTS "Users can view their own film projects" ON film_projects;
CREATE POLICY "Users can view their own film projects" ON film_projects
    FOR SELECT USING (
        auth.uid() = user_id OR 
        user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
        auth.uid() IS NULL
    );

DROP POLICY IF EXISTS "Users can insert their own film projects" ON film_projects;
CREATE POLICY "Users can insert their own film projects" ON film_projects
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
        auth.uid() IS NULL
    );

DROP POLICY IF EXISTS "Users can update their own film projects" ON film_projects;
CREATE POLICY "Users can update their own film projects" ON film_projects
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
        auth.uid() IS NULL
    );

DROP POLICY IF EXISTS "Users can delete their own film projects" ON film_projects;
CREATE POLICY "Users can delete their own film projects" ON film_projects
    FOR DELETE USING (
        auth.uid() = user_id OR 
        user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
        auth.uid() IS NULL
    );

-- Similar permissive policies for characters
DROP POLICY IF EXISTS "Users can view characters from their projects" ON characters;
CREATE POLICY "Users can view characters from their projects" ON characters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = characters.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert characters to their projects" ON characters;
CREATE POLICY "Users can insert characters to their projects" ON characters
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = characters.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can update characters in their projects" ON characters;
CREATE POLICY "Users can update characters in their projects" ON characters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = characters.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete characters from their projects" ON characters;
CREATE POLICY "Users can delete characters from their projects" ON characters
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = characters.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

-- Similar permissive policies for scripts
DROP POLICY IF EXISTS "Users can view scripts from their projects" ON scripts;
CREATE POLICY "Users can view scripts from their projects" ON scripts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = scripts.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert scripts to their projects" ON scripts;
CREATE POLICY "Users can insert scripts to their projects" ON scripts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = scripts.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can update scripts in their projects" ON scripts;
CREATE POLICY "Users can update scripts in their projects" ON scripts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = scripts.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete scripts from their projects" ON scripts;
CREATE POLICY "Users can delete scripts from their projects" ON scripts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = scripts.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

-- Similar permissive policies for shots
DROP POLICY IF EXISTS "Users can view shots from their projects" ON shots;
CREATE POLICY "Users can view shots from their projects" ON shots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = shots.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert shots to their projects" ON shots;
CREATE POLICY "Users can insert shots to their projects" ON shots
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = shots.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can update shots in their projects" ON shots;
CREATE POLICY "Users can update shots in their projects" ON shots
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = shots.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete shots from their projects" ON shots;
CREATE POLICY "Users can delete shots from their projects" ON shots
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = shots.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

-- Similar permissive policies for storyboards  
DROP POLICY IF EXISTS "Users can view storyboards from their projects" ON storyboards;
CREATE POLICY "Users can view storyboards from their projects" ON storyboards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = storyboards.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert storyboards to their projects" ON storyboards;
CREATE POLICY "Users can insert storyboards to their projects" ON storyboards
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = storyboards.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can update storyboards in their projects" ON storyboards;
CREATE POLICY "Users can update storyboards in their projects" ON storyboards
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = storyboards.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete storyboards from their projects" ON storyboards;
CREATE POLICY "Users can delete storyboards from their projects" ON storyboards
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM film_projects 
            WHERE film_projects.id = storyboards.project_id 
            AND (
                film_projects.user_id = auth.uid() OR
                film_projects.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR
                auth.uid() IS NULL
            )
        )
    );