# Backend storage architecture — `user_onboarding` god-table issue

**Audience:** backend team (Python/Werkzeug service `mellobackend-cd2a-7aac`)
**Filed by:** mobile team
**Date:** 2026-05-01
**Severity:** medium-now / high-as-we-scale

---

## TL;DR

`/rest/v1/journal_entries` and `/rest/v1/update/chat` both write to JSON columns on `public.user_onboarding` and ignore the dedicated tables (`public.journal_entries`, `public.chats`). Every save is a full-blob overwrite of the user's row, which doesn't scale, breaks multi-device sync, and can corrupt unrelated fields. We need the handlers migrated to row-per-entry on the proper tables.

---

## 1. The issue

The `public.journal_entries` and `public.chats` tables are not being used by the live API.

- **`POST /rest/v1/journal_entries`** writes to `public.user_onboarding.journal` (a `json` column), not to a row in `public.journal_entries`.
- **`POST /rest/v1/update/chat`** writes to `public.user_onboarding.chat` (a `json` column), not to rows in `public.chats`.
- Both endpoints **replace the entire JSON blob** on every call — there is no append, merge, or row-level update.

The dedicated tables exist with proper schemas (and `journal_entries` now has typed columns: `title`, `source`, `tags`, `mood`, `chat_id`, `chat_type`, plus indexes including a partial `UNIQUE` on `(user_id, chat_id) WHERE source='chat'`). They are unused.

---

## 2. What happened (evidence)

### 2a. `public.chats` is frozen

Last `created_at` in `public.chats` is **2026-04-22**. Today is 2026-05-01. The app loads 5 chat threads correctly via `/rest/v1/load/chat`. Conclusion: the live read path doesn't use `public.chats`.

### 2b. The data lives in `user_onboarding`

```sql
SELECT
  user_id,
  jsonb_array_length(COALESCE((chat::jsonb)->'chats', '[]'::jsonb)) AS chat_count,
  jsonb_array_length(COALESCE((journal::jsonb)->'entries', '[]'::jsonb)) AS journal_count
FROM public.user_onboarding
WHERE user_id = '2903538f-ac89-4ffb-b473-e181f73edc0a';
```

Returned `chat_count: 5`, `journal_count: 2` — matching the app exactly. The chats and journal entries the app shows are stored in JSON columns on `user_onboarding`.

### 2c. Curl proof — POST writes to `user_onboarding.journal`

We ran:

```bash
curl -i -X POST \
  'https://me-539b4e0a005d4010ba48937cc598b48a.ecs.ap-south-2.on.aws/rest/v1/journal_entries' \
  -H 'Authorization: Bearer <jwt>' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "2903538f-ac89-4ffb-b473-e181f73edc0a",
    "journal": {
      "entries": [{
        "id": "curl-test-2026-05-01",
        "title": "CURL_TEST_MARKER_XYZ",
        "body": "test body for routing diagnostic",
        "source": "text",
        "tags": ["curl-diagnostic"],
        "createdAt": "2026-05-01T12:00:00.000Z"
      }]
    }
  }'
```

Response (truncated):

```
HTTP/2 200
server: Werkzeug/3.1.8 Python/3.12.13
content-length: 11251

{
  "age_range": null,
  "avatar_*": null,
  "chat": { "chats": [...] },
  "journal": { "entries": [
    { "id": "curl-test-2026-05-01", "title": "CURL_TEST_MARKER_XYZ", ... }
  ]},
  "onboarding_completed": true,
  "onboarding_user_preferences": { ... },
  ...
}
```

The response body is the **entire `user_onboarding` row** — proving the handler is doing:

```sql
UPDATE public.user_onboarding SET journal = $1 WHERE user_id = $2 RETURNING *;
```

Side effect we observed: this curl call **wiped the user's two existing prompt entries**, because we sent only one entry and the handler replaced the whole `journal` blob. Recovered by SQL UPDATE, but this is exactly the multi-device corruption risk in production.

### 2d. `public.journal_entries` is untouched

After the curl above:

```sql
SELECT count(*) FROM public.journal_entries
WHERE content LIKE '%CURL_TEST_MARKER_XYZ%';
-- → 0
```

The marker landed in `user_onboarding.journal`, not in `journal_entries`.

---

## 3. What we were trying to do

Ship a "Save chat to journal" feature on mobile:

