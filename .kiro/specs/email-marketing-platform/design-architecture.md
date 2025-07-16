# System Architecture Design

## Multi-Tenant Architecture

### Tenant Resolution Strategy

The platform implements a sophisticated tenant resolution system supporting multiple identification methods:

```typescript
export class TenantResolver {
  async resolveTenant(req: NextRequest): Promise<TenantInfo | null> {
    // 1. Subdomain-based resolution (primary)
    const subdomain = this.extractSubdomain(req);
    if (subdomain && subdomain !== 'www') {
      const tenant = await this.findTenantBySubdomain(subdomain);
      if (tenant) return tenant;
    }
    
    // 2. Custom domain resolution (CNAME)
    const customDomain = this.extractCustomDomain(req);
    if (customDomain) {
      const tenant = await this.findTenantByCustomDomain(customDomain);
      if (tenant) return tenant;
    }
    
    // 3. Header-based resolution (API clients)
    const tenantHeader = req.headers.get('X-Tenant-ID');
    if (tenantHeader) {
      const tenant = await this.findTenantById(tenantHeader);
      if (tenant) return tenant;
    }
    
    return null;
  }
  
  private extractSubdomain(req: NextRequest): string | null {
    const host = req.headers.get('host');
    if (!host) return null;
    
    const parts = host.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }
    return null;
  }
  
  private extractCustomDomain(req: NextRequest): string | null {
    const host = req.headers.get('host');
    if (!host) return null;
    
    // Check if this is a custom domain (not our main domain)
    if (!host.includes(process.env.MAIN_DOMAIN!)) {
      return host;
    }
    return null;
  }
}
```

### Tenant Isolation Implementation

```typescript
// Tenant context middleware
export async function withTenantContext<T>(
  req: NextRequest,
  handler: (req: NextRequest, context: TenantContext) => Promise<T>
): Promise<T> {
  const resolver = new TenantResolver();
  const tenant = await resolver.resolveTenant(req);
  
  if (!tenant) {
    throw new TenantNotFoundError('Tenant not found or inactive');
  }
  
  const context: TenantContext = {
    tenantId: tenant.id,
    tenant,
    userId: null, // Will be set by auth middleware
  };
  
  return handler(req, context);
}

// Database query wrapper with automatic tenant filtering
export class TenantAwareRepository<T> {
  constructor(
    private model: any,
    private tenantId: string
  ) {}
  
  async findMany(query: any = {}): Promise<T[]> {
    return this.model.findMany({
      ...query,
      where: {
        ...query.where,
        tenantId: this.tenantId, // MANDATORY tenant filtering
      },
    });
  }
  
  async findUnique(query: any): Promise<T | null> {
    return this.model.findUnique({
      ...query,
      where: {
        ...query.where,
        tenantId: this.tenantId, // MANDATORY tenant filtering
      },
    });
  }
  
  async create(data: any): Promise<T> {
    return this.model.create({
      data: {
        ...data,
        tenantId: this.tenantId, // Auto-inject tenant ID
      },
    });
  }
  
  async update(query: any, data: any): Promise<T> {
    return this.model.update({
      ...query,
      where: {
        ...query.where,
        tenantId: this.tenantId, // MANDATORY tenant filtering
      },
      data,
    });
  }
  
  async delete(query: any): Promise<T> {
    return this.model.delete({
      ...query,
      where: {
        ...query.where,
        tenantId: this.tenantId, // MANDATORY tenant filtering
      },
    });
  }
}
```

## Service Layer Architecture

### Core Services Design

