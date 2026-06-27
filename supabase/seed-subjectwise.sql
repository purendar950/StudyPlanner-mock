-- ════════════════════════════════════════════════════════════════════════
--  Seed "Subject Wise" sub-structure (Option B): Subject → Year
--  For every "Subject Wise" folder in SSC CGL that is currently empty, create:
--     Maths / Reasoning / English / General Awareness  →  2025 / 2024
--  Safe to re-run (skips Subject Wise folders that already have sub-folders).
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  sw record; subj text; yr text; id_subj uuid;
  subj_arr text[] := array['Maths','Reasoning','English','General Awareness'];
  yr_arr   text[] := array['2025','2024'];
begin
  for sw in select id from public.folders where exam_id='cgl' and name='Subject Wise' loop
    if not exists (select 1 from public.folders where parent_id = sw.id) then
      foreach subj in array subj_arr loop
        insert into public.folders(exam_id,parent_id,name) values('cgl', sw.id, subj) returning id into id_subj;
        foreach yr in array yr_arr loop
          insert into public.folders(exam_id,parent_id,name) values('cgl', id_subj, yr);
        end loop;
      end loop;
    end if;
  end loop;
end $$;
