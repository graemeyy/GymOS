import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { logAction } from '@/lib/audit';

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
  const denied = await requireRole(request, 'MANAGER');
  if (denied) return denied;

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

    const session = await getSession(request);
    await logAction(prisma, session, { action: 'equipment.created', targetType: 'Equipment', targetId: equipment.id, details: { name: equipment.name } });

    return NextResponse.json(equipment);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create equipment' }, { status: 500 });
  }
}
