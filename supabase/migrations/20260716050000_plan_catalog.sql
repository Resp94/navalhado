insert into public.plans (
  id,
  name,
  price,
  max_professionals,
  features,
  created_at,
  updated_at
)
values
  (
    'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11',
    'Bronze',
    99.00,
    3,
    '{"whatsapp": true, "financeiro": false}'::jsonb,
    now(),
    now()
  ),
  (
    'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
    'Prata',
    199.00,
    6,
    '{"whatsapp": true, "financeiro": true}'::jsonb,
    now(),
    now()
  ),
  (
    'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33',
    'Ouro',
    349.00,
    15,
    '{"whatsapp": true, "financeiro": true, "suporte_prioritario": true}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  name = excluded.name,
  price = excluded.price,
  max_professionals = excluded.max_professionals,
  features = excluded.features,
  updated_at = now();
