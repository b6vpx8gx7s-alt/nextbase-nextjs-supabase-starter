-- Create exercise-images bucket (public so patient-facing previews load without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-images',
  'exercise-images',
  true,
  5242880,
  ARRAY['image/gif', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow anyone to read (thumbnails are shown to patients)
DO $$ BEGIN
  CREATE POLICY "exercise-images public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'exercise-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