```typescript
// Base service class with tenant context
export abstract class BaseService {
  constructor(protected tenantId: string) {}
  
  protected getRepository<T>(model: any): TenantAwareRepository<T> {
    return new TenantAwareRepository<T>(model, this.tenantId);
  }
  
  protected async validateTenantAccess(resourceId: string, resourceType: string): Promise<void> {
    // Implement tenant access validation logic
    const hasAccess = await this.checkResourceAccess(resourceId, resourceType);
    if (!hasAccess) {
      throw new TenantIsolationError(`Access denied to ${resourceType}: ${resourceId}`);
    }
  }
}

// Authentication Service
export class AuthenticationService extends BaseService {
  async authenticateUser(email: string, password: string): Promise<AuthResult> {
    const userRepo = this.getRepository<User>(prisma.user);
    const user = await userRepo.findUnique({ where: { email } });
    
    if (!user || !await this.verifyPassword(password, user.passwordHash)) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    if (!user.isActive) {
      throw new AuthenticationError('Account is inactive');
    }
    
    return {
      user,
      requiresMFA: user.mfaEnabled,
      sessionToken: user.mfaEnabled ? null : await this.createSession(user),
    };
  }
  
  async verifyMFA(userId: string, code: string, type: 'email' | 'totp'): Promise<SessionToken> {
    const userRepo = this.getRepository<User>(prisma.user);
    const user = await userRepo.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    let isValid = false;
    
    if (type === 'email') {
      isValid = await this.verifyEmailOTP(userId, code);
    } else if (type === 'totp') {
      isValid = await this.verifyTOTP(user.mfaSecret!, code);
    }
    
    if (!isValid) {
      throw new AuthenticationError('Invalid MFA code');
    }
    
    return this.createSession(user);
  }
}

// Email Campaign Service
export class CampaignService extends BaseService {
  async createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
    const campaignRepo = this.getRepository<Campaign>(prisma.campaign);
    
    // Validate user belongs to tenant
    await this.validateTenantAccess(data.userId, 'user');
    
    const campaign = await campaignRepo.create({
      name: data.name,
      subject: data.subject,
      preheader: data.preheader,
      content: data.content,
      userId: data.userId,
      status: 'DRAFT',
      settings: data.settings || {},
      statistics: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      },
    });
    
    return campaign;
  }
  
  async sendCampaign(campaignId: string): Promise<CampaignExecution> {
    const campaignRepo = this.getRepository<Campaign>(prisma.campaign);
    const campaign = await campaignRepo.findUnique({ where: { id: campaignId } });
    
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }
    
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new ValidationError('Campaign cannot be sent in current status');
    }
    
    // Update campaign status
    await campaignRepo.update(
      { where: { id: campaignId } },
      { status: 'SENDING', sentAt: new Date() }
    );
    
    // Queue email sending jobs
    const subscribers = await this.getTargetSubscribers(campaignId);
    const jobs = subscribers.map(subscriber => ({
      campaignId,
      subscriberId: subscriber.id,
      tenantId: this.tenantId,
    }));
    
    await this.queueEmailJobs(jobs);
    
    return {
      campaignId,
      recipientCount: subscribers.length,
      status: 'QUEUED',
      queuedAt: new Date(),
    };
  }
}

// Subscriber Management Service
export class SubscriberService extends BaseService {
  async bulkImport(subscribers: ImportSubscriberRequest[]): Promise<BulkImportResult> {
    const subscriberRepo = this.getRepository<Subscriber>(prisma.subscriber);
    const results: BulkImportResult = {
      total: subscribers.length,
      imported: 0,
      updated: 0,
      errors: [],
    };
    
    for (const [index, subscriberData] of subscribers.entries()) {
      try {
        // Validate email format
        if (!this.isValidEmail(subscriberData.email)) {
          results.errors.push({
            row: index + 1,
            email: subscriberData.email,
            error: 'Invalid email format',
          });
          continue;
        }
        
        // Check if subscriber exists
        const existing = await subscriberRepo.findUnique({
          where: { email: subscriberData.email }
        });
        
        if (existing) {
          // Update existing subscriber
          await subscriberRepo.update(
            { where: { id: existing.id } },
            {
              firstName: subscriberData.firstName || existing.firstName,
              lastName: subscriberData.lastName || existing.lastName,
              customFields: { ...existing.customFields, ...subscriberData.customFields },
              tags: [...new Set([...existing.tags, ...subscriberData.tags])],
            }
          );
          results.updated++;
        } else {
          // Create new subscriber
          await subscriberRepo.create({
            email: subscriberData.email,
            firstName: subscriberData.firstName,
            lastName: subscriberData.lastName,
            customFields: subscriberData.customFields || {},
            tags: subscriberData.tags || [],
            status: 'SUBSCRIBED',
            subscriptionDate: new Date(),
          });
          results.imported++;
        }
      } catch (error) {
        results.errors.push({
          row: index + 1,
          email: subscriberData.email,
          error: error.message,
        });
      }
    }
    
    return results;
  }
  
  async createSegment(segmentData: CreateSegmentRequest): Promise<Segment> {
    const segmentRepo = this.getRepository<Segment>(prisma.segment);
    
    const segment = await segmentRepo.create({
      name: segmentData.name,
      description: segmentData.description,
      conditions: segmentData.conditions,
      isActive: true,
    });
    
    // Calculate initial subscriber count
    const subscriberCount = await this.evaluateSegmentCount(segment.id);
    await segmentRepo.update(
      { where: { id: segment.id } },
      { subscriberCount }
    );
    
    return segment;
  }
}
```

