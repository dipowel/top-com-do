import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ---------------- Enums ----------------
export const userRole = pgEnum('user_role', ['user', 'admin', 'superadmin']);
// 'dodo' = pago con Dodo Payments (procesador actual). 'bank_transfer'/'paypal' se
// conservan solo para pujas históricas; ya no se emiten pujas nuevas con esos métodos.
export const bidMethod = pgEnum('bid_method', ['bank_transfer', 'paypal', 'credit', 'dodo']);
export const bidStatus = pgEnum('bid_status', ['pending', 'verified', 'rejected']);
export const currencyEnum = pgEnum('currency', ['DOP', 'USD']);
export const referralStatus = pgEnum('referral_status', ['pending', 'eligible', 'approved', 'rejected']);
export const reviewStatus = pgEnum('review_status', ['published', 'flagged', 'hidden']);
// Tipo de cuenta: consumidor (usuario de a pie) vs comerciante (dueño de negocio) vs admin.
// Ortogonal a `role` (que gobierna los permisos): distingue el flujo/UI del usuario.
export const accountType = pgEnum('account_type', ['consumer', 'merchant', 'admin']);

// ---------------- Empleos ----------------
export const jobType = pgEnum('job_type', [
  'full_time',
  'part_time',
  'temporary',
  'internship',
  'freelance',
  'contract',
]);
export const workMode = pgEnum('work_mode', ['onsite', 'hybrid', 'remote']);
export const salaryPeriod = pgEnum('salary_period', [
  'monthly',
  'weekly',
  'daily',
  'hourly',
  'negotiable',
]);
// `is_active` del prompt = status='published'. Los demás conservan histórico sin re-generar SEO:
//  - draft: borrador del autor, nunca fue público
//  - pending_review: importado, a la espera de moderación (no público)
//  - possible_duplicate: la deduplicación lo marcó como posible repetido (no público)
//  - expired: venció su validThrough → lápida 410
//  - removed: desapareció de la fuente o lo retiró un admin → lápida 410
//  - closed: el dueño lo cerró → lápida 410
export const jobStatus = pgEnum('job_status', [
  'draft',
  'pending_review',
  'possible_duplicate',
  'published',
  'expired',
  'removed',
  'closed',
]);
export const sourceType = pgEnum('source_type', ['direct', 'ats', 'api', 'feed', 'partner']);
export const sourceAuth = pgEnum('source_auth', ['none', 'requested', 'authorized', 'denied']);

// ---------------- Tablas ----------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  whatsapp: text('whatsapp'),
  role: userRole('role').notNull().default('user'),
  accountType: accountType('account_type').notNull().default('consumer'),
  referralCode: text('referral_code').unique(),
  referredByCode: text('referred_by_code'),
  creditBalanceDop: numeric('credit_balance_dop', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    handle: text('handle').notNull().unique(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    tagline: text('tagline'),
    subcategory: text('subcategory'),
    whatsapp: text('whatsapp'),
    instagramUrl: text('instagram_url'),
    websiteUrl: text('website_url'),
    province: text('province'), // slug de shared/provinces.ts (demarcación de RD)
    city: text('city'),
    address: text('address'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCategory: index('profiles_category_idx').on(t.categoryId),
    byProvince: index('profiles_province_idx').on(t.province),
  }),
);

export const rounds = pgTable('rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekStart: timestamp('week_start', { withTimezone: true }).notNull(),
  weekEnd: timestamp('week_end', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  resetByUserId: uuid('reset_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bids = pgTable(
  'bids',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id),
    amountDop: numeric('amount_dop', { precision: 12, scale: 2 }).notNull(),
    currency: currencyEnum('currency').notNull().default('DOP'),
    amountOriginal: numeric('amount_original', { precision: 12, scale: 2 }).notNull(),
    fxRate: numeric('fx_rate', { precision: 10, scale: 4 }).notNull(),
    method: bidMethod('method').notNull(),
    status: bidStatus('status').notNull().default('pending'),
    reference: text('reference'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
  },
  (t) => ({
    byProfile: index('bids_profile_idx').on(t.profileId),
    byRound: index('bids_round_idx').on(t.roundId),
    byStatus: index('bids_status_idx').on(t.status),
    byUser: index('bids_user_idx').on(t.userId),
  }),
);

export const paymentReceipts = pgTable('payment_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  bidId: uuid('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileMime: text('file_mime'),
  fileSize: integer('file_size'),
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Sesiones de checkout de Dodo Payments (una por intento de pago de una puja). */
export const dodoPayments = pgTable(
  'dodo_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bidId: uuid('bid_id')
      .notNull()
      .references(() => bids.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    paymentId: text('payment_id'),
    status: text('status').notNull().default('created'), // created | succeeded | failed
    amountDop: numeric('amount_dop', { precision: 12, scale: 2 }).notNull().default('0'),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byBid: index('dodo_payments_bid_idx').on(t.bidId),
    byPayment: uniqueIndex('dodo_payments_payment_uniq').on(t.paymentId),
  }),
);

export const paypalOrders = pgTable('paypal_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  bidId: uuid('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  paypalOrderId: text('paypal_order_id').notNull().unique(),
  captureId: text('capture_id'),
  status: text('status').notNull(),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  bankName: text('bank_name').notNull(),
  accountHolder: text('account_holder').notNull(),
  accountNumber: text('account_number').notNull(),
  accountType: text('account_type'),
  currency: currencyEnum('currency').notNull().default('DOP'),
  instructions: text('instructions'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('favorites_user_profile_uniq').on(t.userId, t.profileId),
  }),
);

