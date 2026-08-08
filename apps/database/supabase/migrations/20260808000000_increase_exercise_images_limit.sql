-- Increase exercise-images bucket file size limit from 5 MB to 28 MB
UPDATE storage.buckets
SET file_size_limit = 29360128  -- 28 MB in bytes
WHERE id = 'exercise-images';
