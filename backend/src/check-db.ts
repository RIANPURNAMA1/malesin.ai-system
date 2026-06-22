import 'dotenv/config';
import prisma from './config/database';

async function main() {
  const channels = await prisma.channel.findMany({
    where: { type: 'WHATSAPP' },
    select: { id: true, verifyToken: true, wabaId: true, phoneNumberId: true, isActive: true },
  });
  console.log('WhatsApp channels:', JSON.stringify(channels, null, 2));
  console.log('Count:', channels.length);
  await prisma.$disconnect();
}

main();
