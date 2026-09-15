# Despliegue en Vercel

## Estado

- `vercel.json` configurado (build, función `/api`, SPA fallback, cron semanal).
- Esquema ya aplicado en Supabase (`npm run db:push`) + seed base.
- Driver `pg` con SSL — compatible con Vercel serverless + Supabase transaction pooler.

## Variables de entorno en Vercel

Mínimo para que funcione la API y el ranking público:

| Variable | Valor | Entornos |
|---|---|---|
| `DATABASE_URL` | la URL de Supabase (**pooler `:6543`**) | Production, Preview |
| `SUPERADMIN_EMAILS` | tu correo (admin de `/admin`) | Production, Preview |
| `CRON_SECRET` | texto largo aleatorio | Production, Preview |

Opcionales (cada función se auto-desactiva con aviso si falta):

| Variable | Para |
|---|---|
| `FIREBASE_PROJECT_ID` + `VITE_FIREBASE_*` | login (Google/Email). El server valida tokens con solo el projectId; la config web ya viene como fallback en el código. |
| `AZUL_MERCHANT_ID`, `AZUL_AUTH_KEY`, `AZUL_ENV` (`test`/`prod`) | pagos con la Página de Pago de AZUL |
| `RESEND_API_KEY`, `RESEND_FROM` | correo "Te superaron" del growth loop. Sin la key no se envía correo (la notificación in-app y el botón "Recuperar #1" siguen). Verifica el dominio `top.com.do` en Resend → Domains (pega los SPF/DKIM). `RESEND_FROM` por defecto `Top.com.do <no-reply@top.com.do>`. |

**AZUL confirma la puja de forma síncrona**, sin webhook: al volver del Payment Page, el
servidor verifica el `AuthHash` de la respuesta y marca la puja `verified` antes de redirigir a
`/recibo/:bidId`. Si una puja se queda colgada, revísala manualmente en `/admin` → Pujas
(**Verificar** / **Rechazar** en la fila).

> Las `VITE_*` se incrustan al compilar: después de agregarlas hay que **volver a desplegar**.

**SEO (Google + Bing):** el sitemap dinámico ya cubre portada, categorías, subcategorías,
categoría×provincia y perfiles activos. Da de alta `https://www.top.com.do/sitemap.xml` en
[Google Search Console](https://search.google.com/search-console) y en
[Bing Webmaster Tools](https://www.bing.com/webmasters) (Bing permite *Import from GSC*, sin
tocar código). Si quieres verificar Bing por meta, pásame el código `msvalidate.01`.

## Comandos

```bash
# 1. Autenticación (abre el navegador)
npx vercel login

# 2. Vincular la carpeta a un proyecto de Vercel (crea .vercel/)
npx vercel link

# 3. Cargar variables (ejemplo por CLI; o hazlo en el dashboard: Settings → Environment Variables)
#    Toma los valores reales de tu archivo .env local (que NO se sube al repo).
echo "<DATABASE_URL de Supabase, pooler :6543>" | npx vercel env add DATABASE_URL production
echo "<tu-correo>"                              | npx vercel env add SUPERADMIN_EMAILS production
echo "<secreto-largo-aleatorio>"               | npx vercel env add CRON_SECRET production

# 4a. Deploy de PRUEBA (preview) → devuelve una URL https://top-com-do-xxxx.vercel.app
npx vercel

# 4b. Deploy de PRODUCCIÓN
npx vercel --prod
```

## Después del deploy

- La base ya está migrada; no hay que correr `db:push` otra vez (solo si cambia el esquema).
- Prueba: abre la URL, revisa `/api/health`, el ranking, y `/admin` con tu correo de superadmin.
- El cron semanal aparece en el dashboard → Settings → Cron Jobs (solo en Production).
