-- Read-only manual historical release. No credentials; never remove publication filter.
-- Save the single history JSON value to src/content/history-wall.json and run tests.
select jsonb_build_object(
 'schemaVersion',1,'exportedAt',now(),
 'source','Supabase murrosmatriisi / public.items',
 'policy','Julkisiksi merkityt ajoitetut kohteet. Lähteistetty tapahtuma ei vahvista mekanismin syyvaikutusta. Tulevaisuus erotetaan skenaariona.',
 'items',(select jsonb_agg(jsonb_build_object(
  'id',id,'title',title,'start',year_start,'end',year_end,'kind',type,
  'domains',domains,'importance',importance,'confidence',confidence,'sources',sources
 ) order by year_start,id)
 from public.items
 where not coalesce(unpublished,false)
   and year_start is not null and year_end is not null
   and year_start<=2050 and year_end>=1850)
) as history;
