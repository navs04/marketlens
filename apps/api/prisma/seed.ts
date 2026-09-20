import { PrismaClient, CommodityCategory, DataSource } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds reference data only: real market and commodity names.
 *
 * Deliberately does NOT seed any PriceObservation rows - per the project's
 * engineering principles, price data must come from the real data.gov.in
 * ingestion pipeline (Milestone 2), never be fabricated for convenience.
 * This seed exists purely so the frontend has real markets/commodities to
 * populate selectors with while the ingestion pipeline is being built.
 */

const markets = [
  { name: "Azadpur", state: "Delhi", district: "North Delhi" },
  { name: "Vashi APMC", state: "Maharashtra", district: "Thane" },
  { name: "Koyambedu", state: "Tamil Nadu", district: "Chennai" },
  { name: "Yeshwanthpur", state: "Karnataka", district: "Bengaluru Urban" },
  { name: "Bowenpally", state: "Telangana", district: "Hyderabad" },
  { name: "Gultekdi", state: "Maharashtra", district: "Pune" },
];

const vegetableCommodities = [
  { name: "Onion", unit: "per quintal" },
  { name: "Potato", unit: "per quintal" },
  { name: "Tomato", unit: "per quintal" },
  { name: "Green Chilli", unit: "per quintal" },
  { name: "Cauliflower", unit: "per quintal" },
  { name: "Brinjal", unit: "per quintal" },
];

async function main() {
  console.log("Seeding markets...");
  for (const market of markets) {
    await prisma.market.upsert({
      where: {
        name_state_district: {
          name: market.name,
          state: market.state,
          district: market.district,
        },
      },
      update: {},
      create: {
        ...market,
        source: DataSource.DATA_GOV_IN,
      },
    });
  }

  console.log("Seeding commodities...");
  for (const commodity of vegetableCommodities) {
    await prisma.commodity.upsert({
      where: {
        name_category: {
          name: commodity.name,
          category: CommodityCategory.VEGETABLE,
        },
      },
      update: {},
      create: {
        ...commodity,
        category: CommodityCategory.VEGETABLE,
      },
    });
  }

  const marketCount = await prisma.market.count();
  const commodityCount = await prisma.commodity.count();
  console.log(`Done. ${marketCount} markets, ${commodityCount} commodities in the database.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
