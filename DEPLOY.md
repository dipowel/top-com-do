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
| `PAYPAL_ENV` (`sandbox`/`live`), `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `VITE_PAYPAL_CLIENT_ID` | pagos PayPal |
| `BLOB_READ_WRITE_TOKEN` | subida de comprobantes |

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
