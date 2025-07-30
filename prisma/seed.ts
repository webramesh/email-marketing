import { PrismaClient, UserRole, SubscriberStatus, CampaignStatus } from '../src/generated/prisma';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create subscription plans
  const basicPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'basic-plan' },
    update: {},
    create: {
      id: 'basic-plan',
      name: 'Basic Plan',
      price: 29.99,
      billingCycle: 'monthly',
      features: {
        maxSubscribers: 10000,
        maxEmailsPerMonth: 50000,
        maxCampaigns: 10,
        automationWorkflows: true,
        analytics: true,
        support: 'email',
      },
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'pro-plan' },
    update: {},
    create: {
      id: 'pro-plan',
      name: 'Pro Plan',
      price: 79.99,
      billingCycle: 'monthly',
      features: {
        maxSubscribers: 50000,
        maxEmailsPerMonth: 250000,
        maxCampaigns: 50,
        automationWorkflows: true,
        analytics: true,
        advancedSegmentation: true,
        abTesting: true,
        support: 'priority',
      },
    },
  });

  // Create main tenant for superadmin
  const mainTenant = await prisma.tenant.upsert({
    where: { subdomain: 'main' },
    update: {},
    create: {
      id: 'main-tenant',
      name: 'Main Platform',
      subdomain: 'main',
      customDomain: null,
      subscriptionPlanId: proPlan.id,
    },
  });

  // Create demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      id: 'demo-tenant',
      name: 'Demo Company',
      subdomain: 'demo',
      customDomain: null,
      subscriptionPlanId: basicPlan.id,
    },
  });

  // Create superadmin user for main tenant
  const superadminPassword = await hash('superadmin123', 12);
  const superadminUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'superadmin@platform.com',
        tenantId: mainTenant.id,
      },
    },
    update: {},
    create: {
      email: 'superadmin@platform.com',
      name: 'Super Administrator',
      password: superadminPassword,
      role: UserRole.ADMIN,
      mfaEnabled: false,
      tenantId: mainTenant.id,
    },
  });

  // Create regular user for demo tenant
  const userPassword = await hash('user123', 12);
  const regularUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'user@demo.com',
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      email: 'user@demo.com',
      name: 'Regular User',
      password: userPassword,
      role: UserRole.USER,
      mfaEnabled: false,
      tenantId: demoTenant.id,
    },
  });

  // Create admin user for demo tenant
  const hashedPassword = await hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'admin@demo.com',
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      email: 'admin@demo.com',
      name: 'Demo Admin',
      password: hashedPassword,
      role: UserRole.ADMIN,
      mfaEnabled: false,
      tenantId: demoTenant.id,
    },
  });

  // Create a user with MFA enabled for testing
  const mfaUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'mfa@demo.com',
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      email: 'mfa@demo.com',
      name: 'MFA Test User',
      password: hashedPassword,
      role: UserRole.USER,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP', // Test secret for 'otpauth://totp/Test:mfa@demo.com?secret=JBSWY3DPEHPK3PXP&issuer=Test'
      // Skip setting mfaBackupCodes for now as it's causing type errors
      tenantId: demoTenant.id,
    },
  });

  // Create sample subscribers for demo tenant
  const sampleSubscribers = [
    {
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      customFields: { company: 'Tech Corp', industry: 'Technology' },
    },
    {
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      customFields: { company: 'Marketing Inc', industry: 'Marketing' },
    },
    {
      email: 'bob.wilson@example.com',
      firstName: 'Bob',
      lastName: 'Wilson',
      customFields: { company: 'Sales LLC', industry: 'Sales' },
    },
  ];

  for (const subscriberData of sampleSubscribers) {
    await prisma.subscriber.upsert({
      where: {
        email_tenantId: {
          email: subscriberData.email,
          tenantId: demoTenant.id,
        },
      },
      update: {},
      create: {
        ...subscriberData,
        status: SubscriberStatus.ACTIVE,
        tenantId: demoTenant.id,
      },
    });
  }

  // Create sample list
  const sampleList = await prisma.list.upsert({
    where: { id: 'demo-list' },
    update: {},
    create: {
      id: 'demo-list',
      name: 'Newsletter Subscribers',
      description: 'Main newsletter subscriber list',
      tenantId: demoTenant.id,
    },
  });

  // Create sample campaign
  await prisma.campaign.upsert({
    where: { id: 'demo-campaign' },
    update: {},
    create: {
      id: 'demo-campaign',
      name: 'Welcome Campaign',
      subject: 'Welcome to our newsletter!',
      content: `
        <html>
          <body>
            <h1>Welcome!</h1>
            <p>Thank you for subscribing to our newsletter.</p>
            <p>We're excited to have you on board!</p>
          </body>
        </html>
      `,
      status: CampaignStatus.DRAFT,
      tenantId: demoTenant.id,
    },
  });

  // Create sample sending server configuration
  await prisma.sendingServer.upsert({
    where: { id: 'demo-smtp' },
    update: {},
    create: {
      id: 'demo-smtp',
      name: 'Demo SMTP Server',
      type: 'smtp',
      configuration: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'demo@example.com',
          pass: 'password',
        },
      },
      isActive: true,
      tenantId: demoTenant.id,
    },
  });

  // Create sample domain
  await prisma.domain.upsert({
    where: {
      name_tenantId: {
        name: 'demo.example.com',
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      name: 'demo.example.com',
      isVerified: false,
      dkimSelector: 'default',
      tenantId: demoTenant.id,
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log(`📊 Created tenant: ${demoTenant.name} (${demoTenant.subdomain})`);
  console.log(`👤 Created admin user: ${adminUser.email}`);
  console.log(`� CCreated MFA test user: ${mfaUser.email}`);
  console.log(`📧 Created ${sampleSubscribers.length} sample subscribers`);
}

main()
  .catch(e => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
