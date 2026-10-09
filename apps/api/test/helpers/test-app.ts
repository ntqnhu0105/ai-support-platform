import '../setup-env.js'; // must stay the first import
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export const TEST_PASSWORD = 'Password123!';

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app); // same pipes as production
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.ticket.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Registers a user through the public API, promotes it directly in the database
 * when a role other than CUSTOMER is needed (there is deliberately no API for
 * self-promotion), then logs in so the token already carries the final role.
 */
export async function createUser(
  app: INestApplication,
  prisma: PrismaService,
  options: { email: string; role?: Role },
): Promise<TestUser> {
  const { email, role = 'CUSTOMER' } = options;
  const server = app.getHttpServer();

  await request(server).post('/auth/register').send({ email, password: TEST_PASSWORD }).expect(201);

  if (role !== 'CUSTOMER') {
    await prisma.user.update({ where: { email }, data: { role } });
  }

  const res = await request(server)
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  return { id: res.body.user.id, email, token: res.body.accessToken };
}