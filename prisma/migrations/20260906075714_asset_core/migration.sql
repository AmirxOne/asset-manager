-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "defaultWarrantyMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetTypeId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "supplierId" TEXT,
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "locationId" TEXT,
    "departmentId" TEXT,
    "holderEmployeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "lifecycleStage" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "notes" TEXT,
    "qrGeneratedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "disposedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetEvent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "fromEmployeeId" TEXT,
    "toEmployeeId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "actorId" TEXT,
    "metadata" JSONB,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSequence" (
    "prefix" TEXT NOT NULL,
    "seq" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "CodeSequence_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "Settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_code_key" ON "AssetCategory"("code");

-- CreateIndex
CREATE INDEX "AssetCategory_parentId_idx" ON "AssetCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetType_code_key" ON "AssetType"("code");

-- CreateIndex
CREATE INDEX "AssetType_categoryId_idx" ON "AssetType"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serialNumber_key" ON "Asset"("serialNumber");

-- CreateIndex
CREATE INDEX "Asset_status_assetTypeId_idx" ON "Asset"("status", "assetTypeId");

-- CreateIndex
CREATE INDEX "Asset_holderEmployeeId_idx" ON "Asset"("holderEmployeeId");

-- CreateIndex
CREATE INDEX "Asset_locationId_idx" ON "Asset"("locationId");

-- CreateIndex
CREATE INDEX "Asset_departmentId_idx" ON "Asset"("departmentId");

-- CreateIndex
CREATE INDEX "Asset_supplierId_idx" ON "Asset"("supplierId");

-- CreateIndex
CREATE INDEX "Asset_warrantyEnd_idx" ON "Asset"("warrantyEnd");

-- CreateIndex
CREATE INDEX "Asset_isDeleted_status_idx" ON "Asset"("isDeleted", "status");

-- CreateIndex
CREATE INDEX "AssetEvent_assetId_occurredAt_idx" ON "AssetEvent"("assetId", "occurredAt");

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetType" ADD CONSTRAINT "AssetType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "AssetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
