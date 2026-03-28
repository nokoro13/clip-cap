import { waitUntil } from "@vercel/functions";
import type { NextRequest } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import {
	handleMembershipActivated,
	handleMembershipDeactivated,
	handlePaymentSucceededForUsage,
} from "@/lib/whop-webhook-sync";

/**
 * Whop webhooks ([guide](https://docs.whop.com/developer/guides/webhooks)).
 * Subscribe to `membership.activated`, `membership.deactivated`, and `payment.succeeded`
 * for your app; request `webhook_receive:memberships` (and payment scopes as needed).
 */
export async function POST(request: NextRequest): Promise<Response> {
	const requestBodyText = await request.text();
	const headers = Object.fromEntries(request.headers);

	let webhookData: ReturnType<typeof whopsdk.webhooks.unwrap>;
	try {
		webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });
	} catch (err) {
		console.error(
			"[whop webhook] verify failed — use WHOP_WEBHOOK_SECRET from the Whop app webhook settings",
			err,
		);
		return new Response("Invalid webhook signature", { status: 401 });
	}

	switch (webhookData.type) {
		case "membership.activated":
			waitUntil(
				runSafe("membership.activated", () => handleMembershipActivated(webhookData.data)),
			);
			break;
		case "membership.deactivated":
			waitUntil(
				runSafe("membership.deactivated", () =>
					handleMembershipDeactivated(webhookData.data),
				),
			);
			break;
		case "payment.succeeded":
			waitUntil(
				runSafe("payment.succeeded", () => handlePaymentSucceededForUsage(webhookData.data)),
			);
			break;
		default:
			break;
	}

	return new Response("OK", { status: 200 });
}

async function runSafe(label: string, fn: () => Promise<void>): Promise<void> {
	try {
		await fn();
	} catch (err) {
		console.error(`[whop webhook ${label}]`, err);
	}
}
