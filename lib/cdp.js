import { generateJwt } from "@coinbase/cdp-sdk/auth";

const API_BASE = "https://api.cdp.coinbase.com/platform";

async function getJWT(method, path) {
  return generateJwt({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    requestMethod: method,
    requestHost: "api.cdp.coinbase.com",
    requestPath: path,
    expiresIn: 120,
  });
}

export async function createApplePayOrder({
  amount = "25.00",
  currency = "USD",
  purchaseCurrency = "USDC",
  network = "base",
} = {}) {
  const jwt = await getJWT("POST", "/platform/v2/onramp/orders");

  const body = {
    paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
    paymentAmount: amount,
    paymentCurrency: currency,
    purchaseCurrency,
    destinationAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    destinationNetwork: network,
    phoneNumber: "+12345678901",
    phoneNumberVerifiedAt: new Date().toISOString(),
    email: "test@example.com",
    agreementAcceptedAt: new Date().toISOString(),
    partnerUserRef: "sandbox-compat-" + Date.now(),
    partnerOrderRef: "order-compat-" + Date.now(),
    isQuote: false,
  };

  const res = await fetch(`${API_BASE}/v2/onramp/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`CDP API returned non-JSON: ${res.status} ${text}`);
  }

  if (!res.ok) {
    throw new Error(
      data.errorMessage || data.message || `CDP API error: ${res.status}`
    );
  }

  return {
    url: data.paymentLink?.url,
    orderId: data.order?.orderId,
    status: data.order?.status,
    paymentTotal: data.order?.paymentTotal,
    purchaseAmount: data.order?.purchaseAmount,
    fees: data.order?.fees,
  };
}

export async function createHostedSession({
  amount = "25.00",
  currency = "USD",
  purchaseCurrency = "USDC",
  network = "base",
} = {}) {
  const jwt = await getJWT("POST", "/platform/v2/onramp/sessions");

  const body = {
    destinationAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    purchaseCurrency,
    destinationNetwork: network,
    paymentAmount: amount,
    paymentCurrency: currency,
  };

  const res = await fetch(`${API_BASE}/v2/onramp/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`CDP API returned non-JSON: ${res.status} ${text}`);
  }

  if (!res.ok) {
    throw new Error(
      data.errorMessage || data.message || `CDP API error: ${res.status}`
    );
  }

  return {
    url: data.session?.onrampUrl,
  };
}
