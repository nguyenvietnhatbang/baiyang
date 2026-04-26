-- Backfill households from legacy ponds (owner_name + agency_code).
-- Run only after migrate-legacy.sql / households table exists.
-- Adjust region_code and segment rules to match your data.

-- Example pattern (uncomment and customize):
--
-- WITH agg AS (
--   SELECT DISTINCT p.agency_code, trim(p.owner_name) AS owner_name
--   FROM public.ponds p
--   WHERE p.household_id IS NULL AND p.agency_code IS NOT NULL AND trim(p.owner_name) <> ''
-- )
-- INSERT INTO public.households (agency_id, region_code, household_segment, name, active)
-- SELECT a.id, '17',
--   lpad((row_number() OVER (PARTITION BY a.id ORDER BY agg.owner_name))::text, 3, '0'),
--   agg.owner_name, true
-- FROM agg
-- JOIN public.agencies a ON a.code = agg.agency_code
-- ON CONFLICT DO NOTHING;
--
-- UPDATE public.ponds p SET household_id = h.id
-- FROM public.households h
-- JOIN public.agencies a ON a.id = h.agency_id
-- WHERE p.household_id IS NULL AND p.agency_code = a.code
--   AND trim(p.owner_name) = trim(h.name);

select 1; -- no-op placeholder
