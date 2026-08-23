alter table public.pv_import_batches
  add column if not exists author_identifier_column text;

update public.pv_import_batches as batch
set therapeutic_area = library.therapeutic_area
from public.pv_detection_libraries as library
where batch.library_id = library.id
  and batch.principal_id = library.principal_id
  and batch.therapeutic_area is null
  and library.therapeutic_area is not null;

update public.pv_records as record
set therapeutic_area = coalesce(
      (
        select batch.therapeutic_area
        from public.pv_import_batches as batch
        where batch.library_id = record.library_id
          and batch.principal_id = record.principal_id
          and batch.therapeutic_area is not null
        order by batch.available_at desc
        limit 1
      ),
      library.therapeutic_area
    ),
    updated_at = now()
from public.pv_detection_libraries as library
where record.library_id = library.id
  and record.principal_id = library.principal_id
  and record.therapeutic_area is null
  and coalesce(
    (
      select batch.therapeutic_area
      from public.pv_import_batches as batch
      where batch.library_id = record.library_id
        and batch.principal_id = record.principal_id
        and batch.therapeutic_area is not null
      order by batch.available_at desc
      limit 1
    ),
    library.therapeutic_area
  ) is not null;

comment on column public.pv_import_batches.author_identifier_column is
  'CSV column used to preserve an available reporter identifier for ICH E2D(R1) identifiability assessment. The value is corpus-configurable and therapeutic-area agnostic.';
