import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { createError } from '../../middlewares/error.middleware';

export interface RegisterDto {
  companyName: string;
  companyEmail: string;
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export class AuthService {
  async register(dto: RegisterDto) {
    const existingCompany = await prisma.company.findUnique({ where: { email: dto.companyEmail } });
    if (existingCompany) throw createError('Company email already registered', 409);

    const slug = dto.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const company = await prisma.company.create({
      data: {
        name: dto.companyName,
        slug,
        email: dto.companyEmail,
        users: {
          create: {
            name: dto.name,
            email: dto.email,
            password: hashedPassword,
            role: 'OWNER',
          },
        },
      },
      include: { users: true },
    });

    const user = company.users[0];
    const payload = { userId: user.id, companyId: company.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    return { accessToken, refreshToken, user: { ...user, password: undefined, refreshToken: undefined }, company };
  }

  async login(dto: LoginDto, companySlug?: string) {
    const whereClause = companySlug
      ? { email: dto.email, company: { slug: companySlug } }
      : { email: dto.email };

    const user = await prisma.user.findFirst({
      where: whereClause,
      include: { company: true },
    });

    if (!user) throw createError('Invalid credentials', 401);
    if (!user.isActive) throw createError('Account deactivated', 403);

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw createError('Invalid credentials', 401);

    const payload = { userId: user.id, companyId: user.companyId, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken, lastLoginAt: new Date() } });

    const { password, refreshToken: _rt, ...safeUser } = user;
    void password;
    return { accessToken, refreshToken, user: safeUser };
  }

  async refresh(token: string) {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.refreshToken !== token) throw createError('Invalid refresh token', 401);

    const newPayload = { userId: user.id, companyId: user.companyId, role: user.role };
    const accessToken = signAccessToken(newPayload);
    const refreshToken = signRefreshToken(newPayload);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });
    return { accessToken, refreshToken };
  }

  async logout(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
      omit: { password: true, refreshToken: true },
    });
    if (!user) throw createError('User not found', 404);
    return user;
  }
}
