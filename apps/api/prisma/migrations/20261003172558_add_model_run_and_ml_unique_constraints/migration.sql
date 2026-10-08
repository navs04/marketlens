/*
  Warnings:

  - A unique constraint covering the columns `[marketId,commodityId,date,method]` on the table `AnomalyFlag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[marketId,commodityId,forecastDate,horizonDays,modelVersion]` on the table `ForecastResult` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[marketId,commodityId,asOfDate,horizonDays,modelVersion]` on the table `SpikeRiskScore` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "ModelRun" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "marketId" TEXT,
    "commodityId" TEXT,
    "modelVersion" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "metrics" TEXT,
    "notes" TEXT,

    CONSTRAINT "ModelRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelRun_jobType_marketId_commodityId_idx" ON "ModelRun"("jobType", "marketId", "commodityId");

-- CreateIndex
CREATE INDEX "AnomalyFlag_isAnomaly_date_idx" ON "AnomalyFlag"("isAnomaly", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyFlag_marketId_commodityId_date_method_key" ON "AnomalyFlag"("marketId", "commodityId", "date", "method");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastResult_marketId_commodityId_forecastDate_horizonDay_key" ON "ForecastResult"("marketId", "commodityId", "forecastDate", "horizonDays", "modelVersion");

-- CreateIndex
CREATE INDEX "SpikeRiskScore_asOfDate_idx" ON "SpikeRiskScore"("asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "SpikeRiskScore_marketId_commodityId_asOfDate_horizonDays_mo_key" ON "SpikeRiskScore"("marketId", "commodityId", "asOfDate", "horizonDays", "modelVersion");
