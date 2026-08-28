import { eq, inArray, notInArray } from 'drizzle-orm';
import { db } from './db';
import { bankAccounts, bids, categories, profiles, users } from '../shared/schema';
import { getActiveRound } from './lib/rounds';
import { CATEGORY_DEFS, CATEGORY_SLUGS, CATCH_ALL_SLUG } from '../shared/categories';

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
  subcategory: string;
  city: string;
  tagline: string;
  bidsDop: number[];
}> = [
  { name: 'Dipowel Rent Car', handle: 'dipowelrentcar', category: 'automotriz', subcategory: 'Rent a Car', city: 'Santo Domingo', tagline: 'La mejor Rent Car de República Dominicana', bidsDop: [300, 225] },
  { name: 'Pollo Rey del Sabor', handle: 'polloreysabor', category: 'gastronomia', subcategory: 'Pica Pollos', city: 'Santiago', tagline: 'El pica pollo #1 del Cibao', bidsDop: [500, 300] },
  { name: 'iStore RD', handle: 'istorerd', category: 'tecnologia', subcategory: 'Tiendas de Celulares / iPhones', city: 'Santo Domingo', tagline: 'iPhones sellados con garantía', bidsDop: [800, 400] },
  { name: 'Barbería El Corte Fino', handle: 'cortefino', category: 'moda-belleza', subcategory: 'Salones de Belleza y Barbershops', city: 'Santo Domingo Este', tagline: 'Fades y diseños · reserva por WhatsApp', bidsDop: [300] },
  { name: 'Dra. Peña 2028', handle: 'drapena2028', category: 'politica', subcategory: 'Figuras y Candidatos', city: 'Nacional', tagline: 'Propuesta joven para el país', bidsDop: [2000, 1000] },
];

/** Adivina la categoría de un perfil por palabras clave en su nombre. */
function guessCategorySlug(name: string): string {
  const n = name.toLowerCase();
  const has = (...w: string[]) => w.some((x) => n.includes(x));
  if (has('rent car', 'rentcar', 'rent a car', 'taller', 'gomera', 'auto', 'motor', 'dealer', 'repuesto'))
    return 'automotriz';
  if (has('pollo', 'pica pollo', 'comida', 'restaurant', 'reposter', 'panader', 'parrillada', 'pizza', 'delivery'))
    return 'gastronomia';
  if (has('barber', 'salon', 'salón', 'belleza', 'boutique', 'joyer', 'calzado', 'ropa', 'estilista'))
    return 'moda-belleza';
  if (has('celular', 'iphone', 'tech', 'tecnolog', 'informat', 'gadget', 'computad', 'electron'))
    return 'tecnologia';
  if (has('ferreter', 'muebler', 'hogar', 'plomer', 'electric', 'construc'))
    return 'hogar';
  if (has('farmacia', 'clinica', 'clínica', 'medico', 'médico', 'salud', 'dental', 'estetica', 'estética'))
    return 'salud';
  if (has('inmobiliar', 'abogad', 'notari', 'contab', 'gestor', 'alquiler', 'villa'))
    return 'servicios';
  if (has('2028', 'alcald', 'diputad', 'senador', 'candidat', 'movimiento', 'partido', 'político', 'politico'))
    return 'politica';
  return 'servicios';
}

/** Sincroniza categorías (autoritativo), cuentas bancarias y la ronda activa. */
export async function seedBase(): Promise<void> {
  for (const c of CATEGORY_DEFS) {
    await db
      .insert(categories)
      .values({ slug: c.slug, name: c.name, sortOrder: c.sortOrder })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { name: c.name, sortOrder: c.sortOrder, isActive: true },
      });
  }

  const canon = await db.select().from(categories).where(inArray(categories.slug, CATEGORY_SLUGS));
  const bySlug = new Map(canon.map((c) => [c.slug, c.id]));
  const catchAllId = bySlug.get(CATCH_ALL_SLUG);

  if (catchAllId) {
    // Reasigna cada perfil de una categoría vieja: primero por nombre/rubro, luego comodín.
    const orphanCats = await db
      .select({ id: categories.id })
      .from(categories)
      .where(notInArray(categories.slug, CATEGORY_SLUGS));
    if (orphanCats.length) {
      const orphanIds = orphanCats.map((c) => c.id);
      const stranded = await db
        .select({ id: profiles.id, name: profiles.name })
        .from(profiles)
        .where(inArray(profiles.categoryId, orphanIds));
      for (const p of stranded) {
        const slug = guessCategorySlug(p.name);
        const target = bySlug.get(slug) ?? catchAllId;
        await db.update(profiles).set({ categoryId: target }).where(eq(profiles.id, p.id));
      }
      await db.update(categories).set({ isActive: false }).where(inArray(categories.id, orphanIds));
    }
  }

  const anyBank = await db.select({ id: bankAccounts.id }).from(bankAccounts).limit(1);
  if (!anyBank.length) await db.insert(bankAccounts).values(BANKS);

  await getActiveRound();
}

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
        subcategory: p.subcategory,
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
