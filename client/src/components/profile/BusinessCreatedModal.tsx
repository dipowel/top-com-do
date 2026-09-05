import Modal from '../common/Modal';
import { formatDOP } from '../../lib/format';
import { categoryLabel } from '@shared/seo';
import { provinceName } from '@shared/provinces';
import { MIN_BID_DOP } from '@shared/bidding';

export interface CreatedBusiness {
  id: string;
  name: string;
  categorySlug: string;
  province: string;
}

/** Éxito de registro: felicita y ofrece el siguiente paso natural (activar la puja). */
export default function BusinessCreatedModal({
  business,
  onActivateBid,
  onDismiss,
}: {
  business: CreatedBusiness;
  onActivateBid: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal title="🎉 ¡Tu negocio ya está en Top!" onClose={onDismiss}>
      <div className="space-y-4 text-center">
        <p className="text-sm text-white/70">
          <b className="text-white">{business.name}</b> ya está en el directorio
          {business.categorySlug && <> de {categoryLabel(business.categorySlug)}</>}
          {business.province && <> · {provinceName(business.province)}</>}. Ahora tus clientes pueden
          encontrarte.
        </p>
        <div className="rounded-2xl border border-gold/25 bg-gold/[0.06] p-3 text-left">
          <p className="text-[13px] font-semibold text-white">¿Quieres aparecer entre los primeros?</p>
          <p className="mt-0.5 text-xs text-white/55">
            Activa tu puja desde {formatDOP(MIN_BID_DOP)} y compite por el #1 de tu categoría y
            provincia.
          </p>
        </div>
        <button onClick={onActivateBid} className="btn-gold w-full !py-3.5 text-sm">
          ⚡ Activar mi puja ahora
        </button>
        <button onClick={onDismiss} className="block w-full text-xs text-white/50 underline">
          Seguir gratis por ahora
        </button>
      </div>
    </Modal>
  );
}
