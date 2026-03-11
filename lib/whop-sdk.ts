import { Whop } from "@whop/sdk";

export type WhopSDK = InstanceType<typeof Whop>;

let _whopsdk: WhopSDK | null = null;

/**
 * Lazy-initialized Whop client so next build does not require env vars at build time.
 */
export function getWhopsdk(): WhopSDK {
	if (!_whopsdk) {
		const apiKey = process.env.WHOP_API_KEY;
		if (!apiKey) {
			throw new Error(
				"The WHOP_API_KEY environment variable is missing or empty; either provide it, or instantiate the Whop client with an apiKey option, like new Whop({ apiKey: 'My API Key' })."
			);
		}
		_whopsdk = new Whop({
			appID: process.env.NEXT_PUBLIC_WHOP_APP_ID,
			apiKey,
			webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ""),
		});
	}
	return _whopsdk;
}
