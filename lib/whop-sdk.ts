import { Whop } from "@whop/sdk";

/** @see https://docs.whop.com/developer/guides/webhooks#validating-webhooks */
export const whopsdk = new Whop({
	appID: process.env.NEXT_PUBLIC_WHOP_APP_ID,
	apiKey: process.env.WHOP_API_KEY,
	webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ""),
});
