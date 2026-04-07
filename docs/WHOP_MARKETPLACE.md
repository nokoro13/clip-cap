# Whop marketplace: webhooks and permissions

Use this when configuring the app for Whop marketplace review. ClipCap uses `/api/webhooks` ([`app/api/webhooks/route.ts`](../app/api/webhooks/route.ts)) for `membership.activated`, `membership.deactivated`, and `payment.succeeded`.

## Company webhooks vs app webhooks

- **Company webhooks** receive events for the **company that creates the webhook** (e.g. your company’s memberships and payments). They do **not** require app-level `webhook_receive:*` permissions. See [Whop webhooks guide](https://docs.whop.com/developer/guides/webhooks).
- **App webhooks** receive events for **every company where your app is installed** and require matching `webhook_receive:*` permissions.

For marketplace **least-privilege** review, prefer **company webhooks** when your billing/sync logic only needs events for products on **your** company. Other creators can still install your app; they point their own company webhook at your URL if they sell access on their company and need the same events (or you document a single setup path Whop accepts).

### Switch to company webhooks (dashboard steps)

1. Open [Whop Developer](https://whop.com/dashboard/developer) — use the **base developer** area where you manage your **company**, not only the app-scoped webhook table if you are removing app webhooks.
2. Click **Create Webhook** (company webhook).
3. Set **URL** to your deployed endpoint, e.g. `https://<your-domain>/api/webhooks`.
4. Use API version **v1**.
5. Subscribe at minimum to: `membership.activated`, `membership.deactivated`, `payment.succeeded` (match what your code handles).
6. Copy the webhook **signing secret** and set `WHOP_WEBHOOK_SECRET` in your environment (same variable used in [`lib/whop-sdk.ts`](../lib/whop-sdk.ts) — Whop docs may refer to this as `WHOP_WEBHOOK_KEY`).
7. **Remove or disable** the overlapping **app** webhook in the app dashboard if you no longer need cross-install events, so you are not requesting unnecessary `webhook_receive:*` permissions.

## Permissions to remove (marketplace hygiene)

Whop may reject apps that request scopes without a clear, minimal justification. Remove any permission you do not need for an **actual** server or client call documented in the [Whop API reference](https://docs.whop.com/api-reference).

The following were called out in review as **not appropriate** for this use case; **remove** them from the app’s Permissions tab unless you add code that strictly requires them:

| Permission |
|------------|
| `checkout_configuration:basic:read` |
| `checkout_configuration:create` |
| `access_pass:create` |
| `access_pass:update` |
| `access_pass:basic:read` |
| `plan:create` |
| `plan:basic:read` |
| `member:basic:read` |
| `member:email:read` |
| `member:phone:read` |
| `webhook_receive:payments` |
| `webhook_receive:app_memberships` |
| `webhook_receive:memberships` |
| `payment:basic:read` |
| `promo_code:basic:read` |
| `payment:dispute:read` |
| `payment:resolution_center_case:read` |

After trimming permissions, re-check every remaining scope against:

- `whopsdk.verifyUserToken`
- `whopsdk.users.checkAccess` / `whopsdk.users.retrieve`
- `whopsdk.experiences.retrieve`
- `whopsdk.companies.retrieve` (if you keep the dashboard template)
- `whopsdk.memberships.retrieve` (only if still required by webhook handlers)

Re-submit with short **justifications** for each remaining permission tied to a concrete feature.

## Product reliability (usage after bulk generate)

Bulk usage is incremented only after async analysis **completes successfully** in [`app/api/analyze-viral-async/route.ts`](../app/api/analyze-viral-async/route.ts), so failed runs should not consume a bulk slot.

## Billing transparency (creators)

Member-facing pricing and Whop as processor are disclosed in [`components/subscribe-dialog.tsx`](../components/subscribe-dialog.tsx). Keep in-app copy aligned with live plan prices on Whop.
