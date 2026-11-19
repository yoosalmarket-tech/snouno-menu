-- Edit No. 10: Remove the retired external ordering provider.
-- Existing Sonbol/Makook links and all dishes remain intact.
-- Recover prior provider URLs from backup-before-edit-10-20261119 if reversed.
BEGIN;
DELETE FROM public.menu_links WHERE channel = 'utlob';
ALTER TABLE public.dishes DROP COLUMN IF EXISTS utlob_url;
COMMIT;
