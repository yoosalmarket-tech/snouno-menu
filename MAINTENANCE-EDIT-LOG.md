# Snounu cleanup — reversible edit register

Date: 2026-11-19. Repository: `yoosalmarket-tech/snouno-menu`.
**Baseline / recovery branch:** `backup-before-cleanup-20261119` at commit
`5045ef81294aecf6af4e93ab0400fbd745fc2ebf`.
**Staging branch:** `cleanup-5-reversible-edits-20261119`.

Each **Edit No. N** is one isolated commit. Edits 6–7 preserve their own backup branch. A request such as **"cancel edit no.5"**
means reverse *only* that numbered commit's file changes, restoring deleted
files from the baseline branch or the edit's parent; leave all other edits and
subsequent unrelated work intact. Investigate any supplied symptom before
proposing further code changes. Keep the backup branch and this register.

## Edit No. 1 — avoid unnecessary preload
Commit: `83412131e5dacb73a4c66d872f9c9f5631fa637f`.
Changed: `public/index.html`: removed the early `/assets/plate.webp`
preload only. **Did not delete** `plate.webp`: retained for selective restoration of
Edit No. 7, which removes the obsolete `menu_settings.hero` column.

## Edit No. 2 — remove unused SVG cutout experiments
Commit: `38e57d86250a02ddec8014904b547ee9b77f836f`.
Deleted all ten SVGs from `public/assets/interactive-cutouts/`:
`2463.svg`, `2469.svg`, `2475.svg`, `2477.svg`, `2482.svg`,
`2489.svg`, `2493.svg`, `2934.svg`, `5173.svg`, `5177.svg`.
Current rich images use Supabase storage URLs, not these local SVGs.

## Edit No. 3 — remove unused image mask
Commit: `e9f494621a1a25b927905c15a24054e8b53ddc52`.
Deleted: `public/assets/mask.webp`.

## Edit No. 4 — remove old welcome photographic backgrounds
Commit: `3811c622d9e16e2852d70c7e55cf7c07bbb412a0`.
Deleted:
- `public/assets/restaurant-front.webp`
- `public/assets/welcome-charcoal.webp`
- `public/assets/welcome-interior.webp`
- `public/assets/welcome-serving.webp`

Current welcome food carousel assets are under `public/assets/welcome/`.

## Edit No. 5 — remove unreferenced old food photos
Commit: `a50515bab116ea193915e8ee2239759925211f59`.
Deleted:
- `public/assets/caesar.webp`
- `public/assets/shrimp.webp`
- `public/assets/vegetables.webp`
- `public/assets/meals/caesar.webp`
- `public/assets/meals/shrimp.webp`
- `public/assets/meals/vegetables.webp`
- `public/assets/knockout-detail.webp`

## Safety and recovery
Before the changes, we searched the current HTML/CSS/JS/server files
and checked live Supabase `dishes`, `menu_settings`, `menu_ads`, and
`menu_links`. None of the removed files was referenced there.
This is not a guarantee that an older installed service worker, saved
external URL, or unexamined third-party page does not link to a removed file.

**Important retained assets:** all 39 live standard dish images in
`public/assets/meals/`, all current Supabase rich images, current ad
images, logos/icons/manifests, fonts and licenses, `plate.webp`,
`caesar-ad.webp` (retained for selective restoration), Supabase migrations,
and dashboard files.

**Undo:** Use a new revert/restoration commit rather than rewriting
shared `main` history. For Edits 2–5, restore the deleted blobs from
`backup-before-cleanup-20261119`; for Edit 1, undo only its preload
removal. Do not globally reset `main`, because doing so could erase
later unrelated changes. Check the deployed menu, the dashboard, and
reported browser errors after any rollback.

The prior **3-second/Safari mode-loading** improvements are intentionally
on separate branch `safari-3s-loading-isolation-20261119` and are
**not part of these five cleanup edits**.

