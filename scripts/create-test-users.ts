import { PrismaClient, UserRole } from '../src/generated/prisma';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUsers() {
  console.log('🔧 Creating test users...');

  try {
    // Get or create tenants first
    let mainTenant = await prisma.tenant.findUnique({
      where: { subdomain: 'main' }
    });

    let demoTenant = await prisma.tenant.findUnique({
      where: { subdomain: 'demo' }
    });

    // Create tenants if they don't exist
    if (!mainTenant) {
      console.log('Creating main tenant...');
      mainTenant = await prisma.tenant.create({
        data: {
          id: 'main-tenant',
          name: 'Main Platform',
          subdomain: 'main',
          customDomain: null,
        },
      });
    }

    if (!demoTenant) {
      console.log('Creating demo tenant...');
      demoTenant = await prisma.tenant.create({
        data: {
          id: 'demo-tenant',
          name: 'Demo Company',
          subdomain: 'demo',
          customDomain: null,
        },
      });
    }

    // Hash passwords
    const superadminPassword = await hash('superadmin123', 12);
    const adminPassword = await hash('admin123', 12);
    const userPassword = await hash('user123', 12);

    // 1. Create Superadmin User
    console.log('Creating superadmin user...');
    const superadmin = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: 'superadmin@platform.com',
          tenantId: mainTenant.id,
        },
      },
      update: {
        password: superadminPassword,
        role: UserRole.ADMIN,
        mfaEnabled: false,
      },
      create: {
        email: 'superadmin@platform.com',
        name: 'Super Administrator',
        password: superadminPassword,
        role: UserRole.ADMIN,
        mfaEnabled: false,
        tenantId: mainTenant.id,
      },
    });

    // 2. Create Admin User
    console.log('Creating admin user...');
    const admin = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: 'admin@demo.com',
          tenantId: demoTenant.id,
        },
      },
      update: {
        password: adminPassword,
        role: UserRole.ADMIN,
        mfaEnabled: false,
      },
      create: {
        email: 'admin@demo.com',
        name: 'Demo Administrator',
        password: adminPassword,
        role: UserRole.ADMIN,
        mfaEnabled: false,
        tenantId: demoTenant.id,
      },
    });

    // 3. Create Regular User
    console.log('Creating regular user...');
    const user = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: 'user@demo.com',
          tenantId: demoTenant.id,
        },
      },
      update: {
        password: userPassword,
        role: UserRole.USER,
        mfaEnabled: false,
      },
      create: {
        email: 'user@demo.com',
        name: 'Regular User',
        password: userPassword,
        role: UserRole.USER,
        mfaEnabled: false,
        tenantId: demoTenant.id,
      },
    });

    console.log('✅ Test users created successfully!');
    console.log('');
    console.log('🏢 Available Tenants:');
    console.log(`   • ${mainTenant.name} (subdomain: ${mainTenant.subdomain})`);
    console.log(`   • ${demoTenant.name} (subdomain: ${demoTenant.subdomain})`);
    console.log('');
    console.log('👥 Test Users Created:');
    console.log('');
    console.log('🔑 SUPERADMIN:');
    console.log(`   Email: ${superadmin.email}`);
    console.log(`   Password: superadmin123`);
    console.log(`   Role: ${superadmin.role}`);
    console.log(`   Tenant: ${mainTenant.name}`);
    console.log('');
    console.log('🛡️  ADMIN:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: admin123`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Tenant: ${demoTenant.name}`);
    console.log('');
    console.log('👤 USER:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: user123`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Tenant: ${demoTenant.name}`);
    console.log('');
    console.log('🚀 You can now login with any of these accounts!');
    console.log('💡 Note: The enhanced authentication supports tenant-less login,');
    console.log('   so you can just enter email and password without specifying tenant.');

  } catch (error) {
    console.error('❌ Error creating test users:', error);
    throw error;
  }
}

createTestUsers()
  .catch(e => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });