# Local flight saves and future account sync

Implemented in 1.31.0. Authentication and hosted storage are planned, not provisioned.

## Current browser save

`poly-vortex-save-v2` contains a versioned document, checksum, monotonically increasing local revision, device ID, profile, settings, current run identity, last flight, last successful extraction, last unlocked achievement and an optional full flight checkpoint. `poly-vortex-save-v2-backup` mirrors the latest committed document. The checksum detects accidental corruption; it is not an authenticity or anti-cheat mechanism. Existing v1 profile/preferences migrate without discarding credits, achievements or permanent upgrades. Legacy preferences remain readable for already open older tabs.

The engine checkpoint has its own schema version. It includes the player, selected frame and starting module, difficulty, position/velocity, weapons/upgrades, XP, score/combo, shields/Aegis cooldown, ammunition, enemies and locked salvos, bullets/rockets, mines/rovers, supplies, mission and rescue progress, reward queue and its already selected winner, encounter pacing, drone health/batteries/docking formations, independent RNG states and transient effects. Controller methods and callbacks are recreated locally rather than serialized. Input presses are cleared on load, and resume opens paused. Procedural geometry and materials are rebuilt from code.

Autosave runs about every two seconds through an idle callback, outside the render loop. Pause, pagehide and backgrounding flush synchronously; levels and mission milestones schedule an early save. The latest browser interruption is recorded when the browser delivers those events; a crash or forced process kill can lose the interval since the last successful save. The game reports actual storage/quota failures and preserves the previous valid record. A 512,000-character payload cap prevents runaway local saves. Finished flights clear both resumable copies before awarding another flight. A run identity prevents duplicate rewards, while a per-tab writer identity prevents an old tab from overwriting a flight taken over elsewhere. These local-storage checks are best effort rather than a database transaction.

Flight Log offers a JSON backup export. It also retains the last successful extraction and last achievement even if the most recent flight was lost. localStorage belongs to one browser origin: localhost, another device/browser and the published domain have separate saves. A browser that clears site data also clears the local save. Cloud sync addresses device transfer; an exported backup remains useful for recovery.

## Recommended account backend: Supabase Auth + Postgres

Keep the existing Next.js static export on GitHub Pages. Pages serves HTML/CSS/JavaScript; the browser calls Supabase for account authentication and saves. This supplies Google/GitHub OAuth and a database without a separate custom API server. The browser uses the project URL and publishable client key; provider secrets stay in the Supabase provider configuration. Each player can read/write only their own row through row-level security.

Future configuration:

1. Create the Supabase project and register Google and GitHub OAuth providers. Both providers return first to the Supabase auth callback, then redirect to a future static client route at `https://poly-vortex.oxog.dev/auth/callback/`.
2. Implement the client callback with the chosen OAuth flow, and configure the production URL and explicit local development redirect URLs.
3. Add an account save adapter that maps the local document into the cloud payload. Local writer ownership is not uploaded as account identity; the database derives the authenticated user independently.
4. On first login, retain the guest backup. If cloud progress already exists, offer an explicit choice of the device flight or cloud flight. Never combine two active simulations, add two credit balances, or grant a completed flight twice. Google/GitHub identity linking should connect providers to the same player account when requested.
5. Continue frequent local saves. Upload the latest checkpoint less frequently (for example every 20–30 seconds), and after mission/level/end-of-flight milestones and explicit pause. Keep one latest pending checkpoint offline and retry it on reconnection.
6. Use the server revision for conditional updates. An outdated device gets a conflict response and retains its local backup. Timestamps from the browser do not resolve conflicts automatically. End-of-flight reward events use a unique run ID; a future server ledger can validate purchases/rewards if stronger economy integrity is required.

Draft data contract (not deployed):

```sql
create table public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  save_schema smallint not null default 2,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.player_saves enable row level security;
create policy "read own save" on public.player_saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own save" on public.player_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own save" on public.player_saves
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.player_saves from anon;
grant select, insert, update on public.player_saves to authenticated;
```

The adapter should perform updates through an invoker-rights RPC that checks `auth.uid()`, the expected server revision, schema and payload size before updating the row and increasing its revision. Zero updated rows means a conflict, not a successful sync. The public client never receives a service-role key. This first architecture preserves single-player progress; it does not establish verified competitive scores.

## Alternative: Cloudflare Worker + D1

An API Worker on a separate subdomain can provide authenticated save endpoints with D1 rows for profiles, snapshots and idempotent reward events, while GitHub Pages continues to serve the game. This provides more control over the API and economy but requires implementing OAuth/session handling, provider callbacks, token verification, origin policy and revision conflicts. Choose it when that custom control is needed; the managed Supabase path is the smaller next step for two social providers and cross-device saves.

## Primary references

- [GitHub Pages is static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase GitHub login](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
