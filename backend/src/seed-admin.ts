import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './config/database';

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@malesin.ai';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const companyName = process.env.COMPANY_NAME || 'Malesin.AI';

  let company = await prisma.company.findFirst({ where: { slug: companyName.toLowerCase().replace(/\s+/g, '-') } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        slug: companyName.toLowerCase().replace(/\s+/g, '-'),
        email: `admin@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        isActive: true,
      },
    });
    console.log('Company CREATED:', company.name);
  } else {
    console.log('Company already exists:', company.name);
  }

  let adminUser = await prisma.user.findFirst({ where: { email, companyId: company.id } });
  if (adminUser) {
    console.log('Admin user already exists:', adminUser.email);
  } else {
    const hashedPassword = await bcrypt.hash(password, 12);
    adminUser = await prisma.user.create({
      data: {
        companyId: company.id,
        name: 'Admin',
        email,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('Admin user CREATED:', adminUser.email);
  }

  console.log('');
  console.log('=== ADMIN CREDENTIALS ===');
  console.log('  Email:    ', email);
  console.log('  Password: ', password);
  console.log('  Company:  ', company.name);
  console.log('  Role:     ', adminUser.role);
  console.log('');
  console.log('Run the app and login at http://localhost:5173/login');
  console.log('');

  await prisma.$disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