- User long-presses a chat in History → "Save to journal".
- That chat appears in Journal under a "saved" filter, with a "saved chat" tag and a chat-style card.
- Tapping it opens the chat thread.
- Unsave removes it cleanly. Idempotent (saving twice doesn't duplicate).

To support this we asked for and added the following columns to `public.journal_entries`:

```sql
ALTER TABLE public.journal_entries
  ADD COLUMN title       text,
  ADD COLUMN source      text NOT NULL DEFAULT 'text'
             CHECK (source IN ('voice','text','prompt','chat')),
  ADD COLUMN tags        text[],
  ADD COLUMN mood        text,
  ADD COLUMN chat_id     text,
  ADD COLUMN chat_type   text CHECK (chat_type IS NULL OR chat_type IN ('textchat','voicechat'));

CREATE INDEX journal_entries_user_created_idx
  ON public.journal_entries (user_id, created_at DESC);
CREATE INDEX journal_entries_tags_gin
  ON public.journal_entries USING GIN (tags);
CREATE INDEX journal_entries_chat_id_idx
  ON public.journal_entries (chat_id) WHERE chat_id IS NOT NULL;
CREATE UNIQUE INDEX journal_entries_user_chat_unique
  ON public.journal_entries (user_id, chat_id) WHERE source = 'chat';
```

These exist in the DB but are unreachable through the API today. The partial UNIQUE was specifically meant to give DB-level idempotency for saved-chat upserts.

---

## 4. Where the data is actually storing

```
┌─────────────────────────────────────────────────────────┐
│                    public.user_onboarding              │
│  ┌────────────────────────────────────────────────────┐ │
│  │ id, user_id, first_name, last_name, avatar_*,      │ │
│  │ onboarding_completed, terms_accepted, …            │ │
│  │ ─────────────────────────────────────────────────  │ │
│  │ chat (json)     ← all chats live here (god-blob)   │ │
│  │ journal (json)  ← all journal lives here (god-blob)│ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

         ↑ everything goes here

public.chats              ← dead (last write 2026-04-22)
public.journal_entries    ← dead (live API never writes)
public.messages           ← dead
```

Both blob columns are full read-modify-write on every save. The handler signature is effectively `UPDATE user_onboarding SET <column> = $1 WHERE user_id = $2`.

---

## 5. Why this needs to change

### 5a. Doesn't scale

Every save rewrites the entire user's blob. A user with 50 chats × ~100 messages averages a 1–5 MB JSON column. Sending a single new message means:

- Client GET 5 MB.
- Client adds 1 message.
- Client POST 5 MB back.
- Backend `UPDATE user_onboarding SET chat = $1` — Postgres rewrites the entire `toast` value.
- Network and DB IO scale linearly with total chat size, not with the message size.

At 1k DAU each adding 30 messages/day, that's 30k full-blob rewrites/day. At 10k DAU, 300k. The blob keeps growing.

### 5b. Multi-device clobber

Two devices saving within seconds of each other will overwrite each other:

```
T0: device A reads blob (3 entries)
T1: device B reads blob (3 entries)
T2: device A writes blob (4 entries) [adds entry X]
T3: device B writes blob (4 entries) [adds entry Y]    ← X is gone
```

There is no row-level locking, no merge, no `If-Match`/`ETag`. Last write wins, full overwrite. We hit this with the curl test above — sending one entry wiped two unrelated existing entries.

### 5c. Corruption risk across unrelated fields

`user_onboarding` mixes onboarding answers, terms acceptance, push permissions, chat data, and journal data into one row. A bug in the journal POST handler that constructs the wrong full-row payload (e.g. omits `terms_accepted`) can flip a column it had no business touching. The blast radius of any bug spans the entire user record.

### 5d. No server-side filtering / pagination

The "saved" filter on Journal needs to scan all entries client-side because the API only returns the whole blob. Same for any future analytics ("how many users saved a chat last week?") — has to iterate every user's blob.

---

## 6. Optimal solution

Migrate the two endpoints from blob-overwrite on `user_onboarding` to row-per-entry on the dedicated tables. The schemas are already in place.

### 6a. Journal

Switch the handlers behind `/rest/v1/journal_entries` to operate on `public.journal_entries`:

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/rest/v1/journal_entries` | INSERT one row from body. Honor `Prefer: resolution=merge-duplicates,return=representation` so client retries / saved-chat upserts merge against the partial UNIQUE on `(user_id, chat_id) WHERE source='chat'`. Return the inserted row. |
| `GET` | `/rest/v1/journal_entries?user_id=eq.<uid>` | Return array of rows, support `order=created_at.desc`, `limit=`, `select=`, filter by `source=eq.<src>`, `chat_id=eq.<id>`, etc. |
| `DELETE` | `/rest/v1/journal_entries?id=eq.<entry_id>` | Delete one row. RLS to enforce `user_id = auth.uid()`. |
| `DELETE` | `/rest/v1/journal_entries?chat_id=eq.<cid>&source=eq.chat` | For unsaving a chat without knowing the entry id. |

PATCH is nice-to-have but optional — POST upsert covers the edit path.

Body shape on POST:

```json
{
  "user_id": "<uuid>",
  "content": "...",
  "title": "...",
  "source": "voice|text|prompt|chat",
  "tags": ["..."],
  "mood": "...",
  "chat_id": "...",
  "chat_type": "textchat|voicechat"
}
```

The mobile client is **already coded for this row shape** in `services/journal/journalService.ts` history — we reverted it to blob-shape only because the backend rejected row-shape POSTs. When you're done, we flip back in one commit.

### 6b. Chat

Same pattern for chat. `/rest/v1/upload/chat` and `/rest/v1/update/chat` should INSERT/UPDATE rows in `public.chats` (or a chat_messages table) instead of replacing `user_onboarding.chat`. Indexes + `(user_id, created_at desc)` ordering.

### 6c. Migrate existing data

```sql
-- Journal: split each user's blob into rows.
INSERT INTO public.journal_entries
  (id, user_id, content, created_at, word_count, title, source, tags, chat_id, chat_type)
SELECT
  COALESCE((e->>'id')::uuid, gen_random_uuid()),
  uo.user_id,
  COALESCE(e->>'body', ''),
  COALESCE((e->>'createdAt')::timestamptz, NOW()),
  COALESCE(array_length(regexp_split_to_array(trim(e->>'body'), '\s+'), 1), 0),
  e->>'title',
  COALESCE(e->>'source', 'text'),
  CASE WHEN e ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(e->'tags')) ELSE NULL END,
  e->>'chatId',
  e->>'chatType'
