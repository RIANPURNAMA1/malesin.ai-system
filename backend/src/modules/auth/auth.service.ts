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

    return { accessToken, refreshToken, user: { ...user, password: undefined, refreshToken: undefined, facebookAccessToken: undefined }, company };
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

    // Jangan kirim kredensial / token ke frontend.
    const { password, refreshToken: _rt, facebookAccessToken: _fat, ...safeUser } = user;
    void password; void _fat;
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
    // `omit` belum didukung Prisma 5 tanpa preview feature (dulu bikin 500),
    // jadi field sensitif dibuang manual.
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
    if (!user) throw createError('User not found', 404);
    const { password, refreshToken, facebookAccessToken, ...safeUser } = user;
    void password; void refreshToken; void facebookAccessToken;
    return safeUser;
  }

  /** Ubah nama / email / avatar milik sendiri. */
  async updateProfile(userId: string, dto: { name?: string; email?: string; avatar?: string | null }) {
    const name = dto.name?.trim();
    const email = dto.email?.trim().toLowerCase();
    if (dto.name !== undefined && (!name || name.length > 100)) throw createError('Nama wajib diisi (maks. 100 karakter)', 400);
    if (dto.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) throw createError('Format email tidak valid', 400);
    if (dto.avatar && !/^https?:\/\//i.test(dto.avatar)) throw createError('URL foto tidak valid', 400);
    if (email) {
      // Login hanya memakai email (tanpa company), jadi email harus unik global.
      const taken = await prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
      if (taken) throw createError('Email sudah dipakai akun lain', 409);
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar || null } : {}),
      },
    });
    return this.getProfile(userId);
  }

  /**
   * Ganti password. Refresh token lama dicabut (sesi di perangkat lain berakhir);
   * perangkat ini menerima token baru supaya tetap login.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw createError('Password baru minimal 8 karakter', 400);
    if (newPassword === currentPassword) throw createError('Password baru harus berbeda dari password lama', 400);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw createError('User not found', 404);
    if (!(await bcrypt.compare(currentPassword || '', user.password))) throw createError('Password saat ini salah', 400);

    const payload = { userId: user.id, companyId: user.companyId, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(newPassword, 12), refreshToken },
    });
    return { accessToken, refreshToken };
  }
}
