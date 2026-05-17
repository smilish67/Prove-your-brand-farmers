-- pybf-media bucket: publish 동안만 사진·영상 임시 보관.
-- 클라이언트가 직접 업로드 가능, 본인 미디어만 접근.

insert into storage.buckets (id, name, public)
values ('pybf-media', 'pybf-media', true)
on conflict (id) do nothing;

-- 본인 폴더(<user_id>/*)에만 업로드·읽기·삭제 가능.
create policy "pybf_media_owner_insert"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'pybf-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pybf_media_owner_select"
on storage.objects
for select to authenticated
using (
  bucket_id = 'pybf-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pybf_media_owner_delete"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'pybf-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 공개 read는 SNS publish API가 fetch할 수 있도록 (bucket이 public이므로 별도 정책 불요).
-- publish 완료 후 backend가 service role로 객체 삭제.
