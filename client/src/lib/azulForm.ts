/**
 * Envía al navegador a la Página de Pago de AZUL mediante un POST de formulario
 * (navegación top-level cross-origin — permitida). AZUL exige que el POST lo haga
 * el navegador del cliente, no el servidor.
 */
export function submitAzulForm(actionUrl: string, fields: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  form.style.display = 'none';
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value ?? '';
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
