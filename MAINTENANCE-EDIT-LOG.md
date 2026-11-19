# Snounu cleanup — reversible edit register

Date: 2026-11-19. Repository: `yoosalmarket-tech/snouno-menu`.
**Baseline / recovery branch:** `backup-before-cleanup-20261119` at commit
`5045ef81294aecf6af4e93ab0400fbd745fc2ebf`.
**Staging branch:** `cleanup-5-reversible-edits-20261119`.

Each **Edit No. N** is one isolated commit. A request such as **"cancel edit no.5"**
means reverse *only* that numbered commit's file changes, restoring deleted
files from the baseline branch or the edit's parent; leave all other edits and
subsequent unrelated work intact. Investigate any supplied symptom before
proposing further code changes. Keep the backup branch and this register.

## Edit No. 1 — avoid unnecessary preload
Commit: `83412131e5dacb73a4c66d872f9c9f5631fa637f`.
Changed: `public/index.html`: removed the early `/assets/plate.webp`
preload only. **Did not delete** `plate.webp`: a legacy `menu_settings.hero`
value still points to it.

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
`caesar-ad.webp` (legacy `banner_three` setting), Supabase migrations,
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
