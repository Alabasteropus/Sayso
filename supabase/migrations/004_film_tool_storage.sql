-- Film Tool Storage Setup
-- Create storage buckets for film assets

-- Create character images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-images',
  'character-images', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create shot images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shot-images',
  'shot-images',
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create project thumbnails bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-thumbnails',
  'project-thumbnails',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create storyboard exports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'storyboard-exports',
  'storyboard-exports',
  true,
  104857600, -- 100MB limit
  ARRAY['application/pdf', 'video/mp4', 'application/zip']
) ON CONFLICT (id) DO NOTHING;

-- Create script exports bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'script-exports',
  'script-exports',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for character-images bucket
CREATE POLICY "Users can view character images from their projects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'character-images' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      JOIN characters c ON c.project_id = fp.id
      WHERE fp.user_id = auth.uid()
      AND c.image_url LIKE '%' || name || '%'
    )
  );

CREATE POLICY "Users can upload character images to their projects" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'character-images' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update character images from their projects" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'character-images' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      JOIN characters c ON c.project_id = fp.id
      WHERE fp.user_id = auth.uid()
      AND c.image_url LIKE '%' || name || '%'
    )
  );

CREATE POLICY "Users can delete character images from their projects" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'character-images' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      JOIN characters c ON c.project_id = fp.id
      WHERE fp.user_id = auth.uid()
      AND c.image_url LIKE '%' || name || '%'
    )
  );

-- Storage RLS policies for shot-images bucket
CREATE POLICY "Users can view shot images from their projects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'shot-images' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      JOIN shots s ON s.project_id = fp.id
      WHERE fp.user_id = auth.uid()
      AND s.image_url LIKE '%' || name || '%'
    )
  );

CREATE POLICY "Users can upload shot images to their projects" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'shot-images' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update shot images from their projects" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'shot-images' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      JOIN shots s ON s.project_id = fp.id
      WHERE fp.user_id = auth.uid()
      AND s.image_url LIKE '%' || name || '%'
    )
  );

CREATE POLICY "Users can delete shot images from their projects" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'shot-images' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      JOIN shots s ON s.project_id = fp.id
      WHERE fp.user_id = auth.uid()
      AND s.image_url LIKE '%' || name || '%'
    )
  );

-- Storage RLS policies for project-thumbnails bucket
CREATE POLICY "Users can view project thumbnails for their projects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'project-thumbnails' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      WHERE fp.user_id = auth.uid()
      AND fp.thumbnail_url LIKE '%' || name || '%'
    )
  );

CREATE POLICY "Users can upload project thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'project-thumbnails' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update project thumbnails for their projects" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'project-thumbnails' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      WHERE fp.user_id = auth.uid()
      AND fp.thumbnail_url LIKE '%' || name || '%'
    )
  );

CREATE POLICY "Users can delete project thumbnails for their projects" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'project-thumbnails' AND
    EXISTS (
      SELECT 1 FROM film_projects fp
      WHERE fp.user_id = auth.uid()
      AND fp.thumbnail_url LIKE '%' || name || '%'
    )
  );

-- Storage RLS policies for storyboard-exports bucket
CREATE POLICY "Users can view their storyboard exports" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'storyboard-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their storyboard exports" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'storyboard-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their storyboard exports" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'storyboard-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their storyboard exports" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'storyboard-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS policies for script-exports bucket
CREATE POLICY "Users can view their script exports" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'script-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their script exports" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'script-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their script exports" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'script-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their script exports" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'script-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create helper functions for storage path generation
CREATE OR REPLACE FUNCTION generate_character_image_path(project_id UUID, character_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'characters/' || project_id::text || '/' || 
         lower(regexp_replace(character_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || 
         extract(epoch from now())::bigint || '.jpg';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_shot_image_path(project_id UUID, script_id UUID, sequence_number INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN 'shots/' || project_id::text || '/' || script_id::text || '/' ||
         'shot-' || lpad(sequence_number::text, 3, '0') || '-' ||
         extract(epoch from now())::bigint || '.jpg';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_project_thumbnail_path(project_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN 'projects/' || project_id::text || '/thumbnail-' ||
         extract(epoch from now())::bigint || '.jpg';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_storyboard_export_path(user_id UUID, project_id UUID, export_type TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN user_id::text || '/storyboards/' || project_id::text || '/' ||
         'storyboard-' || extract(epoch from now())::bigint || '.' || export_type;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_script_export_path(user_id UUID, project_id UUID, script_id UUID, export_type TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN user_id::text || '/scripts/' || project_id::text || '/' ||
         'script-' || script_id::text || '-' || extract(epoch from now())::bigint || '.' || export_type;
END;
$$ LANGUAGE plpgsql;