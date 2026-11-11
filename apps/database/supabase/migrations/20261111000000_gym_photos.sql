-- ── Storage buckets ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('gym-reference-photos', 'gym-reference-photos', true,  10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('gym-client-photos',    'gym-client-photos',    false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Reference photos: authenticated users can read (public bucket), service_role can write
CREATE POLICY "gym_ref_photos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'gym-reference-photos');

CREATE POLICY "gym_ref_photos_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gym-reference-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT business_id::text FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "gym_ref_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gym-reference-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT business_id::text FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Client photos: only service_role accesses directly (signed URLs via API)
-- No direct client/trainer storage policy — all access via server-side signed URLs

-- ── gym_reference_photos (fotos de referencia del negocio) ───────────────────
CREATE TABLE gym_reference_photos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  gender          text        NOT NULL CHECK (gender IN ('masculino', 'femenino')),
  storage_path    text        NOT NULL,
  photo_url       text        NOT NULL,
  caption         text,
  display_order   integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_reference_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_reference_photos_business_write ON gym_reference_photos
  FOR ALL
  USING (business_id IN (SELECT business_id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE user_id = auth.uid()));

-- All authenticated users can read reference photos (shown to clients)
CREATE POLICY gym_reference_photos_read ON gym_reference_photos
  FOR SELECT TO authenticated
  USING (true);

GRANT ALL ON TABLE gym_reference_photos TO authenticated;
GRANT ALL ON TABLE gym_reference_photos TO service_role;

-- ── gym_client_photos (fotos de progreso del cliente) ────────────────────────
CREATE TABLE gym_client_photos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id       uuid        NOT NULL REFERENCES gym_clients(id) ON DELETE CASCADE,
  storage_path    text        NOT NULL,
  photo_date      date        NOT NULL DEFAULT CURRENT_DATE,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_client_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_client_photos_business_access ON gym_client_photos
  FOR ALL
  USING (business_id IN (SELECT business_id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY gym_client_photos_client_access ON gym_client_photos
  FOR ALL TO authenticated
  USING (client_id IN (SELECT gym_client_id FROM gym_client_users WHERE auth_user_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT gym_client_id FROM gym_client_users WHERE auth_user_id = auth.uid()));

GRANT ALL ON TABLE gym_client_photos TO authenticated;
GRANT ALL ON TABLE gym_client_photos TO service_role;

CREATE INDEX gym_client_photos_client_id_idx   ON gym_client_photos(client_id);
CREATE INDEX gym_client_photos_business_id_idx ON gym_client_photos(business_id);
CREATE INDEX gym_reference_photos_business_idx ON gym_reference_photos(business_id, gender);
