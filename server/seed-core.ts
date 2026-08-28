import { eq, inArray, notInArray } from 'drizzle-orm';
import { db } from './db';
import { bankAccounts, bids, categories, profiles, users } from '../shared/schema';
import { getActiveRound } from './lib/rounds';

/** Pestañas oficiales del ranking. `todo-rd` es el ranking general. */
const CATEGORIES: Array<{ slug: string; name: string; sortOrder: number }> = [
  { slug: 'todo-rd', name: '🔥 Todo RD', sortOrder: 0 },
  { slug: 'politicos-2028', name: '🏛️ Políticos 2028', sortOrder: 1 },
  { slug: 'comida', name: '🍗 Comida y Gastronomía', sortOrder: 2 },
  { slug: 'influencers', name: '🎙️ Influencers y Medios', sortOrder: 3 },
  { slug: 'negocios', name: '🏪 Negocios y Servicios', sortOrder: 4 },
];
const CANONICAL_SLUGS = CATEGORIES.map((c) => c.slug);
const CATCH_ALL = 'negocios';

const BANKS = [
  {
    bankName: 'Banreservas',
    accountHolder: 'TOP COM DO SRL',
    accountNumber: '000-0000000-0',
    accountType: 'Corriente',
    currency: 'DOP' as const,
    instructions: 'Envía el comprobante o el número de confirmación después de transferir.',
    sortOrder: 0,
  },
  {
    bankName: 'Banco Popular Dominicano',
    accountHolder: 'TOP COM DO SRL',
    accountNumber: '000-00000-0',
    accountType: 'Corriente',
    currency: 'DOP' as const,
    instructions: 'Transferencia o depósito. Sube la foto o pega el número de confirmación.',
    sortOrder: 1,
  },
  {
    bankName: 'Banco BHD',
    accountHolder: 'TOP COM DO SRL',
    accountNumber: '000-000000-000',
    accountType: 'Ahorros',
    currency: 'DOP' as const,
    instructions: '',
    sortOrder: 2,
  },
  {
    bankName: 'Qik Banco Digital Dominicano',
    accountHolder: 'TOP COM DO SRL',
    accountNumber: '8090000000',
    accountType: 'Cuenta Qik',
    currency: 'DOP' as const,
    instructions: 'Transferencia instantánea 24/7.',
    sortOrder: 3,
  },
];

const DEMO_PROFILES: Array<{
  name: string;
  handle: string;
  category: string;
  city: string;
  tagline: string;
  bidsDop: number[];
}> = [
  { name: 'Dipowel Rent Car', handle: 'dipowelrentcar', category: 'negocios', city: 'Santo Domingo', tagline: 'La mejor Rent Car de República Dominicana', bidsDop: [300, 225] },
  { name: 'Punto Parrillada', handle: 'puntoparrillada', category: 'comida', city: 'Santo Domingo Este', tagline: 'Reserva u ordena en línea y acumula puntos', bidsDop: [250, 150] },
  { name: 'La Cuevita del Sabor', handle: 'lacuevita', category: 'comida', city: 'Santo Domingo', tagline: 'El mejor mofongo de la capital', bidsDop: [5000, 3500] },
  { name: 'Kelvin Influencer', handle: 'kelvinrd', category: 'influencers', city: 'Santo Domingo', tagline: 'Comedia y lifestyle · 1.2M seguidores', bidsDop: [12000, 8000] },
  { name: 'Dra. Peña 2028', handle: 'drapena2028', category: 'politicos-2028', city: 'Nacional', tagline: 'Propuesta joven para el país', bidsDop: [20000, 10000] },
  { name: 'Barbería El Corte Fino', handle: 'cortefino', category: 'negocios', city: 'Santo Domingo Este', tagline: 'Fades y diseños · reserva por WhatsApp', bidsDop: [3000] },
];

/**
 * Sincroniza categorías (autoritativo), cuentas bancarias y la ronda activa.
 * Idempotente: se puede correr cuantas veces se quiera.
 */
export async function seedBase(): Promise<void> {
  for (const c of CATEGORIES) {
    await db
      .insert(categories)
      .values(c)
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: c.name, sortOrder: c.sortOrder, isActive: true },
      });
  }

  // Reasigna perfiles de categorías viejas a la catch-all y desactiva las viejas.
  const canon = await db.select().from(categories).where(inArray(categories.slug, CANONICAL_SLUGS));
  const catchAllId = canon.find((c) => c.slug === CATCH_ALL)?.id;
  if (catchAllId) {
    const orphanCats = await db
      .select({ id: categories.id })
      .from(categories)
      .where(notInArray(categories.slug, CANONICAL_SLUGS));
    if (orphanCats.length) {
      const orphanIds = orphanCats.map((c) => c.id);
      await db.update(profiles).set({ categoryId: catchAllId }).where(inArray(profiles.categoryId, orphanIds));
      await db.update(categories).set({ isActive: false }).where(inArray(categories.id, orphanIds));
    }
  }

  const anyBank = await db.select({ id: bankAccounts.id }).from(bankAccounts).limit(1);
  if (!anyBank.length) await db.insert(bankAccounts).values(BANKS);

  await getActiveRound();
}

/** Datos de demostración para ver el ranking en vivo (solo si no hay perfiles). */
export async function seedDemo(): Promise<void> {
  const anyProfile = await db.select({ id: profiles.id }).from(profiles).limit(1);
  if (anyProfile.length) return;

  const round = await getActiveRound();

  const demoUser = await db
    .insert(users)
    .values({ firebaseUid: 'demo-seed-user', email: 'demo@top.com.do', displayName: 'Usuario Demo', role: 'user' })
    .onConflictDoNothing()
    .returning();
  const demoUserId =
    demoUser[0]?.id ??
    (await db.select().from(users).where(eq(users.email, 'demo@top.com.do')).limit(1))[0]!.id;

  for (const p of DEMO_PROFILES) {
    const cat = await db.select().from(categories).where(eq(categories.slug, p.category)).limit(1);
    if (!cat[0]) continue;
    const inserted = await db
      .insert(profiles)
      .values({
        name: p.name,
        handle: p.handle,
        categoryId: cat[0].id,
        city: p.city,
        tagline: p.tagline,
        bio: p.tagline,
        whatsapp: '18095550100',
        instagramUrl: `https://instagram.com/${p.handle}`,
        avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p.name)}`,
      })
      .onConflictDoNothing()
      .returning();
    const profileId = inserted[0]?.id;
    if (!profileId) continue;

    for (const amount of p.bidsDop) {
      await db.insert(bids).values({
        profileId,
        userId: demoUserId,
        roundId: round.id,
        amountDop: amount.toFixed(2),
        currency: 'DOP',
        amountOriginal: amount.toFixed(2),
        fxRate: '1.0000',
        method: 'bank_transfer',
        status: 'verified',
        reference: 'DEMO',
        verifiedAt: new Date(),
      });
    }
  }
}

export async function needsSeed(): Promise<boolean> {
  const row = await db.select({ id: categories.id }).from(categories).limit(1);
  return row.length === 0;
}

export async function seedAll({ demo }: { demo: boolean }): Promise<void> {
  await seedBase();
  if (demo) await seedDemo();
}

export { DEMO_PROFILES };
