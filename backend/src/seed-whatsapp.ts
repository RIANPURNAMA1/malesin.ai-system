import 'dotenv/config';
import prisma from './config/database';
import { encrypt } from './utils/encryption';

async function seed() {
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('No company found. Run the app and create an account first.');
    process.exit(1);
  }

  const token = process.env.WHATSAPP_TOKEN || 'EAAVlMgq0Ac8BRqfiSQsosmZAsuZBPbZBKBZCJ8bjJqLxf33NWOBwrIYhWiWyqPEnFz1kMvZAQ4lhNGRqogCfCVur7xCVq3Bmqky9Qxm7hL4kZCXbGdFKK1pc9is5jUSfASky3Ylihrr8mxJPQfV0yjQnRrQ39rsBAaNNQRDZAfulwPBjCEQcP2ScgqukUvgHkhyDQZDZD';

  let channel = await prisma.channel.findFirst({
    where: { companyId: company.id, type: 'WHATSAPP' },
  });

  const data = {
    companyId: company.id,
    name: 'WhatsApp Business',
    type: 'WHATSAPP' as const,
    wabaId: '1966039760642881',
    phoneNumberId: '1026611467194694',
    accessToken: encrypt(token),
    verifyToken: 'malesan_verify_2026',
    isActive: true,
  };

  if (channel) {
    channel = await prisma.channel.update({
      where: { id: channel.id },
      data,
    });
    console.log('WhatsApp channel UPDATED:', channel.id);
  } else {
    channel = await prisma.channel.create({ data });
    console.log('WhatsApp channel CREATED:', channel.id);
  }

  console.log('WABA ID:', channel.wabaId);
  console.log('Phone Number ID:', channel.phoneNumberId);
  console.log('');
  console.log('=== WEBHOOK SETUP ===');
  console.log('Isi di Meta WhatsApp Manager > Webhook:');
  console.log('  Callback URL:', `http://localhost:5000/api/webhook`);
  console.log('  Verify Token: malesan_verify_2026');
  console.log('');
  console.log('Subscribe ke: messages, message_deliveries, message_reads');
  console.log('');
  console.log('Selesai! Restart backend.');

  await prisma.$disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
