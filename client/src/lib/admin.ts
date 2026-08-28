/**
 * Correos con privilegios de administrador reconocidos en el CLIENTE.
 * Solo controla que la UI de administración se muestre aunque `/api/me`
 * tarde o falle. El servidor tiene su propia lista (SUPERADMIN_EMAILS +
 * fallback en server/middleware/auth.ts) que es la que realmente autoriza.
 */
const HARDCODED_ADMINS = ['dpowelsantana15@gmail.com', 'dipowelsantana15@gmail.com'];

const fromEnv = (import.meta.env.VITE_SUPERADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAILS = new Set<string>([...HARDCODED_ADMINS, ...fromEnv]);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
