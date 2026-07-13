/*
  Warnings:

  - You are about to drop the column `categoria` on the `Material` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Material" DROP COLUMN "categoria",
ADD COLUMN     "rubroId" TEXT;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "Rubro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
