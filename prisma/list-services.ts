import "dotenv/config";
import prisma from "../lib/db";
async function main() {
  const cats = await prisma.serviceCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const svcs = await prisma.service.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, basePrice: true, gender: true, isActive: true, categoryId: true } });
  console.log("CATEGORIES:", JSON.stringify(cats, null, 2));
  console.log("SERVICES:", JSON.stringify(svcs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
