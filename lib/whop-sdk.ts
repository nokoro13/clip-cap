import { Whop } from "@whop/sdk";

export function getWhopClient() {
	const appID = process.env.NEXT_PUBLIC_WHOP_APP_ID;
	const apiKey = process.env.WHOP_API_KEY;
	const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;

	if (!appID || !apiKey || !webhookSecret) {
		throw new Error(
			"Whop environment variables are not set. Please configure NEXT_PUBLIC_WHOP_APP_ID, WHOP_API_KEY, and WHOP_WEBHOOK_SECRET.",
		);
	}

	return new Whop({
		appID,
		apiKey,
		webhookKey: btoa(webhookSecret),
	});
}
