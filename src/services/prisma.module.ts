import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.js';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
