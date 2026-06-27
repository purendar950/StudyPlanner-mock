-- ════════════════════════════════════════════════════════════════════════
--  StudyPlanner Mock — SEED the full folder hierarchy (matches the screenshots)
--  Run AFTER schema.sql + schema-v2.sql.  Safe to re-run (skips if already seeded).
--  Creates: Categories → Exams → nested Folders.  (Tests you add later in admin.)
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  t_type text; t_tier text; t_year text; t_fmt text; t_subj text; ch text; ex text; s text;
  id_type uuid; id_tier uuid; id_year uuid; id_fmt uuid; id_subj uuid; id_f uuid; id_par uuid;
  subj_arr text[] := array['Reasoning','General Awareness','Maths','English'];
begin
  -- ── Categories ──
  insert into public.exam_categories(id,name,subtitle,order_index,is_coming_soon,is_published) values
    ('ssc','SSC Exams','CGL, CHSL, MTS, CPO, STENO, PHASE…',0,false,true),
    ('railway','Railway Exams','NTPC, Group D, ALP, RPF…',1,false,true),
    ('state','State Exams','PCS, Police, Patwari & State Govt…',2,true,true)
  on conflict (id) do nothing;

  -- ── SSC exams ──
  insert into public.exams(id,category_id,name,subtitle,order_index) values
    ('ssc-subject-pyq','ssc','SSC Subject Wise PYQ','All SSC exams subject-wise chapter-wise PYQs',0),
    ('cgl','ssc','SSC CGL','Combined Graduate Level',1),
    ('chsl','ssc','SSC CHSL','Combined Higher Secondary Level',2),
    ('mts','ssc','SSC MTS','Multi Tasking Staff',3),
    ('cpo','ssc','SSC CPO','Central Police Organization',4),
    ('steno','ssc','SSC STENO','Stenographer Grade C & D',5),
    ('phase','ssc','SSC PHASE','Selection Posts Phase',6),
    ('gd','ssc','SSC GD','GD Constable',7)
  on conflict (id) do nothing;

  -- ── Railway exams ──
  insert into public.exams(id,category_id,name,subtitle,order_index) values
    ('rrb-ntpc','railway','RRB NTPC','Non-Technical Popular Categories',0),
    ('rrb-groupd','railway','RRB Group D','Level-1 Posts',1),
    ('rrb-alp','railway','RRB ALP','Assistant Loco Pilot',2),
    ('rrb-rpf','railway','RRB RPF','Railway Protection Force',3)
  on conflict (id) do nothing;

  -- ── SSC CGL: PYQ Mock → Tier → (Year for PYQ) → Full/Sectional/Subject Wise → (Sectional→subjects) ──
  if not exists (select 1 from public.folders where exam_id='cgl') then
    foreach t_type in array array['PYQ Mock','New Mock'] loop
      insert into public.folders(exam_id,parent_id,name) values('cgl',null,t_type) returning id into id_type;
      foreach t_tier in array array['Tier I','Tier II'] loop
        insert into public.folders(exam_id,parent_id,name) values('cgl',id_type,t_tier) returning id into id_tier;
        if t_type = 'PYQ Mock' then
          foreach t_year in array array['2025','2024'] loop
            insert into public.folders(exam_id,parent_id,name) values('cgl',id_tier,t_year) returning id into id_year;
            foreach t_fmt in array array['Full Mocks','Sectionals','Subject Wise'] loop
              insert into public.folders(exam_id,parent_id,name) values('cgl',id_year,t_fmt) returning id into id_fmt;
              if t_fmt = 'Sectionals' then
                foreach t_subj in array subj_arr loop
                  insert into public.folders(exam_id,parent_id,name) values('cgl',id_fmt,t_subj);
                end loop;
              end if;
            end loop;
          end loop;
        else
          foreach t_fmt in array array['Full Mocks','Sectionals','Subject Wise'] loop
            insert into public.folders(exam_id,parent_id,name) values('cgl',id_tier,t_fmt) returning id into id_fmt;
            if t_fmt = 'Sectionals' then
              foreach t_subj in array subj_arr loop
                insert into public.folders(exam_id,parent_id,name) values('cgl',id_fmt,t_subj);
              end loop;
            end if;
          end loop;
        end if;
      end loop;
    end loop;
  end if;

  -- ── SSC Subject Wise PYQ: Subject → Chapters ──
  if not exists (select 1 from public.folders where exam_id='ssc-subject-pyq') then
    insert into public.folders(exam_id,parent_id,name,order_index) values('ssc-subject-pyq',null,'Maths',0) returning id into id_subj;
    foreach ch in array array['Percentage','Ratio & Proportion','Profit & Loss','Discount','SI','CI','Partnership','Time & Work','Time & Distance','Average','Mixture & Alligation','Number System','Algebra','Geometry','Trigonometry'] loop
      insert into public.folders(exam_id,parent_id,name) values('ssc-subject-pyq',id_subj,ch);
    end loop;

    insert into public.folders(exam_id,parent_id,name,order_index) values('ssc-subject-pyq',null,'Reasoning',1) returning id into id_subj;
    foreach ch in array array['Analogy','Series','Coding-Decoding','Blood Relation','Syllogism','Venn Diagram','Direction & Distance','Clock & Calendar'] loop
      insert into public.folders(exam_id,parent_id,name) values('ssc-subject-pyq',id_subj,ch);
    end loop;

    insert into public.folders(exam_id,parent_id,name,order_index) values('ssc-subject-pyq',null,'English',2) returning id into id_subj;
    foreach ch in array array['Synonyms','Antonyms','Idioms & Phrases','One Word Substitution','Spelling','Error Spotting','Cloze Test','Reading Comprehension'] loop
      insert into public.folders(exam_id,parent_id,name) values('ssc-subject-pyq',id_subj,ch);
    end loop;

    insert into public.folders(exam_id,parent_id,name,order_index) values('ssc-subject-pyq',null,'General Awareness',3) returning id into id_subj;
    foreach ch in array array['History','Geography','Polity','Economics','Science','Static GK','Current Affairs'] loop
      insert into public.folders(exam_id,parent_id,name) values('ssc-subject-pyq',id_subj,ch);
    end loop;
  end if;

  -- ── Other SSC + Railway exams: simple Full Mocks / Sectionals(→subjects) ──
  foreach ex in array array['chsl','mts','cpo','steno','phase','gd','rrb-ntpc','rrb-groupd','rrb-alp','rrb-rpf'] loop
    if not exists (select 1 from public.folders where exam_id=ex) then
      insert into public.folders(exam_id,parent_id,name,order_index) values(ex,null,'Full Mocks',0);
      insert into public.folders(exam_id,parent_id,name,order_index) values(ex,null,'Sectionals',1) returning id into id_f;
      foreach s in array subj_arr loop
        insert into public.folders(exam_id,parent_id,name) values(ex,id_f,s);
      end loop;
    end if;
  end loop;
end $$;
