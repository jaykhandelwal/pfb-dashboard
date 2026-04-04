-- Normalize ledger category and payment method settings to support per-user access.
-- `allowedUserIds = null` means the option is available to all current and future users.

INSERT INTO app_settings (key, value)
VALUES
  ('ledger_categories', '[]'::jsonb),
  ('payment_methods', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings
SET value = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(item) = 'object' AND item ? 'allowedUserIds' THEN item
        ELSE item || jsonb_build_object('allowedUserIds', NULL)
      END
    )
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(app_settings.value) = 'array' THEN app_settings.value
        ELSE '[]'::jsonb
      END
    ) AS item
  ),
  '[]'::jsonb
)
WHERE key IN ('ledger_categories', 'payment_methods');
