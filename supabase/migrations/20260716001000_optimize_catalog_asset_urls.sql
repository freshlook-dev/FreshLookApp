-- Switch active catalog and website records to visually equivalent, optimized
-- WebP copies. Original Storage objects are deliberately retained for rollback.

begin;

update public.products
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/products/optimized-v1/1776625475955-IMG_4727.webp'
where id = '390897b5-7289-42a9-a17f-807167397d48'
  and image_url like '%1776625475955-IMG_4727.jpeg%';

update public.products
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/products/optimized-v1/1776625410975-IMG_4723.webp'
where id = '3d707cdf-8a25-4430-b0f3-e7d75da36246'
  and image_url like '%1776625410975-IMG_4723.jpeg%';

update public.products
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/products/optimized-v1/1776625455013-IMG_4726.webp'
where id = '069445d6-b4d4-4c03-8eee-4774197cf948'
  and image_url like '%1776625455013-IMG_4726.jpeg%';

update public.products
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/products/optimized-v1/1776625516166-IMG_4732.webp'
where id = '17f22aa4-9154-4bf0-921f-8a615eebd2db'
  and image_url like '%1776625516166-IMG_4732.jpeg%';

update public.products
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/products/optimized-v1/1776625432711-IMG_4719.webp'
where id = 'b55e1396-2ee0-4283-bd12-81cdd66ed3dc'
  and image_url like '%1776625432711-IMG_4719.jpeg%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/services/optimized-v1/1777030700018-1000002029.webp'
where id = 'eec38b95-1d72-4e02-891c-87fa99273a57'
  and image_url like '%1777030700018-1000002029.jpg%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/services/optimized-v1/1781045769338-tattoo.webp'
where id = 'a2cb6d08-9501-44d8-abd5-aaf3ca2e8180'
  and image_url like '%1781045769338-tattoo.png%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/services/optimized-v1/1781045364666-microblading.webp'
where id = 'ffc698bb-7098-4e48-8579-07f6cb7ded17'
  and image_url like '%1781045364666-microblading.png%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/services/optimized-v1/1777030845891-1000003998.webp'
where id = '25cd4c1a-147c-44e8-b438-b1f65ce4f855'
  and image_url like '%1777030845891-1000003998.jpg%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/service-images/2dbf0afd-bfcc-45c0-836d-cd55855fa455/optimized-v1/1783809788308.webp'
where id = 'a2b7a519-6a15-45c4-8305-89af934e573b'
  and image_url like '%1783809788308.jpg%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/services/optimized-v1/1777031647572-1000006455.webp'
where id = '91fef12a-891a-4e5e-a101-803f00e77626'
  and image_url like '%1777031647572-1000006455.jpg%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/services/optimized-v1/1776364830991-Emsculpt-NEO-Side-Effects-2.webp'
where id = '24d9d7e4-aec7-4281-9462-923d07668292'
  and image_url like '%1776364830991-Emsculpt-NEO-Side-Effects-2.webp%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/services/optimized-v1/1777031070800-1000006443.webp'
where id = 'ee0d2575-b152-40ba-b5e6-62b3018ef683'
  and image_url like '%1777031070800-1000006443.jpg%';

update public.services
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/services/optimized-v1/1777031198638-1000006447.webp'
where id = '2e5c9ae3-a0e0-49fa-a9a7-6512e72d35e5'
  and image_url like '%1777031198638-1000006447.jpg%';

update public.site_images
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/site-images/optimized-v1/service4-1776208077096.webp'
where id = 'f6cd8380-e5ae-4b6b-b5d3-b35b4f7e3ce6'
  and image_url like '%service4-1776208077096.jpg%';

update public.site_images
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/site-images/optimized-v1/service1-1776207492373.webp'
where id = '175af458-164f-41e4-9262-b6b32dae22af'
  and image_url like '%service1-1776207492373.jpg%';

update public.site_images
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/site-images/optimized-v1/hero1-1776208040441.webp'
where id = '2c04c642-a739-46d5-b107-6cdfa5e8e0af'
  and image_url like '%hero1-1776208040441.jpg%';

update public.site_images
set image_url = 'https://qssfunpwaacbbagajsmi.supabase.co/storage/v1/object/public/site-images/optimized-v1/service2-1776210182748.webp'
where id = '21908f18-c5f8-49fd-9652-4fd906fdc999'
  and image_url like '%service2-1776210182748.jpg%';

commit;
