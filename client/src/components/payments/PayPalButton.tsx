import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { api } from '../../lib/api';

export default function PayPalButton({
  bidId,
  onVerified,
}: {
  bidId: string;
  onVerified: () => void;
}) {
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
  if (!clientId) {
    return <p className="text-xs text-white/40">PayPal no está configurado (VITE_PAYPAL_CLIENT_ID).</p>;
  }

  return (
    <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'capture' }}>
      <PayPalButtons
        style={{ layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay' }}
        createOrder={async () => {
          const { orderId } = await api<{ orderId: string }>('/payments/paypal/create-order', {
            method: 'POST',
            body: JSON.stringify({ bidId }),
            auth: true,
          });
          return orderId;
        }}
        onApprove={async (data) => {
          const res = await api<{ verified: boolean }>('/payments/paypal/capture', {
            method: 'POST',
            body: JSON.stringify({ orderId: data.orderID }),
            auth: true,
          });
          if (res.verified) onVerified();
        }}
      />
    </PayPalScriptProvider>
  );
}
