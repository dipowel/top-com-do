const apiBase = (): string =>
  process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new Error('Credenciales de PayPal no configuradas');

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth falló (${res.status})`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function createOrder(usd: number, referenceId: string): Promise<{ id: string; status: string }> {
  const token = await accessToken();

  // Cuenta que recibe el dinero. Si PAYPAL_PAYEE_EMAIL está definido se fuerza
  // ese destinatario; si no, los fondos van a la cuenta dueña de las credenciales API.
  const payeeEmail = process.env.PAYPAL_PAYEE_EMAIL?.trim();

  const purchaseUnit: Record<string, unknown> = {
    reference_id: referenceId,
    description: 'Puja de visibilidad - Top.com.do',
    amount: { currency_code: 'USD', value: usd.toFixed(2) },
  };
  if (payeeEmail) purchaseUnit.payee = { email_address: payeeEmail };

  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [purchaseUnit],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`PayPal create order: ${JSON.stringify(json)}`);
  return json as { id: string; status: string };
}

export async function captureOrder(orderId: string): Promise<any> {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`PayPal capture: ${JSON.stringify(json)}`);
  return json;
}
