/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,companyName]` on the table `support_company_rules` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `support_company_rules_tenantId_companyName_key` ON `support_company_rules`(`tenantId`, `companyName`);
