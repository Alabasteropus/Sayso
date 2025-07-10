-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('images', 'images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('original-images', 'original-images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

-- Create storage policies for images bucket
CREATE POLICY "Users can upload images" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view images" ON storage.objects 
  FOR SELECT USING (
    bucket_id = 'images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their images" ON storage.objects 
  FOR UPDATE USING (
    bucket_id = 'images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their images" ON storage.objects 
  FOR DELETE USING (
    bucket_id = 'images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create storage policies for original-images bucket
CREATE POLICY "Users can upload original images" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'original-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view original images" ON storage.objects 
  FOR SELECT USING (
    bucket_id = 'original-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their original images" ON storage.objects 
  FOR UPDATE USING (
    bucket_id = 'original-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their original images" ON storage.objects 
  FOR DELETE USING (
    bucket_id = 'original-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create function to get storage URL for images
CREATE OR REPLACE FUNCTION get_storage_url(bucket_name text, object_name text)
RETURNS text AS $$
BEGIN
  RETURN format('%s/storage/v1/object/public/%s/%s', 
    current_setting('app.settings.supabase_url'), 
    bucket_name, 
    object_name);
END;
$$ LANGUAGE plpgsql;