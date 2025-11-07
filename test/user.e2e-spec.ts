import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/user/user.service';

describe('User (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let userService: UserService;

  // Mock JWT payload
  const mockJwtPayload = {
    sub: 'auth0|test123456',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    email_verified: true,
  };

  // Mock user data
  const mockUser = {
    id: 'user-123',
    auth0Id: 'auth0|test123456',
    email: 'test@example.com',
    username: 'test_user',
    profilePic: 'https://example.com/pic.jpg',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    userService = moduleFixture.get<UserService>(UserService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await prismaService.user.deleteMany();
  });

  describe('/user/profile (GET)', () => {
    it('should return user profile for authenticated user', async () => {
      // Create a user in the database
      await prismaService.user.create({
        data: {
          auth0Id: 'auth0|test123456',
          email: 'test@example.com',
          username: 'test_user',
          profilePic: 'https://example.com/pic.jpg',
          emailVerified: true,
        },
      });

      // Mock the JWT strategy to return our test user
      jest.spyOn(userService, 'findOrCreateUser').mockResolvedValue(mockUser);

      return request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'user-123');
          expect(res.body).toHaveProperty('email', 'test@example.com');
          expect(res.body).toHaveProperty('username', 'test_user');
        });
    });

    it('should return 401 when no authorization header provided', () => {
      return request(app.getHttpServer()).get('/user/profile').expect(401);
    });

    it('should return 401 when invalid token provided', () => {
      return request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle user with minimal data', async () => {
      const minimalUser = {
        id: 'user-minimal',
        auth0Id: 'auth0|minimal123',
        email: 'minimal@example.com',
        username: null,
        profilePic: null,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      // Create a minimal user in the database
      await prismaService.user.create({
        data: {
          auth0Id: 'auth0|minimal123',
          email: 'minimal@example.com',
          emailVerified: false,
        },
      });

      // Mock the JWT strategy
      jest
        .spyOn(userService, 'findOrCreateUser')
        .mockResolvedValue(minimalUser);

      return request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'user-minimal');
          expect(res.body).toHaveProperty('email', 'minimal@example.com');
          expect(res.body).toHaveProperty('username', null);
          expect(res.body).toHaveProperty('profilePic', null);
          expect(res.body).toHaveProperty('emailVerified', false);
        });
    });
  });

  describe('User Creation Flow', () => {
    it('should create new user on first login', async () => {
      const newUser = {
        id: 'user-new',
        auth0Id: 'auth0|newuser123',
        email: 'new@example.com',
        username: 'new_user',
        profilePic: 'https://example.com/new.jpg',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      // Mock the JWT strategy to simulate new user creation
      jest.spyOn(userService, 'findOrCreateUser').mockResolvedValue(newUser);

      return request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'user-new');
          expect(res.body).toHaveProperty('email', 'new@example.com');
          expect(res.body).toHaveProperty('username', 'new_user');
        });
    });

    it('should update existing user on subsequent logins', async () => {
      // Create existing user
      await prismaService.user.create({
        data: {
          auth0Id: 'auth0|existing123',
          email: 'existing@example.com',
          username: 'existing_user',
          profilePic: 'https://old.com/pic.jpg',
          emailVerified: false,
        },
      });

      const updatedUser = {
        id: 'user-existing',
        auth0Id: 'auth0|existing123',
        email: 'existing@example.com',
        username: 'existing_user',
        profilePic: 'https://new.com/pic.jpg',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      };

      // Mock the JWT strategy to simulate user update
      jest
        .spyOn(userService, 'findOrCreateUser')
        .mockResolvedValue(updatedUser);

      return request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'user-existing');
          expect(res.body).toHaveProperty('email', 'existing@example.com');
          expect(res.body).toHaveProperty(
            'profilePic',
            'https://new.com/pic.jpg',
          );
          expect(res.body).toHaveProperty('emailVerified', true);
        });
    });
  });
});
