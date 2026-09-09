import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import { formatDOP } from '../lib/format';
import { SITE_URL } from '@shared/site';
import { COMPANY } from '@shared/company';
import SecurityBadges from '../components/common/SecurityBadges';
import Spinner from '../components/common/Spinner';

interface Receipt {
  orderNumber: string;
  createdAt: string;
  verifiedAt: string | null;
  status: 'pending' | 'verified' | 'rejected';
  method: string;
  gateway: string;
  reference: string | null;
  amountDop: number;
  currency: string;
  concept: string;
  profileId: string;
  profileName: string;
  profileHandle: string;
  authorizationCode?: string | null;
  rrn?: string | null;
  azulOrderId?: string | null;
  cardNumberMasked?: string | null;
  transactionDateTime?: string | null;
  responseMessage?: string | null;
}

const SAMPLE: Receipt = {
  orderNumber: 'TOP-20260907-A1B2C3',
  createdAt: '2026-09-07T14:32:00-04:00',
  verifiedAt: '2026-09-07T14:32:18-04:00',
  status: 'verified',
  method: 'azul',
  gateway: 'AZUL',
  reference: 'AZUL OK1234',
  amountDop: 600,
  currency: 'DOP',
  concept: 'Puja por visibilidad en el ranking — Punto Parrillada 2',
  profileId: '00000000-0000-0000-0000-000000000000',
  profileName: 'Punto Parrillada 2',
  profileHandle: 'punto-parrillada-2',
  authorizationCode: 'OK1234',
  rrn: '2026090714322000441290',
  azulOrderId: '44129088',
  cardNumberMasked: '542418******1732',
  transactionDateTime: '20260907143218',
  responseMessage: 'APROBADA',
};

const STATUS: Record<Receipt['status'], { label: string; cls: string }> = {
  pending: { label: 'Pendiente de confirmación', cls: 'text-amber-300' },
  verified: { label: 'Pagado / Verificado', cls: 'text-emerald-soft' },
  rejected: { label: 'Rechazado / Reembolsado', cls: 'text-red-300' },
};

