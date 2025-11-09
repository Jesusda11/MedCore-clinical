/*
  Warnings:

  - The values [ATTENDED] on the enum `QueueStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[appointmentId]` on the table `Queue` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `queueNumber` to the `Queue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Queue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QueueStatus_new" AS ENUM ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."Queue" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Queue" ALTER COLUMN "status" TYPE "QueueStatus_new" USING ("status"::text::"QueueStatus_new");
ALTER TYPE "QueueStatus" RENAME TO "QueueStatus_old";
ALTER TYPE "QueueStatus_new" RENAME TO "QueueStatus";
DROP TYPE "public"."QueueStatus_old";
ALTER TABLE "Queue" ALTER COLUMN "status" SET DEFAULT 'WAITING';
COMMIT;

-- AlterTable
ALTER TABLE "Queue" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "queueNumber" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Queue_appointmentId_key" ON "Queue"("appointmentId");

-- CreateIndex
CREATE INDEX "Queue_doctorId_status_queueNumber_idx" ON "Queue"("doctorId", "status", "queueNumber");
