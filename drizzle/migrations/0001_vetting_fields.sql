ALTER TABLE public.profiles ADD COLUMN kyb jsonb, ADD COLUMN agent_identity jsonb;
ALTER TABLE public.listings ADD COLUMN details jsonb NOT NULL DEFAULT '{}';