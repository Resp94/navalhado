# WhatsApp Integration Edge Function Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a robust Supabase Edge Function (`whatsapp-integration`) to orchestrate the integration with Evolution API Go on a VPS, handling instance management, status webhooks, notification triggers, and periodic reminders, with full Deno unit tests.

**Architecture:** A single Edge Function acting as a secure gateway, utilizing the Supabase service role client to query/update instances, formatting messages, and delegating calls to the VPS with proper API keys.

**Tech Stack:** Deno, TypeScript, Supabase Edge Functions, Postgres (Supabase).

---

### Task 1: Create Edge Function Handler (`index.ts`)

**Files:**
- Create: `supabase/functions/whatsapp-integration/index.ts`

- [ ] **Step 1: Write the Edge Function core router and handlers**
  Implement the standard Deno `serve` router matching:
  - `POST /create`: Creates an instance on the Evolution Go VPS by calling `POST /instance/create` using the global API Key (`EVOLUTION_GLOBAL_APIKEY` env var) and saving the generated api key/status in the database.
  - `GET /connect`: Retrieves QR Code & pairing code from Evolution Go VPS by calling `GET /instance/qr` using the instance API Key, and returning `{ qrcode: Qrcode, code: Code }` to the caller.
  - `POST /disconnect`: Disconnects the instance on Evolution Go VPS by calling `POST /instance/disconnect` using the instance API Key.
  - `POST /webhook`: Webhook endpoint that receives `connection.update` events from the VPS and updates the connection status in `public.evolution_api_instances`.
  - `POST /send-notification`: Triggered asynchronously by the Postgres database when appointments are created or cancelled. Validates `x-db-trigger-secret`. Retrieves appointment details and sends the formatted WhatsApp message using `POST /send/text`.
  - `POST /process-reminders`: Periodic job triggered by pg_cron. Queries pending reminders (`status='confirmed' and reminder_sent=false` and time is within `reminder_hours` of `start_time`), formats, sends messages, and updates `reminder_sent = true`.

- [ ] **Step 2: Save the file**
  Save the file at `supabase/functions/whatsapp-integration/index.ts`.

---

### Task 2: Create Deno Unit Tests (`index_test.ts`)

**Files:**
- Create: `supabase/functions/whatsapp-integration/index_test.ts`

- [ ] **Step 1: Write unit tests for all routing paths**
  Mock all external fetch requests (VPS and Supabase DB calls) using `Deno.test` and verify that the router handles each path (`/create`, `/connect`, `/disconnect`, `/webhook`, `/send-notification`, `/process-reminders`) correctly and returns appropriate status codes and payloads.

- [ ] **Step 2: Run tests with Deno**
  Run `deno test -A supabase/functions/whatsapp-integration/index_test.ts` or similar command to verify the logic.
