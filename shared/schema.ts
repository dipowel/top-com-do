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
export const bidMethod = pgEnum('bid_method', ['bank_transfer', 'paypal']);
export const bidStatus = pgEnum('bid_status', ['pending', 'verified', 'rejected']);
export const currencyEnum = pgEnum('currency', ['DOP', 'USD']);

// ---------------- Tablas ----------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  whatsapp: text('whatsapp'),
  role: userRole('role').notNull().default('user'),
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
    tagline: text('tagline'), // mensaje corto destacable (<= 60 chars)
    whatsapp: text('whatsapp'),
    instagramUrl: text('instagram_url'),
    websiteUrl: text('website_url'),
    city: text('city'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCategory: index('profiles_category_idx').on(t.categoryId),
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
