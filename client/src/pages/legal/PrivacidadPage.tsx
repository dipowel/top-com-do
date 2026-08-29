import LegalLayout from './LegalLayout';

export default function PrivacidadPage() {
  return (
    <LegalLayout
      title="Política de Privacidad"
      description="Cómo Top.com.do recopila y protege tus datos, y cómo Dodo Payments procesa los pagos cifrados. Derechos conforme a la Ley 172-13 de la República Dominicana."
      path="/privacidad"
    >
      <p>
        Esta Política explica qué datos trata <strong>Top.com.do</strong>, con qué fin y qué
        derechos tienes, conforme a la <strong>Ley No. 172-13</strong> sobre Protección de Datos de
        Carácter Personal de la República Dominicana.
      </p>

      <h2>1. Datos que recopilamos</h2>
      <ul>
        <li>
          <strong>Cuenta:</strong> nombre, correo electrónico y foto de perfil (a través de
          Firebase Authentication de Google).
        </li>
        <li>
          <strong>Negocio:</strong> nombre comercial, categoría, provincia, dirección, enlaces de
          contacto y, si lo autorizas, coordenadas GPS para "Cómo llegar".
        </li>
        <li>
          <strong>Pujas:</strong> monto, fecha, método y estado. Los datos de pago (tarjeta) los
          maneja exclusivamente Dodo Payments; nosotros no los vemos ni los guardamos.
        </li>
        <li>
          <strong>Reseñas y antifraude:</strong> tu calificación y comentario, y un{' '}
          <strong>hash irreversible de tu dirección IP</strong> (nunca la IP en claro) para limitar
          el fraude y el "review bombing".
        </li>
        <li>
          <strong>Uso técnico:</strong> almacenamiento local mínimo en el navegador para recordar
          preferencias e invitaciones de referido.
        </li>
      </ul>

      <h2>2. Finalidad y base legal</h2>
      <p>
        Usamos los datos para operar el directorio y la subasta, prevenir fraude, atender soporte y
        cumplir obligaciones legales. La base es la <strong>ejecución del servicio</strong> que
        solicitas y tu <strong>consentimiento</strong> (por ejemplo, para la ubicación GPS).
      </p>

      <h2>3. Pagos</h2>
      <p>
        Las transacciones se procesan de forma <strong>cifrada mediante Dodo Payments</strong>,
        que actúa como <em>merchant of record</em>. Top.com.do{' '}
        <strong>no almacena números de tarjeta ni credenciales bancarias</strong>. Consulta la
        política de privacidad de Dodo Payments para el tratamiento que realiza el procesador.
      </p>

      <h2>4. Con quién se comparten</h2>
      <ul>
        <li>Proveedores de infraestructura: Vercel (hosting) y Supabase (base de datos).</li>
        <li>Autenticación: Firebase (Google).</li>
        <li>Pagos: Dodo Payments.</li>
        <li>Autoridades, cuando exista una obligación legal.</li>
      </ul>
      <p>No vendemos datos personales.</p>

      <h2>5. Conservación</h2>
      <p>
        Conservamos los datos mientras la cuenta esté activa y el tiempo adicional que exijan las
        obligaciones contables y legales. Los hashes de IP se conservan solo el tiempo necesario
        para los controles antifraude.
      </p>

      <h2>6. Tus derechos</h2>
      <p>
        Puedes solicitar acceso, rectificación, actualización o supresión de tus datos, así como
        oponerte a ciertos tratamientos, escribiendo a{' '}
        <a href="mailto:privacidad@top.com.do">privacidad@top.com.do</a>.
      </p>

      <h2>7. Responsable</h2>
      <p>
        Responsable del tratamiento: Top.com.do (marca registrada en la ONAPI), República
        Dominicana. Contacto: <a href="mailto:privacidad@top.com.do">privacidad@top.com.do</a>.
      </p>
    </LegalLayout>
  );
}
