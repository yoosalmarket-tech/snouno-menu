-- Edit No. 7: remove superseded welcome and fixed-banner settings.
-- Current welcome imagery lives in welcome_image_1/2/3, and advertising
-- lives in menu_ads. This migration does not modify either of those systems.
-- Previous values are recorded in MAINTENANCE-EDIT-LOG.md for selective undo.
ALTER TABLE public.menu_settings
  DROP COLUMN IF EXISTS hero,
  DROP COLUMN IF EXISTS banner,
  DROP COLUMN IF EXISTS banner_alt,
  DROP COLUMN IF EXISTS banner_dish,
  DROP COLUMN IF EXISTS banner_two,
  DROP COLUMN IF EXISTS banner_two_alt,
  DROP COLUMN IF EXISTS banner_two_dish,
  DROP COLUMN IF EXISTS banner_three,
  DROP COLUMN IF EXISTS banner_three_alt,
  DROP COLUMN IF EXISTS banner_three_dish;
