create table public.user_onboarding (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  first_name text not null,
  last_name text null,
  avatar_type text null,
  avatar_value text null,
  selected_feelings jsonb null default '[]'::jsonb,
  mood_intensity smallint null default 0,
  terms_accepted boolean null default false,
  terms_accepted_at timestamp with time zone null,
  notifications_enabled boolean null default false,
  microphone_enabled boolean null default false,
  age_range text null,
  avatar_reason text null,
  discomfort_reasons jsonb null default '[]'::jsonb,
  onboarding_completed boolean null default false,
  onboarding_completed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  chat json null,
  journal json null,
  mood json null,
  style text null,
  challenge text null,
  presence text null,
  insight text null,
  onboarding_user_preferences json null,
  constraint user_onboarding_pkey primary key (id),
  constraint user_onboarding_user_id_key unique (user_id),
  constraint user_onboarding_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_onboarding_age_range_check check (
    (
      age_range = any (
        array[
          'under-18'::text,
          '18-24'::text,
          '25-34'::text,
          '35-44'::text,
          '45-54'::text,
          '55+'::text
        ]
      )
    )
  ),
  constraint user_onboarding_avatar_type_check check (
    (
      avatar_type = any (array['emoji'::text, 'icon'::text, 'image'::text])
    )
  ),
  constraint user_onboarding_mood_intensity_check check (
    (
      (mood_intensity >= 0)
      and (mood_intensity <= 3)
    )
  )
) TABLESPACE pg_default;