/*
  Warnings:

  - A unique constraint covering the columns `[marketId,commodityId,date,variety]` on the table `PriceObservation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PriceObservation_marketId_commodityId_date_key";

-- AlterTable
ALTER TABLE "PriceObservation" ADD COLUMN     "grade" TEXT,
ADD COLUMN     "variety" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "PriceObservation_marketId_date_idx" ON "PriceObservation"("marketId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceObservation_marketId_commodityId_date_variety_key" ON "PriceObservation"("marketId", "commodityId", "date", "variety");
