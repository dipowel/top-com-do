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
| `DODO_ENV` (`test`/`live`), `DODO_API_KEY`, `DODO_WEBHOOK_SECRET` | pagos con Dodo Payments |
| `DODO_PRODUCT_ID` | producto base *pay-what-you-want* en Dodo (mínimo RD$100, DOP). Por defecto `pdt_0NmSUGwTYDHQKdpmPVTI` |

**Webhook (obligatorio para que la puja pase de `pending` a `verified` sola):** en Dodo →
Settings → Webhooks, registra `https://www.top.com.do/api/webhooks/dodo` (evento
`payment.succeeded`) y copia el *signing secret* de ESE endpoint en `DODO_WEBHOOK_SECRET` → Redeploy.
Verifica con `GET /api/webhooks/dodo` (debe responder `{"ok":true}`).
Si una puja se queda colgada: `/admin` → Pujas → **🔄 Reconciliar pagos Dodo** (consulta a Dodo y
acredita sin depender del webhook), o **Verificar** manual en la fila.

> Las `VITE_*` se incrustan al compilar: después de agregarlas hay que **volver a desplegar**.

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
