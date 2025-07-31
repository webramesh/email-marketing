import { PrismaClient, UserRole } from '../src/generated/prisma';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function createMultiTenantUser() {
  console.log('🔧 Creating multi-tenant user for testing...');

  // Get existing tenants
  const mainTenant = await prisma.tenant.findUnique({
    where: { subdomain: 'main' }
  });

  const demoTenant = await prisma.tenant.findUnique({
    where: { subdomain: 'demo' }
  });

  if (!mainTenant || !demoTenant) {
    console.error('❌ Required tenants not found. Please run seed first.');
    return;
  }

  const password = await hash('multitenant123', 12);
  const email = 'multitenant@example.com';

  // Create user in main tenant
  const mainUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email,
        tenantId: mainTenant.id,
      },
    },
    update: {},
    create: {
      email,
      name: 'Multi-Tenant User',
      password,
      role: UserRole.ADMIN,
      mfaEnabled: false,
      tenantId: mainTenant.id,
    },
  });

  // Create user in demo tenant
  const demoUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email,
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      email,
      name: 'Multi-Tenant User',
      password,
      role: UserRole.USER,
      mfaEnabled: false,
      tenantId: demoTenant.id,
    },
  });

  console.log('✅ Multi-tenant user created successfully!');
  console.log('');
  console.log('👥 User accounts created:');
  console.log(`   🏢 ${mainTenant.name}: ${mainUser.email} (${mainUser.role})`);
  console.log(`   🏢 ${demoTenant.name}: ${demoUser.email} (${demoUser.role})`);
  console.log('');
  console.log('🔑 Login credentials:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: multitenant123`);
  console.log('');
  console.log('🧪 This user can now test tenant-less login functionality!');
}

createMultiTenantUser()
  .catch(e => {
    console.error('❌ Error creating multi-tenant user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });