-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('DATA_GOV_IN', 'NPPA', 'MANUAL');

-- CreateEnum
CREATE TYPE "CommodityCategory" AS ENUM ('VEGETABLE', 'MEDICINE', 'LPG');

-- CreateEnum
CREATE TYPE "AlertCondition" AS ENUM ('PRICE_ABOVE', 'PRICE_BELOW', 'SPIKE_RISK_ABOVE', 'ANOMALY_DETECTED');

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "source" "DataSource" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commodity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CommodityCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "minPrice" DOUBLE PRECISION,
    "maxPrice" DOUBLE PRECISION,
    "modalPrice" DOUBLE PRECISION,
    "qualityFlag" TEXT,
    "sourceRecord" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawIngestionLog" (
    "id" TEXT NOT NULL,
    "source" "DataSource" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "rawPayloadRef" TEXT,
    "notes" TEXT,

    CONSTRAINT "RawIngestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastResult" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forecastDate" DATE NOT NULL,
    "predictedPrice" DOUBLE PRECISION NOT NULL,
    "lowerBound" DOUBLE PRECISION,
    "upperBound" DOUBLE PRECISION,
    "modelVersion" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,

    CONSTRAINT "ForecastResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyFlag" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "observedPrice" DOUBLE PRECISION NOT NULL,
    "expectedPrice" DOUBLE PRECISION NOT NULL,
    "deviationPct" DOUBLE PRECISION NOT NULL,
    "isAnomaly" BOOLEAN NOT NULL,
    "method" TEXT NOT NULL,

    CONSTRAINT "AnomalyFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpikeRiskScore" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "riskProbability" DOUBLE PRECISION NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,

    CONSTRAINT "SpikeRiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Explanation" (
    "id" TEXT NOT NULL,
    "forecastResultId" TEXT,
    "anomalyFlagId" TEXT,
    "spikeRiskScoreId" TEXT,
    "llmModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "explanationText" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Explanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "condition" "AlertCondition" NOT NULL,
    "threshold" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Market_state_idx" ON "Market"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_state_district_key" ON "Market"("name", "state", "district");

-- CreateIndex
CREATE INDEX "Commodity_category_idx" ON "Commodity"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_name_category_key" ON "Commodity"("name", "category");

-- CreateIndex
CREATE INDEX "PriceObservation_commodityId_date_idx" ON "PriceObservation"("commodityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceObservation_marketId_commodityId_date_key" ON "PriceObservation"("marketId", "commodityId", "date");

-- CreateIndex
CREATE INDEX "ForecastResult_marketId_commodityId_forecastDate_idx" ON "ForecastResult"("marketId", "commodityId", "forecastDate");

-- CreateIndex
CREATE INDEX "AnomalyFlag_marketId_commodityId_date_idx" ON "AnomalyFlag"("marketId", "commodityId", "date");

-- CreateIndex
CREATE INDEX "SpikeRiskScore_marketId_commodityId_asOfDate_idx" ON "SpikeRiskScore"("marketId", "commodityId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "Explanation_forecastResultId_key" ON "Explanation"("forecastResultId");

-- CreateIndex
CREATE UNIQUE INDEX "Explanation_anomalyFlagId_key" ON "Explanation"("anomalyFlagId");

-- CreateIndex
CREATE UNIQUE INDEX "Explanation_spikeRiskScoreId_key" ON "Explanation"("spikeRiskScoreId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastResult" ADD CONSTRAINT "ForecastResult_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastResult" ADD CONSTRAINT "ForecastResult_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyFlag" ADD CONSTRAINT "AnomalyFlag_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyFlag" ADD CONSTRAINT "AnomalyFlag_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpikeRiskScore" ADD CONSTRAINT "SpikeRiskScore_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpikeRiskScore" ADD CONSTRAINT "SpikeRiskScore_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_forecastResultId_fkey" FOREIGN KEY ("forecastResultId") REFERENCES "ForecastResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_anomalyFlagId_fkey" FOREIGN KEY ("anomalyFlagId") REFERENCES "AnomalyFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_spikeRiskScoreId_fkey" FOREIGN KEY ("spikeRiskScoreId") REFERENCES "SpikeRiskScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
