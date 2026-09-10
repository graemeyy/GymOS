-- CreateTable
CREATE TABLE "GymSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "requireKeycardForEntry" BOOLEAN NOT NULL DEFAULT false,
    "hideRevenueFromFrontDesk" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GymSettings_pkey" PRIMARY KEY ("id")
);

