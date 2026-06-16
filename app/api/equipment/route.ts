import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const equipment = await prisma.equipment.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(equipment);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch equipment' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const equipment = await prisma.equipment.create({
      data: {
        name: body.name,
        serialNumber: body.serialNumber,
        status: body.status || 'OPERATIONAL',
        healthScore: body.healthScore || 1.0,
        failureProbability: body.failureProbability || 0.0,
        lastServicedAt: body.lastServicedAt ? new Date(body.lastServicedAt) : null,
        predictedFailureDate: body.predictedFailureDate ? new Date(body.predictedFailureDate) : null,
      },
    });
    return NextResponse.json(equipment);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create equipment' }, { status: 500 });
  }
}
