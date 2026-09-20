import { prisma } from "../lib/prisma.js";

export const commodityService = {
  async list() {
    return prisma.commodity.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  },

  async getById(id: string) {
    return prisma.commodity.findUnique({ where: { id } });
  },
};
