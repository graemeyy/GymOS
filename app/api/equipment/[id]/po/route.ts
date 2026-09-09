import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { logAction } from '@/lib/audit';

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await requireRole(request, 'MANAGER');
  if (denied) return denied;

  try {
    const { id } = params;
    const equipment = await prisma.equipment.findUnique({ where: { id } });

    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    if (equipment.status !== 'OFFLINE') {
      return NextResponse.json({ error: 'Purchase orders can only be generated for offline equipment' }, { status: 400 });
    }

    // Generate a purchase order action
    const action = await prisma.agentAction.create({
      data: {
        title: `Purchase Order: ${equipment.name}`,
        description: `Automated PO for ${equipment.name} (SN: ${equipment.serialNumber}). Status: OFFLINE. Part needed: ${equipment.partNeeded || 'TBD'}. Estimated cost: $${equipment.estimatedCost || 'TBD'}.`,
        category: 'MAINTENANCE',
        status: 'PENDING',
        metadata: {
          equipmentId: id,
          serialNumber: equipment.serialNumber,
          cost: equipment.estimatedCost,
        },
      },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: 'equipment.po_created',
      targetType: 'Equipment',
      targetId: id,
      details: { name: equipment.name, partNeeded: equipment.partNeeded, estimatedCost: equipment.estimatedCost },
    });

    return NextResponse.json({ message: 'Purchase order drafted', action });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate purchase order' }, { status: 500 });
  }
}