FROM public.user_onboarding uo,
     jsonb_array_elements(COALESCE(uo.journal::jsonb -> 'entries', '[]'::jsonb)) e
WHERE uo.journal IS NOT NULL
ON CONFLICT DO NOTHING;
```

(adjust `id` cast — saved-chat ids are non-UUID strings; you may want to keep `journal_entries.id` as `uuid` and store the `chat:<x>` key elsewhere, or change the column to `text`.)

After migration verified, drop the JSON columns:

```sql
ALTER TABLE public.user_onboarding
  DROP COLUMN journal,
  DROP COLUMN chat;
```

### 6d. RLS

Enable RLS on `journal_entries` and `chats` if it isn't already, with `user_id = auth.uid()` policies for SELECT/INSERT/UPDATE/DELETE. The current handlers presumably check `user_id` in app code; once the API is row-shape, RLS makes the constraint declarative.

---

## 7. Migration order (suggested)

1. **Stage 1 — read-write to both.** Update POST handlers to write to **both** the old blob *and* the new rows. Reads still hit the blob. Zero client impact.
2. **Stage 2 — switch reads.** Update GET handlers to return rows from the dedicated tables. Verify mobile clients still work.
3. **Stage 3 — flip clients.** We update `journalService.ts` and `chatService.ts` on mobile to row-shape requests. Test on staging.
4. **Stage 4 — backfill.** Run the migration SQL above to import any blob-only data that didn't get dual-written.
5. **Stage 5 — drop the JSON columns.** Final cleanup.

We can coordinate timing on each stage. Mobile is ready to flip the moment Stage 2 ships.

---

## 8. Until this is done

The mobile client uses read-modify-write against the blob, which protects single-device users from clobber. Multi-device users remain at risk. New features that depend on server-side filtering or aggregation (e.g. cross-user analytics, search-within-journal, weekly stats) cannot be built cleanly on the current architecture. Plan accordingly.

---

## 9. Stack we identified along the way

- **Backend service:** Python on Werkzeug 3.1.8 / Python 3.12.13, hosted on AWS ECS Fargate (`mellobackend-cd2a-7aac`, region `ap-south-2`).
- **Database:** Supabase Postgres (`qoxtkiainkokmlyakwgu.supabase.co`).
- **Auth:** Supabase JWTs (ES256), validated by the ECS service.
- **Tables surveyed:** `public.user_onboarding` (god-table, live), `public.chats` (dead since 2026-04-22), `public.journal_entries` (live for SQL writes, dead for API), `public.messages` (dead), plus `voice_*` and `whatsapp_*` tables (not investigated this round).

---

## Contact

Questions on this doc → mobile team.
Curl evidence + token can be reproduced on request.
