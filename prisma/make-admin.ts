
import { PrismaPg } from '@prisma/adapter-pg';
import { Role, PrismaClient } from '../src/generated/prisma/client.js';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  try {
    // Listar usuários existentes
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
      },
    });

    console.log('Usuários encontrados:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.username}) - Role: ${user.role}`);
    });

    // Atualizar o usuário criado em requsição.http
    const user = await prisma.user.update({
      where: {
        email: 'test@email.com',
      },
      data: {
        role: Role.ADMIN,
      },
    });

    console.log(`\nUsuário ${user.email} agora é ADMIN.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Erro ao promover usuário:', error);
  process.exitCode = 1;
});
