# Top.com.do

Plataforma de subastas de visibilidad, ego y marcas para la República Dominicana.

- **Frontend:** React + Vite + TypeScript + Tailwind (SPA, estética de lujo: fondo `#070b14`,
  cristal esmerilado, acentos dorado / esmeralda, tipografía Plus Jakarta Sans).
- **Backend:** Express (`server/`) + Drizzle ORM sobre **PostgreSQL** (driver `pg` con SSL —
  **Supabase**, Neon, RDS, etc.).
- **Auth:** Firebase Authentication (Google + Email/Password). El servidor verifica los ID tokens
  contra las claves públicas de Google con `jose` — solo necesita `FIREBASE_PROJECT_ID`, sin service account.
- **Pagos:** Transferencias locales (Banreservas, Banco Popular, BHD, Qik) con comprobante +
  PayPal REST v2 (USD, tasa fija `1 USD = 59.50 DOP`).
- **Deploy:** Vercel (SPA estática + función serverless para `/api/*`).

---

## 1. Estructura

```
top-com-do/
├─ api/index.ts          Entry serverless de Vercel (reexporta el app de Express)
├─ server/               API Express
│  ├─ server.ts          Entry local (app.listen)
│  ├─ app.ts             App de Express (rutas + middlewares)
│  ├─ db.ts              Drizzle + pg (Pool con SSL)
│  ├─ seed.ts            Categorías, cuentas bancarias y ronda inicial
│  ├─ middleware/        noStore · auth (Firebase) · errorHandler
│  ├─ lib/               rankings · rounds · paypal · storage (Blob) · audit
│  └─ routes/            categories · rankings · profiles · bank-accounts · bids
│                        · uploads · payments · me · admin · cron
├─ shared/               Código compartido cliente/servidor
│  ├─ schema.ts          Esquema Drizzle (PostgreSQL)
│  ├─ types.ts           Tipos de la API
│  └─ fx.ts              Tasa fija USD→DOP y formateadores
├─ client/               SPA React (Vite)
│  └─ src/
│     ├─ hooks/          useAuth · useRankings (polling) · useFavorites · useMyBids …
│     ├─ components/     layout · ranking · bid · payments · share · common
│     ├─ pages/          Ranking · Explorar · MisPujas · Favoritos · Perfil · Detalle · Login
│     └─ admin/          Panel /admin (comprobantes, auditoría, cuentas, rondas, log)
├─ drizzle/              Migraciones generadas
├─ vercel.json           Build, rewrites y cron semanal
└─ .env.example
```

## 2. Requisitos previos

| Servicio | Qué necesitas |
|---|---|
| **PostgreSQL** | `DATABASE_URL` de Supabase o Neon. Con Supabase usa el *transaction pooler* (`:6543`); `db:push` cambia solo a `:5432` para migrar. |
| **Firebase** | Proyecto web + proveedores Google y Email/Password habilitados. Solo la config web (`VITE_FIREBASE_*`) y `FIREBASE_PROJECT_ID`. **No hace falta service account.** |
| **PayPal** | App REST (sandbox y live): `client id` y `secret`. |
| **Vercel Blob** | `BLOB_READ_WRITE_TOKEN` (Storage → Blob en el dashboard de Vercel). |

## 3. Puesta en marcha (local)

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env  — completa DATABASE_URL y VITE_FIREBASE_*

npm run db:push               # crea las tablas
npm run seed                  # categorías + cuentas bancarias + ronda activa (solo base)
npm run seed:demo             # opcional: + 8 perfiles de demostración con pujas
npm run dev                   # API en :3000, web en :5173 (proxy /api)
```

Firebase: copia la config web (Consola → Configuración del proyecto → Tus apps) a las
variables `VITE_FIREBASE_*` y pon `FIREBASE_PROJECT_ID` con el mismo `projectId`.
El servidor valida los tokens contra las claves públicas de Google; no necesita clave privada.

## 4. Pruebas

```bash
npm test          # vitest: conversión de divisas + API base (health, no-store, 401, 404)
npm run typecheck # tsc --noEmit
```

## 5. Flujo de negocio

1. Un visitante (incluido incógnito) abre `/` → `GET /api/rankings` consulta PostgreSQL,
   suma las **pujas verificadas** de la ronda activa por perfil, filtra `> 0 DOP` y ordena.
   Respuesta siempre `Cache-Control: no-store`. Nada del ranking se guarda en `localStorage`.
2. El usuario inicia sesión (Firebase) y pulsa **Pujar Ahora**:
   - **Transferencia:** se crea la puja `pending`, copia el número de cuenta, sube el comprobante
     (se comprime en el móvil; validación tolerante para Safari/Chrome). Un admin la aprueba en `/admin`.
   - **PayPal:** paga en USD (`monto DOP / 59.5`). Al capturar la orden, la puja pasa a `verified`
     automáticamente y aparece en el ranking en el siguiente refresco (~15 s).
3. `/admin` (solo `SUPERADMIN_EMAILS`): resumen, cola de comprobantes, auditoría de pujas,
   edición de cuentas bancarias, log y **reinicio de ronda semanal desde el #1**.

## 6. Deploy en Vercel

```bash
npm i -g vercel
vercel            # vincula el proyecto
```

1. **Environment Variables** (Project → Settings): copia todas las claves de `.env`
   (usa PayPal *live* y la `DATABASE_URL` de producción). Las `VITE_*` deben estar en
   *Build & Deploy* también.
2. Ejecuta las migraciones contra la BD de producción:
   ```bash
   DATABASE_URL="<prod>" npm run db:push
   DATABASE_URL="<prod>" npm run seed
   ```
   Con Supabase, `DATABASE_URL` en Vercel debe ser el *transaction pooler* (`:6543`).
3. `vercel --prod`.
4. `vercel.json` ya configura:
   - `rewrites`: `/api/*` → función serverless; el resto → `index.html` (SPA).
   - `crons`: `0 5 * * 1` (lunes) → `GET /api/cron/reset-round`, protegido con `CRON_SECRET`
     (Vercel envía `Authorization: Bearer $CRON_SECRET`).

## 7. Notas

- **Límite de subida en Vercel:** el cuerpo de una función serverless (plan Hobby) es ~4.5 MB.
  El cliente comprime las imágenes a ≈1 MB antes de enviarlas, así que los comprobantes entran sin
  problema. Para PDFs muy grandes, sube el plan o migra `server/lib/storage.ts` a subida directa a Blob.
- **Cambiar de proveedor de almacenamiento:** todo pasa por `server/lib/storage.ts`.
- **Roles:** cualquier correo en `SUPERADMIN_EMAILS` se marca `superadmin` en su primer login.
- **Tasa de cambio:** única fuente de verdad en `shared/fx.ts` (`FX_USD_DOP = 59.5`).
