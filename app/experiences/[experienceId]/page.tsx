import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { QuickStartCards } from "@/components/quick-start-cards";
import { RecentProjectsGallery } from "@/components/recent-projects-gallery";
import { getUserUsageDisplay } from "@/lib/user-service";

export default async function ExperiencePage({
	params,
}: {
	params: Promise<{ experienceId: string }>;
}) {
	const { experienceId } = await params;
	// Ensure the user is logged in on whop.
	const { userId } = await whopsdk.verifyUserToken(await headers());

	// Fetch the neccessary data we want from whop.
	const [experience, user] = await Promise.all([
		whopsdk.experiences.retrieve(experienceId),
		whopsdk.users.retrieve(userId),
	]);

	const displayName = user.name || `@${user.username}`;

	const premiumProductId = process.env.NEXT_PUBLIC_WHOP_PREMIUM_PRODUCT_ID;
	const basicProductId = process.env.NEXT_PUBLIC_WHOP_PRODUCT_ID;
	const basicCheckoutUrl = process.env.NEXT_PUBLIC_BASIC_CHECKOUT_URL;
	const premiumCheckoutUrl = process.env.NEXT_PUBLIC_PREMIUM_CHECKOUT_URL;
	if (!premiumProductId) {
		throw new Error("NEXT_PUBLIC_WHOP_PREMIUM_PRODUCT_ID is not set");
	}

	const [premiumAccess, basicAccess] = await Promise.all([
		whopsdk.users.checkAccess(premiumProductId, { id: userId }),
		basicProductId
			? whopsdk.users.checkAccess(basicProductId, { id: userId })
			: Promise.resolve({ has_access: false }),
	]);

	const productAccess = {
		has_access: premiumAccess.has_access || basicAccess.has_access,
	};

	const accessLevel = premiumAccess.has_access
		? ("premium" as const)
		: basicAccess.has_access
			? ("basic" as const)
			: null;

	const usageStats = productAccess.has_access
		? await getUserUsageDisplay(userId)
		: null;

	return (
		<div className="flex flex-col p-8 gap-6">
			<div className="flex justify-between items-center gap-4">
				<h1 className="text-9">
					Hi <strong>{displayName}</strong>!
					Welcome to <strong>{experience.name}</strong>.
				</h1>
			</div>

			{productAccess.has_access ? (
				<p className="text-3 text-green-10">
					You have <strong>{accessLevel === "premium" ? "Premium" : "Basic"}</strong>{" "}
					access.
					{usageStats ? (
						<>
							{" "}
							Subtitles: {usageStats.generateSubtitles.used}/
							{usageStats.generateSubtitles.limit} this month
							{accessLevel === "premium"
								? ` · Bulk: ${usageStats.bulkGenerate.used}/${usageStats.bulkGenerate.limit}`
								: ""}
							.
						</>
					) : null}
				</p>
			) : (
				<p className="text-3 text-red-10">You do not have access to the premium features.</p>
			)}
			<p className="text-3 text-gray-10">
				Upload a video to generate AI-powered subtitles, or bulk process multiple videos at once.
			</p>

			<QuickStartCards
				hasAccess={productAccess.has_access}
				accessLevel={accessLevel}
				usageStats={usageStats}
				basicCheckoutUrl={basicCheckoutUrl}
				premiumCheckoutUrl={premiumCheckoutUrl}
			/>
			<RecentProjectsGallery experienceId={experienceId} />

			{/* <h3 className="text-6 font-bold">Experience data</h3>
			<JsonViewer data={experience} />

			<h3 className="text-6 font-bold">User data</h3>
			<JsonViewer data={user} />

			<h3 className="text-6 font-bold">Access data</h3>
			*/}
		</div>
	);
}

// function JsonViewer({ data }: { data: any }) {
// 	return (
// 		<pre className="text-2 border border-gray-a4 rounded-lg p-4 bg-gray-a2 max-h-72 overflow-y-auto">
// 			<code className="text-gray-10">{JSON.stringify(data, null, 2)}</code>
// 		</pre>
// 	);
// }