export default function ReciboPage() {
  const { bidId } = useParams();
  const [params, setParams] = useSearchParams();
  const isSample = !bidId;
  const pago = params.get('pago');
  const procesando = pago === 'procesando' || pago === 'ok' || pago === 'verificando';

  const [receipt, setReceipt] = useState<Receipt | null>(isSample ? SAMPLE : null);
  const [loading, setLoading] = useState(!isSample);
  const [notFound, setNotFound] = useState(false);
  const reconciled = useRef(false);

  useSeo({
    title: 'Comprobante de pago | Top.com.do',
    description: 'Comprobante digital de una transacción procesada de forma segura por la pasarela AZUL.',
    canonical: `${SITE_URL}/recibo`,
    noindex: true,
  });

  const load = useCallback(async () => {
    if (!bidId) return;
    try {
      setReceipt(await api<Receipt>(`/me/bids/${bidId}`, { auth: true }));
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [bidId]);

  useEffect(() => {
    if (isSample) return;
    void load();
  }, [isSample, load]);

  // Al volver del checkout: reconciliar una vez y refrescar unos segundos.
  useEffect(() => {
    if (isSample || !procesando) return;
    if (!reconciled.current) {
      reconciled.current = true;
      api('/checkout/dodo/status', { auth: true })
        .catch(() => null)
        .finally(() => void load());
    }
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      void load();
      if (n >= 5) {
        window.clearInterval(id);
        const next = new URLSearchParams(params);
        next.delete('pago');
        setParams(next, { replace: true });
      }
    }, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSample, procesando]);

  if (loading) return <Spinner />;

  if (notFound || !receipt) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-6 text-center">
        <p className="text-sm text-white/60">
          No encontramos este comprobante o no pertenece a tu cuenta.
        </p>
        <Link to="/mis-pujas" className="btn-gold">
          Ver mis pujas
        </Link>
      </div>
    );
  }

  const st = STATUS[receipt.status];
  const fecha = new Date(receipt.createdAt).toLocaleString('es-DO', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 py-2 print:py-0">
      {isSample && (
        <div className="glass border border-gold/30 p-3 text-xs text-gold print:hidden">
          Ejemplo de comprobante. Cada pago exitoso genera uno con tus datos reales, disponible en tu
          cuenta.
        </div>
      )}
      {procesando && !isSample && (
        <div className="glass border border-gold/30 p-3 text-xs text-gold print:hidden">
          {pago === 'verificando'
            ? `Estamos verificando tu pago con ${COMPANY.paymentGateway}. Si ya pagaste, tu puja quedará confirmada en breve.`
            : `Confirmando tu pago con ${COMPANY.paymentGateway}… Esta página se actualiza sola.`}
        </div>
      )}

      <article className="glass space-y-4 p-5">
        <header className="flex items-center justify-between border-b border-white/10 pb-3">
          <img src="/logo.png" alt={COMPANY.brand} width={120} height={27} className="h-6 w-auto" />
          <div className="text-right text-[11px] text-white/45">
            Comprobante de pago
            <div className="font-mono text-xs text-white/70">{receipt.orderNumber}</div>
          </div>
        </header>

        <dl className="space-y-2 text-sm">
          <Row label="Fecha" value={fecha} />
          <Row label="Concepto" value={receipt.concept} />
          <Row
            label="Negocio"
            value={
              <Link to={`/p/${receipt.profileId}`} className="text-gold underline">
                {receipt.profileName}
              </Link>
            }
          />
          <Row
            label="Monto"
            value={<span className="text-base font-extrabold text-gold">{formatDOP(receipt.amountDop)} {receipt.currency}</span>}
          />
          <Row label="Método de pago" value={`Tarjeta — ${receipt.gateway}`} />
          {receipt.cardNumberMasked && <Row label="Tarjeta" value={receipt.cardNumberMasked} />}
          {receipt.authorizationCode && (
            <Row label="No. de aprobación" value={receipt.authorizationCode} />
          )}
          {receipt.rrn && <Row label="Referencia (RRN)" value={receipt.rrn} />}
          {receipt.azulOrderId && <Row label="Orden AZUL" value={receipt.azulOrderId} />}
          {!receipt.authorizationCode && receipt.reference && (
            <Row label="Referencia" value={receipt.reference} />
          )}
          <Row label="Estado" value={<span className={`font-semibold ${st.cls}`}>{st.label}</span>} />
        </dl>

        <div className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
          <div className="mb-1 font-semibold text-white/60">Comercio</div>
          {COMPANY.legalName} · {COMPANY.taxIdLabel}: {COMPANY.taxId}
          <br />
          {COMPANY.address.full}
          <br />
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-gold">
            {COMPANY.supportEmail}
          </a>{' '}
          · {COMPANY.phoneDisplay}
        </div>

        <p className="text-center text-[10px] text-white/35">
          Pago procesado de forma segura por {COMPANY.paymentGatewayLegal} bajo el estándar 3D Secure
          y PCI-DSS. Las pujas por el #1 son definitivas y no reembolsables una vez procesadas — ver{' '}
          <Link to="/devoluciones" className="underline">
            Devoluciones
          </Link>
          .
        </p>

        <div className="flex justify-center">
          <SecurityBadges variant="compact" />
        </div>
      </article>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button onClick={() => window.print()} className="btn-ghost flex-1 text-xs">
          🖨️ Imprimir / Guardar PDF
        </button>
        <Link to="/mis-pujas" className="btn-ghost flex-1 text-center text-xs">
          Ver todas mis pujas
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-xs uppercase tracking-wide text-white/40">{label}</dt>
      <dd className="col-span-2 text-white/85">{value}</dd>
    </div>
  );
}
