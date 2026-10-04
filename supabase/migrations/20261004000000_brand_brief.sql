-- What the brand agent learned during onboarding (frontend/app/onboarding/brand/route.ts): profile rows, market
-- rates and the Twitch categories the search agent uses, also when it replaces a live stream that ended.
alter table public.brands add column brief jsonb;
