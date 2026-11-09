import { Module } from '@nestjs/common';
import { PrismaModule } from '../services/prisma.module.js';
import { RolesGuard } from '../auth/guards/role-guard.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, RolesGuard],
})
export class CategoriesModule {}