// ---------------- Referidos ----------------
export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerUserId: uuid('referrer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    referredUserId: uuid('referred_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: referralStatus('status').notNull().default('pending'),
    bonusDop: numeric('bonus_dop', { precision: 12, scale: 2 }).notNull().default('100'),
    triggeringBidId: uuid('triggering_bid_id').references(() => bids.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
  },
  (t) => ({
    uniqReferred: uniqueIndex('referrals_referred_uniq').on(t.referredUserId),
    byReferrer: index('referrals_referrer_idx').on(t.referrerUserId),
  }),
);

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amountDop: numeric('amount_dop', { precision: 12, scale: 2 }).notNull(), // + suma, - resta
  type: text('type').notNull(), // referral_bonus | bid_payment | admin_adjust
  refId: text('ref_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------- Reseñas ----------------
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(), // 1..5
    comment: text('comment'),
    status: reviewStatus('status').notNull().default('published'),
    ownerReply: text('owner_reply'),
    ownerReplyAt: timestamp('owner_reply_at', { withTimezone: true }),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqPerUser: uniqueIndex('reviews_profile_user_uniq').on(t.profileId, t.userId),
    byProfile: index('reviews_profile_idx').on(t.profileId, t.status),
    byIp: index('reviews_ip_idx').on(t.ipHash, t.createdAt),
  }),
);

// ---------------- Notificaciones y estado del ranking ----------------
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // rank.dethroned | admin.new_bid | referral.credited | bid.verified | bid.rejected
    title: text('title').notNull(),
    body: text('body').notNull(),
    url: text('url'),
    meta: jsonb('meta'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index('notifications_user_idx').on(t.userId, t.readAt),
  }),
);

