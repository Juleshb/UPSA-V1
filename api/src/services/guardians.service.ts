import { errors } from '../utils/errors';
import { nextPublicId } from '../utils/ids';
import { prisma } from '../utils/prisma';

export async function createGuardian(input: {
  fullName: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  userId?: string;
}) {
  const guardian = await prisma.guardian.create({
    data: {
      publicId: await nextPublicId('GRD'),
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      nationalId: input.nationalId,
      userId: input.userId,
    },
  });
  return serialize(guardian);
}

export async function getGuardian(guardianId: string) {
  return serialize(await findGuardian(guardianId));
}

export async function listGuardians() {
  const rows = await prisma.guardian.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(serialize);
}

export async function findGuardian(guardianId: string) {
  const guardian = await prisma.guardian.findUnique({ where: { publicId: guardianId } });
  if (!guardian) throw errors.notFound('GUARDIAN_NOT_FOUND', 'The requested guardian could not be found.');
  return guardian;
}

function serialize(guardian: Awaited<ReturnType<typeof findGuardian>>) {
  return {
    guardianId: guardian.publicId,
    fullName: guardian.fullName,
    phone: guardian.phone,
    email: guardian.email,
    nationalId: guardian.nationalId,
    createdAt: guardian.createdAt.toISOString(),
  };
}
