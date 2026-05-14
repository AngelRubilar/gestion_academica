import 'dotenv/config';
import { PrismaClient, Role, TimeBlockType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

/* eslint-disable no-console */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando seed...');

  await seedTimeBlocks();
  await seedSuperAdmin();
  await seedAcademicPeriod();

  console.log('Seed completado.');
}

async function seedTimeBlocks() {
  const blocks = [
    { number: 0, name: 'Bloque 0', start: '08:00', end: '08:30', type: TimeBlockType.CLASS },
    { number: 1, name: 'Bloque 1', start: '08:30', end: '09:15', type: TimeBlockType.CLASS },
    { number: 2, name: 'Bloque 2', start: '09:15', end: '10:00', type: TimeBlockType.CLASS },
    { number: 3, name: 'Bloque 3', start: '10:00', end: '10:45', type: TimeBlockType.CLASS },
    { number: 4, name: 'Recreo 1', start: '10:45', end: '11:00', type: TimeBlockType.BREAK },
    { number: 5, name: 'Bloque 4', start: '11:00', end: '11:45', type: TimeBlockType.CLASS },
    { number: 6, name: 'Bloque 5', start: '11:45', end: '12:30', type: TimeBlockType.CLASS },
    { number: 7, name: 'Almuerzo', start: '12:30', end: '13:15', type: TimeBlockType.LUNCH },
    { number: 8, name: 'Bloque 6', start: '13:15', end: '14:00', type: TimeBlockType.CLASS },
    { number: 9, name: 'Bloque 7', start: '14:00', end: '14:45', type: TimeBlockType.CLASS },
    { number: 10, name: 'Recreo 2', start: '14:45', end: '14:55', type: TimeBlockType.BREAK },
    { number: 11, name: 'Bloque 8', start: '14:55', end: '15:40', type: TimeBlockType.CLASS },
    { number: 12, name: 'Bloque 9', start: '15:40', end: '16:25', type: TimeBlockType.CLASS },
  ];

  for (const block of blocks) {
    await prisma.timeBlock.upsert({
      where: { number: block.number },
      update: {},
      create: {
        number: block.number,
        name: block.name,
        startTime: new Date(`1970-01-01T${block.start}:00.000Z`),
        endTime: new Date(`1970-01-01T${block.end}:00.000Z`),
        type: block.type,
      },
    });
  }

  console.log(`  TimeBlocks: ${blocks.length} creados`);
}

async function seedSuperAdmin() {
  const email = 'superadmin@gestion-academica.local';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log('  SuperAdmin ya existe, se omite.');
    return;
  }

  const hashedPassword = await bcrypt.hash('superadmin123', 10);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`  SuperAdmin creado: ${email}`);
}

async function seedAcademicPeriod() {
  const year = new Date().getFullYear();

  await prisma.academicPeriod.upsert({
    where: { year_semester: { year, semester: 1 } },
    update: {},
    create: {
      year,
      semester: 1,
      name: `Primer Semestre ${year}`,
      startDate: new Date(`${year}-03-01`),
      endDate: new Date(`${year}-07-31`),
    },
  });

  await prisma.academicPeriod.upsert({
    where: { year_semester: { year, semester: 2 } },
    update: {},
    create: {
      year,
      semester: 2,
      name: `Segundo Semestre ${year}`,
      startDate: new Date(`${year}-08-01`),
      endDate: new Date(`${year}-12-15`),
    },
  });

  console.log(`  Periodos academicos del ${year} creados`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
