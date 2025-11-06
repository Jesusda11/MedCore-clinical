/*
  Warnings:

  - The `status` column on the `Appointment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Queue` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `doctorId` to the `Queue` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CALLED', 'ATTENDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "status",
ADD COLUMN     "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "Queue" ADD COLUMN     "doctorId" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "QueueStatus" NOT NULL DEFAULT 'WAITING';