/** #1 actual por ámbito (categoría × provincia|nacional) para detectar destronamientos. */
export const rankLeaders = pgTable('rank_leaders', {
  scopeKey: text('scope_key').primaryKey(), // "<categorySlug>:<provinceSlug|national>"
  leaderProfileId: uuid('leader_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  leaderTotalDop: numeric('leader_total_dop', { precision: 12, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------- Empleos (jobs) ----------------

/**
 * Fuentes de ofertas. Solo se ejecutan las que tienen `authorization_status='authorized'`
 * Y `is_enabled=true` Y un adaptador registrado. Hoy operables: `direct` (publicación de
 * empresas), adaptadores ATS por empleador (Greenhouse/Lever) y CSV curado. Portales
 * (LinkedIn/Computrabajo/Tecoloco/TuNuevoTrabajo) = esqueletos que lanzan error.
 */
export const jobSources = pgTable('job_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  platform: text('platform').notNull().unique(),
  baseUrl: text('base_url'),
  feedUrl: text('feed_url'),
  sourceType: sourceType('source_type').notNull(),
  authorizationStatus: sourceAuth('authorization_status').notNull().default('none'),
  isEnabled: boolean('is_enabled').notNull().default(false),
  /** Si true, las vacantes nuevas de esta fuente se publican sin pasar por moderación. */
  autoPublish: boolean('auto_publish').notNull().default(false),
  /** Config por adaptador: { token } para ATS, { csvUrl } para CSV, etc. */
  config: jsonb('config'),
  defaultCategory: text('default_category'),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastRunStatus: text('last_run_status'), // ok | error | running
  lastError: text('last_error'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    requirements: text('requirements'),
    responsibilities: text('responsibilities'),
    // Vínculo opcional con un negocio registrado; `companyName` siempre presente.
    companyId: uuid('company_id').references(() => profiles.id, { onDelete: 'set null' }),
    companyName: text('company_name').notNull(),
    // Persona que publicó la vacante. `null` en vacantes importadas de una fuente.
    postedByUserId: uuid('posted_by_user_id').references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull(), // slug de shared/job-categories.ts
    subcategory: text('subcategory'),
    province: text('province'), // slug de shared/provinces.ts (null en remotos sin sede)
    city: text('city'),
    locationText: text('location_text'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    // Dirección exacta — SOLO si el empleador/fuente la aportó (nunca fabricada).
    streetAddress: text('street_address'),
    postalCode: text('postal_code'),
    jobType: jobType('job_type').notNull(),
    workMode: workMode('work_mode').notNull(),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency').notNull().default('DOP'),
    salaryPeriod: salaryPeriod('salary_period'),
    applicationUrl: text('application_url'),
    applicationEmail: text('application_email'),
    contactWhatsapp: text('contact_whatsapp'),
    /** true si `applicationUrl` es un formulario de aplicación directa (ATS conocido). */
    directApply: boolean('direct_apply').notNull().default(false),
    status: jobStatus('status').notNull().default('published'),
    isFeatured: boolean('is_featured').notNull().default(false),
    sourceId: uuid('source_id').references(() => jobSources.id, { onDelete: 'set null' }),
    sourcePlatform: text('source_platform').default('direct'),
    sourceName: text('source_name'),
    sourceUrl: text('source_url'),
    sourceJobId: text('source_job_id'),
    /** Repetido normalizado (empresa+título+ubicación) para deduplicación N3. */
    dedupeKey: text('dedupe_key'),
    /** sha256 del contenido normalizado, para deduplicación N4 y detección de cambios. */
    contentHash: text('content_hash'),
    /** Si es un posible duplicado, la vacante "original" a la que apunta. */
    duplicateOfId: uuid('duplicate_of_id'),
    /** Payload crudo de la fuente (para depurar / reprocesar). */
    rawPayload: jsonb('raw_payload'),
    // Estado de notificación a la Google Indexing API.
    indexingStatus: text('indexing_status'), // pending | ok | error
    indexingType: text('indexing_type'), // URL_UPDATED | URL_DELETED
    indexingRequestedAt: timestamp('indexing_requested_at', { withTimezone: true }),
    indexingLastError: text('indexing_last_error'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedReason: text('removed_reason'), // gone_from_source | admin | owner
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byStatusPublished: index('jobs_status_published_idx').on(t.status, t.publishedAt),
    byStatus: index('jobs_status_idx').on(t.status),
    byCategory: index('jobs_category_idx').on(t.category),
    byProvince: index('jobs_province_idx').on(t.province),
    byCity: index('jobs_city_idx').on(t.city),
    byCompany: index('jobs_company_idx').on(t.companyId),
    byExpires: index('jobs_expires_idx').on(t.expiresAt),
    bySourcePlatform: index('jobs_source_platform_idx').on(t.sourcePlatform),
    byDedupeKey: index('jobs_dedupe_key_idx').on(t.dedupeKey),
    byContentHash: index('jobs_content_hash_idx').on(t.contentHash),
    bySource: uniqueIndex('jobs_source_uniq').on(t.sourcePlatform, t.sourceJobId),
  }),
);

/** Bitácora de cada ejecución del importador (una fila por fuente y corrida). */
export const jobImportRuns = pgTable('job_import_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => jobSources.id, { onDelete: 'set null' }),
  sourcePlatform: text('source_platform').notNull(),
  status: text('status').notNull().default('running'), // running | ok | error
  jobsFound: integer('jobs_found').notNull().default(0),
  jobsNew: integer('jobs_new').notNull().default(0),
  jobsUpdated: integer('jobs_updated').notNull().default(0),
  jobsDuplicate: integer('jobs_duplicate').notNull().default(0),
  jobsExpired: integer('jobs_expired').notNull().default(0),
  jobsRemoved: integer('jobs_removed').notNull().default(0),
  jobsFailed: integer('jobs_failed').notNull().default(0),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobReports = pgTable('job_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  reporterUserId: uuid('reporter_user_id').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason').notNull(),
  detail: text('detail'),
  status: text('status').notNull().default('open'), // open | reviewed | dismissed
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Bid = typeof bids.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type DodoPayment = typeof dodoPayments.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobSource = typeof jobSources.$inferSelect;
export type JobReport = typeof jobReports.$inferSelect;
export type JobImportRun = typeof jobImportRuns.$inferSelect;
