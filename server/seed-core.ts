import { eq } from 'drizzle-orm';
import { db } from './db';
import { bankAccounts, bids, categories, profiles, users } from '../shared/schema';
import { getActiveRound } from './lib/rounds';

const CATEGORIES: Array<[string, string, number]> = [
  ['todo-rd', 'Todo RD', 0],
  ['comida', 'Comida', 1],
  ['influencers', 'Influencers', 2],
  ['politicos-2028', 'Políticos 2028', 3],
  ['dealers', 'Dealers', 4],
  ['inmobiliaria', 'Inmobiliaria', 5],
  ['moda', 'Moda', 6],
  ['musica', 'Música', 7],
  ['deportes', 'Deportes', 8],
  ['tecnologia', 'Tecnología', 9],
  ['belleza', 'Belleza', 10],
  ['turismo', 'Turismo', 11],
];

const BANKS = [
  {
    bankName: 'Banreservas',
    accountHolder: 'TOP COM DO SRL',
    accountNumber: '000-0000000-0',
    accountType: 'Corriente',
    currency: 'DOP' as const,
    instructions: 'Envía el comprobante después de transferir. Incluye tu usuario en el concepto.',
    sortOrder: 0,
  },
  {
    bankName: 'Banco Popular Dominicano',
    accountHolder: 'TOP COM DO SRL',
    accountNumber: '000-00000-0',
    accountType: 'Corriente',
    currency: 'DOP' as const,
    instructions: 'Transferencia o depósito. Sube la foto del comprobante.',
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
  bio: string;
  bidsDop: number[];
}> = [
  { name: 'La Cuevita del Sabor', handle: 'lacuevita', category: 'comida', city: 'Santo Domingo', bio: 'El mejor mofongo de la capital.', bidsDop: [5000, 3500, 2500] },
  { name: 'Chef Rossy RD', handle: 'chefrossy', category: 'comida', city: 'Santiago', bio: 'Cocina dominicana de autor.', bidsDop: [4000, 1500] },
  { name: 'Kelvin Influencer', handle: 'kelvinrd', category: 'influencers', city: 'Santo Domingo', bio: 'Comedia y lifestyle. 1.2M seguidores.', bidsDop: [12000, 8000, 6000] },
  { name: 'Marielys Beauty', handle: 'marielys', category: 'influencers', city: 'La Romana', bio: 'Tips de belleza cada semana.', bidsDop: [7000, 2000] },
  { name: 'Auto Import GS', handle: 'autoimportgs', category: 'dealers', city: 'Santiago', bio: 'Vehículos americanos con garantía.', bidsDop: [9000, 4500] },
  { name: 'Residencial Las Palmas', handle: 'laspalmas', category: 'inmobiliaria', city: 'Punta Cana', bio: 'Apartamentos frente al mar.', bidsDop: [15000, 5000] },
  { name: 'Dra. Peña 2028', handle: 'drapena2028', category: 'politicos-2028', city: 'Nacional', bio: 'Propuesta joven para el país.', bidsDop: [20000, 10000, 5000] },
  { name: 'Barbería El Corte Fino', handle: 'cortefino', category: 'belleza', city: 'Santo Domingo Este', bio: 'Fades y diseños. Reserva por WhatsApp.', bidsDop: [3000] },
];

/** Crea categorías, cuentas bancarias y la ronda activa si faltan. */
export async function seedBase(): Promise<void> {
  for (const [slug, name, sortOrder] of CATEGORIES) {
    await db.insert(categories).values({ slug, name, sortOrder }).onConflictDoNothing();
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
    .values({
      firebaseUid: 'demo-seed-user',
      email: 'demo@top.com.do',
      displayName: 'Usuario Demo',
      role: 'user',
    })
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
        bio: p.bio,
        whatsapp: '18095550100',
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

/** Comprueba si la tabla de categorías está vacía (para autoseed en local). */
export async function needsSeed(): Promise<boolean> {
  const row = await db.select({ id: categories.id }).from(categories).limit(1);
  return row.length === 0;
}

export async function seedAll({ demo }: { demo: boolean }): Promise<void> {
  await seedBase();
  if (demo) await seedDemo();
}

export { DEMO_PROFILES };
