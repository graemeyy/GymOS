import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/prisma/seed-data";

// Temporary one-off endpoint to populate sample data for the redesigned UI.
// Remove this route once seeding has been run against production.
export async function GET() {
  try {
    const result = await seedDatabase(prisma);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
