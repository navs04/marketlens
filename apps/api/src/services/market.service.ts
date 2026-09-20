import { prisma } from "../lib/prisma.js";

export const marketService = {
  async list() {
    return prisma.market.findMany({
      orderBy: [{ state: "asc" }, { name: "asc" }],
    });
  },

  async getById(id: string) {
    return prisma.market.findUnique({ where: { id } });
  },
};