## Queue and Background Processing

### Email Queue Architecture

```typescript
// Email queue configuration
export class EmailQueueManager {
  private emailQueue: Queue;
  private automationQueue: Queue;
  
  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
    };
    
    this.emailQueue = new Queue('email-sending', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
    
    this.automationQueue = new Queue('automation-processing', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
      },
    });
    
    this.setupProcessors();
  }
  
  private setupProcessors(): void {
    // Email sending processor
    this.emailQueue.process('send-email', 10, async (job) => {
      const { campaignId, subscriberId, tenantId } = job.data;
      
      try {
        const emailService = new EmailSendingService(tenantId);
        const result = await emailService.sendCampaignEmail(campaignId, subscriberId);
        
        // Update campaign statistics
        await this.updateCampaignStats(campaignId, result);
        
        return result;
      } catch (error) {
        // Log error and handle retries
        logger.error('Email sending failed', {
          campaignId,
          subscriberId,
          tenantId,
          error: error.message,
        });
        throw error;
      }
    });
    
    // Automation processor
    this.automationQueue.process('execute-workflow', 5, async (job) => {
      const { workflowId, subscriberId, triggerData, tenantId } = job.data;
      
      const automationService = new AutomationService(tenantId);
      return automationService.executeWorkflow(workflowId, subscriberId, triggerData);
    });
  }
  
  async addEmailJob(data: EmailJobData): Promise<void> {
    await this.emailQueue.add('send-email', data, {
      priority: data.priority || 0,
      delay: data.delay || 0,
    });
  }
  
  async addAutomationJob(data: AutomationJobData): Promise<void> {
    await this.automationQueue.add('execute-workflow', data);
  }
}
```

## Caching Strategy

### Multi-Level Caching Architecture

