import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { TicketsModule } from './tickets/tickets.module.js';



@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), PrismaModule, AuthModule, UsersModule, TicketsModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
