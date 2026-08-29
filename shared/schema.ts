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

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Bid = typeof bids.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type DodoPayment = typeof dodoPayments.$inferSelect;
