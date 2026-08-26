-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: cuando businesses.category se establece en 'gym' (INSERT o UPDATE),
-- insertar automáticamente las filas 'gym' y 'nutricion' en business_services.
-- No borra filas al salir de 'gym' — esa decisión es manual/futura.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_gym_business_services()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.category = 'gym' THEN
    INSERT INTO business_services (business_id, service)
    VALUES
      (NEW.id, 'gym'),
      (NEW.id, 'nutricion')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_gym_business_services ON businesses;

CREATE TRIGGER trg_sync_gym_business_services
AFTER INSERT OR UPDATE OF category ON businesses
FOR EACH ROW
EXECUTE FUNCTION sync_gym_business_services();
