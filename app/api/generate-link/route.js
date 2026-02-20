import { createApplePayOrder, createHostedSession } from "@/lib/cdp";

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, amount, currency, purchaseCurrency, network } = body;

    const opts = {
      amount: amount || "25.00",
      currency: currency || "USD",
      purchaseCurrency: purchaseCurrency || "USDC",
      network: network || "base",
    };

    let result;

    if (type === "hosted") {
      result = await createHostedSession(opts);
      return Response.json({ ...result, type: "hosted" });
    } else {
      result = await createApplePayOrder(opts);
      return Response.json({ ...result, type: "apple_pay" });
    }
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to generate link" },
      { status: 500 }
    );
  }
}
