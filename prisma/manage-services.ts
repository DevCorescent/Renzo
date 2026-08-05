import "dotenv/config";
import prisma from "../lib/db";

// Category IDs (confirmed from list-services output)
const CAT_BASIC_HAIRCUT  = "cms5omze3000604l61djoecwb";
const CAT_FOR_MEN        = "cms61tvd7000004jmak09o3nx";
const CAT_ADV_FACIAL     = "cms5xzx83000404jp0bd07qvo";
const CAT_STRAIGHTNING   = "cms5wpskz000004kzwametu92";

// Service to remove
const HYDRA_FACIAL_ID = "cms5y8d5x000t04kz9rmpo5pw";

async function main() {
  // ── 1. Remove "Hydra Facial" ──────────────────────────────────────────────
  const deleted = await prisma.service.updateMany({
    where: { id: HYDRA_FACIAL_ID },
    data: { isActive: false },
  });
  console.log(`✓ Deactivated Hydra Facial (${deleted.count} row)`);

  // ── 2. PERMING category (create if missing) ───────────────────────────────
  const permCat = await prisma.serviceCategory.upsert({
    where: { slug: "perming" },
    update: {},
    create: {
      name: "PERMING",
      slug: "perming",
      gender: "FEMALE",
      isActive: true,
      sortOrder: 20,
      image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
    },
  });
  console.log(`✓ PERMING category: ${permCat.id}`);

  // ── 3. Hair Cut ₹200 UNISEX ──────────────────────────────────────────────
  const haircut = await prisma.service.upsert({
    where: { slug: "hair-cut-basic" },
    update: {},
    create: {
      categoryId: CAT_BASIC_HAIRCUT,
      name: "Hair Cut",
      slug: "hair-cut-basic",
      basePrice: 200,
      duration: 30,
      gender: "UNISEX",
      isActive: true,
      image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80",
    },
  });
  console.log(`✓ Hair Cut ₹200 UNISEX: ${haircut.id}`);

  // ── 4. Beard Normal ₹100 MALE ────────────────────────────────────────────
  const beard = await prisma.service.upsert({
    where: { slug: "beard-normal" },
    update: {},
    create: {
      categoryId: CAT_FOR_MEN,
      name: "Beard Normal",
      slug: "beard-normal",
      basePrice: 100,
      duration: 20,
      gender: "MALE",
      isActive: true,
      image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80",
    },
  });
  console.log(`✓ Beard Normal ₹100 MALE: ${beard.id}`);

  // ── 5. Korean Glow Facial ₹5000 FEMALE ───────────────────────────────────
  const korGlow = await prisma.service.upsert({
    where: { slug: "korean-glow-facial" },
    update: {},
    create: {
      categoryId: CAT_ADV_FACIAL,
      name: "Korean Glow Facial",
      slug: "korean-glow-facial",
      basePrice: 5000,
      duration: 75,
      gender: "FEMALE",
      isActive: true,
      image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80",
    },
  });
  console.log(`✓ Korean Glow Facial ₹5000 FEMALE: ${korGlow.id}`);

  // ── 6. Ladies Hair Perming with variants ─────────────────────────────────
  const perming = await prisma.service.upsert({
    where: { slug: "ladies-hair-perming" },
    update: {},
    create: {
      categoryId: permCat.id,
      name: "Ladies Hair Perming",
      slug: "ladies-hair-perming",
      basePrice: 6000, // base = cheapest variant
      duration: 120,
      gender: "FEMALE",
      isActive: true,
      image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80",
    },
  });
  console.log(`✓ Ladies Hair Perming: ${perming.id}`);

  // Variants (upsert by serviceId+name combo via deleteMany+create to stay idempotent)
  await prisma.serviceVariant.deleteMany({ where: { serviceId: perming.id } });
  await prisma.serviceVariant.createMany({
    data: [
      { serviceId: perming.id, name: "Shoulder Length", price: 6000,  duration: 120, isActive: true },
      { serviceId: perming.id, name: "Medium Length",   price: 8000,  duration: 150, isActive: true },
      { serviceId: perming.id, name: "Long Length",     price: 10000, duration: 180, isActive: true },
    ],
  });
  console.log("✓  → 3 variants added (Shoulder ₹6000 / Medium ₹8000 / Long ₹10000)");

  // ── 7. Temporary Straightening ₹800 FEMALE ───────────────────────────────
  const tempStraight = await prisma.service.upsert({
    where: { slug: "temporary-straightening-ladies" },
    update: {},
    create: {
      categoryId: CAT_STRAIGHTNING,
      name: "Temporary Straightening",
      slug: "temporary-straightening-ladies",
      basePrice: 800,
      duration: 45,
      gender: "FEMALE",
      isActive: true,
      image: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=800&q=80",
    },
  });
  console.log(`✓ Temporary Straightening ₹800 FEMALE: ${tempStraight.id}`);

  console.log("\nAll done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