```typescript
export class CacheManager {
  private redis: Redis;
  private localCache: Map<string, CacheEntry>;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
    
    this.localCache = new Map();
    
    // Clean up local cache every 5 minutes
    setInterval(() => this.cleanupLocalCache(), 5 * 60 * 1000);
  }
  
  async get<T>(key: string, tenantId: string): Promise<T | null> {
    const tenantKey = this.getTenantKey(key, tenantId);
    
    // Check local cache first (L1)
    const localEntry = this.localCache.get(tenantKey);
    if (localEntry && !this.isExpired(localEntry)) {
      return localEntry.value as T;
    }
    
    // Check Redis cache (L2)
    const redisValue = await this.redis.get(tenantKey);
    if (redisValue) {
      const parsed = JSON.parse(redisValue) as T;
      
      // Store in local cache
      this.localCache.set(tenantKey, {
        value: parsed,
        expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes local cache
      });
      
      return parsed;
    }
    
    return null;
  }
  
  async set<T>(key: string, value: T, tenantId: string, ttl: number = 3600): Promise<void> {
    const tenantKey = this.getTenantKey(key, tenantId);
    
    // Store in Redis
    await this.redis.setex(tenantKey, ttl, JSON.stringify(value));
    
    // Store in local cache
    this.localCache.set(tenantKey, {
      value,
      expiresAt: Date.now() + Math.min(ttl * 1000, 5 * 60 * 1000),
    });
  }
  
  async invalidate(pattern: string, tenantId: string): Promise<void> {
    const tenantPattern = this.getTenantKey(pattern, tenantId);
    
    // Clear from Redis
    const keys = await this.redis.keys(tenantPattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    // Clear from local cache
    for (const key of this.localCache.keys()) {
      if (key.includes(tenantId) && key.includes(pattern.replace('*', ''))) {
        this.localCache.delete(key);
      }
    }
  }
  
  private getTenantKey(key: string, tenantId: string): string {
    return `tenant:${tenantId}:${key}`;
  }
  
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }
  
  private cleanupLocalCache(): void {
    for (const [key, entry] of this.localCache.entries()) {
      if (this.isExpired(entry)) {
        this.localCache.delete(key);
      }
    }
  }
}
```

## Performance Optimization

### Database Connection Pooling

```typescript
// Prisma client with optimized connection pooling
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Connection pool configuration
const poolConfig = {
  max: parseInt(process.env.DB_POOL_SIZE || '100'),
  min: parseInt(process.env.DB_POOL_MIN || '10'),
  acquire: 30000,
  idle: 10000,
  evict: 1000,
};
```

### Query Optimization

```typescript
// Optimized query patterns
export class OptimizedQueries {
  // Use cursor-based pagination for large datasets
  static async getPaginatedCampaigns(
    tenantId: string,
    cursor?: string,
    limit: number = 20
  ): Promise<PaginatedResult<Campaign>> {
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { sends: true },
        },
      },
    });
    
    const hasNextPage = campaigns.length > limit;
    const items = hasNextPage ? campaigns.slice(0, -1) : campaigns;
    
    return {
      items,
      hasNextPage,
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
    };
  }
  
  // Batch operations for better performance
  static async batchUpdateSubscriberStatus(
    tenantId: string,
    subscriberIds: string[],
    status: SubscriberStatus
  ): Promise<void> {
    await prisma.subscriber.updateMany({
      where: {
        tenantId,
        id: { in: subscriberIds },
      },
      data: { status },
    });
  }
  
  // Optimized analytics queries
  static async getCampaignAnalytics(
    tenantId: string,
    campaignId: string
  ): Promise<CampaignAnalytics> {
    const [campaign, sends, opens, clicks, bounces] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id: campaignId, tenantId },
      }),
      prisma.campaignSend.count({
        where: { campaignId, tenantId },
      }),
      prisma.campaignOpen.count({
        where: { campaignId, tenantId },
      }),
      prisma.campaignClick.count({
        where: { campaignId, tenantId },
      }),
      prisma.campaignBounce.count({
        where: { campaignId, tenantId },
      }),
    ]);
    
    return {
      campaign,
      statistics: {
        sent: sends,
        opened: opens,
        clicked: clicks,
        bounced: bounces,
        openRate: sends > 0 ? (opens / sends) * 100 : 0,
        clickRate: sends > 0 ? (clicks / sends) * 100 : 0,
        bounceRate: sends > 0 ? (bounces / sends) * 100 : 0,
      },
    };
  }
}
```

This architecture design provides a solid foundation for building a scalable, secure, and high-performance email marketing platform with proper tenant isolation and modern architectural patterns.