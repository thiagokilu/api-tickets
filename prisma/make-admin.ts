
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/services/prisma.js';
import { Role } from '../generated/prisma/client.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const prisma = app.get(PrismaService);

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

    // Atualizar o usuário (mude o email para um existente)
    const user = await prisma.user.update({
      where: {
        email: 'thiago@email.com',
      },
      data: {
        role: Role.ADMIN,
      },
    });

    console.log(`\nUsuário ${user.email} agora é ADMIN.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Erro ao promover usuário:', error);
  process.exitCode = 1;
});