## Edit No. 6 — Clean superseded design attribution notes
Commit: `bbe7327deb46ea08fe3271cbcbda6cb471493d80`.
Files: `public/menu.css`, `public/rich-menu.css`, `public/rich-menu.js`.
Removed seven obsolete attribution comments, replacing them with accurate,
brand-neutral implementation notes. **No animation rules or application behavior
were intentionally changed.** To undo, revert only this commit's text changes.
The live code no longer mentions the unrelated sample-brand name.
Prior Git commits and backup branches are deliberately not history-rewritten.

## Edit No. 7 — Remove obsolete menu-settings media columns
Commit: `3359ba84096567c5faa1dfcf09154a709259e0d5`.
Files: `public/menu.js`, `public/admin/app.js`, plus
`supabase/migrations/20261119114000_remove_legacy_menu_settings_fields.sql`.
Removed ten unused `menu_settings` columns: `hero`, `banner`,
`banner_alt`, `banner_dish`, `banner_two`, `banner_two_alt`,
`banner_two_dish`, `banner_three`, `banner_three_alt`,
`banner_three_dish`. The replacement `menu_ads` table and
`welcome_image_1` through `welcome_image_3` are unchanged.
Removed the obsolete preview key and legacy image-size hints from the frontend.
**Snapshot before deletion:** there was one settings row:
- `id=1`
- `hero=/assets/plate.webp`
- `banner=/assets/banner.webp`, `banner_alt=الشافل`, `banner_dish=NULL`
- `banner_two=/assets/knockout-ad.webp`, `banner_two_alt=نوك آوت`,
  `banner_two_dish=8984a7fa-3aee-471b-8855-9fd0b5b3aa6e`
- `banner_three=/assets/caesar-ad.webp`,
  `banner_three_alt=سلطة سيزر بالدجاج`, `banner_three_dish=NULL`.

**Selective rollback of Edit No. 7:** revert the Git commit's code changes,
then add the columns back through a fresh Supabase migration and restore the
snapshot (do NOT roll back the entire database). Use:

```sql
ALTER TABLE public.menu_settings
 ADD COLUMN IF NOT EXISTS hero text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS banner text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS banner_alt text NOT NULL DEFAULT 'إعلان مطعم سنونو',
 ADD COLUMN IF NOT EXISTS banner_dish uuid REFERENCES public.dishes(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS banner_two text NOT NULL DEFAULT '/assets/knockout-ad.webp',
 ADD COLUMN IF NOT EXISTS banner_two_alt text NOT NULL DEFAULT 'نوك آوت',
 ADD COLUMN IF NOT EXISTS banner_two_dish uuid REFERENCES public.dishes(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS banner_three text NOT NULL DEFAULT '/assets/caesar-ad.webp',
 ADD COLUMN IF NOT EXISTS banner_three_alt text NOT NULL DEFAULT 'سلطة سيزر بالدجاج',
 ADD COLUMN IF NOT EXISTS banner_three_dish uuid REFERENCES public.dishes(id) ON DELETE SET NULL;

UPDATE public.menu_settings SET
 hero='/assets/plate.webp',
 banner='/assets/banner.webp', banner_alt='الشافل', banner_dish=NULL,
 banner_two='/assets/knockout-ad.webp', banner_two_alt='نوك آوت',
 banner_two_dish='8984a7fa-3aee-471b-8855-9fd0b5b3aa6e',
 banner_three='/assets/caesar-ad.webp',
 banner_three_alt='سلطة سيزر بالدجاج', banner_three_dish=NULL
WHERE id=1;
```

**Recovery branch for Edits No. 6 and 7:**
`backup-before-edits-6-7-20261119` at
`59cc71a6dd18e47f9f06576498b4dec3be097690`.
Edits 1–5 and the earlier three-second mode-loading prototype are independent.
Do not overwrite unrelated work or reset `main` to restore an individual edit.
