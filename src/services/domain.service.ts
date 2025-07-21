import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';

const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);

export interface CreateDomainData {
  name: string;
  isTrackingDomain?: boolean;
}

export interface DKIMKeys {
  selector: string;
  privateKey: string;
  publicKey: string;
}

export interface DNSRecords {
  dkim: {
    name: string;
    type: 'TXT';
    value: string;
    status: 'pending' | 'verified' | 'failed';
  };
  spf: {
    name: string;
    type: 'TXT';
    value: string;
    status: 'pending' | 'verified' | 'failed';
  };
  dmarc?: {
    name: string;
    type: 'TXT';
    value: string;
    status: 'pending' | 'verified' | 'failed';
  };
  cname?: {
    name: string;
    type: 'CNAME';
    value: string;
    status: 'pending' | 'verified' | 'failed';
  };
}

export class DomainService {
  async createDomain(tenantId: string, data: CreateDomainData) {
    // Check if domain already exists
    const existingDomain = await prisma.domain.findFirst({
      where: {
        name: data.name,
        tenantId,
      },
    });

    if (existingDomain) {
      throw new Error('Domain already exists');
    }

    // Generate DKIM keys
    const dkimKeys = this.generateDKIMKeys();

    const domain = await prisma.domain.create({
      data: {
        tenantId,
        name: data.name,
        isVerified: false,
        dkimSelector: dkimKeys.selector,
        dkimPrivateKey: dkimKeys.privateKey,
        dkimPublicKey: dkimKeys.publicKey,
      },
    });

    return {
      domain,
      dnsRecords: this.getDNSRecords(domain.name, dkimKeys),
    };
  }

  async updateDomain(domainId: string, tenantId: string, data: Partial<CreateDomainData>) {
    const domain = await prisma.domain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    const updatedDomain = await prisma.domain.update({
      where: {
        id: domainId,
      },
      data: {
        name: data.name,
        updatedAt: new Date(),
      },
    });

    return updatedDomain;
  }

  async deleteDomain(domainId: string, tenantId: string) {
    const domain = await prisma.domain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    await prisma.domain.delete({
      where: {
        id: domainId,
      },
    });

    return { success: true };
  }

  async getDomains(tenantId: string) {
    const domains = await prisma.domain.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return domains;
  }

  async getDomain(domainId: string, tenantId: string) {
    const domain = await prisma.domain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    const dkimKeys = {
      selector: domain.dkimSelector!,
      privateKey: domain.dkimPrivateKey!,
      publicKey: domain.dkimPublicKey!,
    };

    return {
      domain,
      dnsRecords: this.getDNSRecords(domain.name, dkimKeys),
    };
  }

  async verifyDomain(domainId: string, tenantId: string) {
    const domain = await prisma.domain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    const dkimKeys = {
      selector: domain.dkimSelector!,
      privateKey: domain.dkimPrivateKey!,
      publicKey: domain.dkimPublicKey!,
    };

    const dnsRecords = this.getDNSRecords(domain.name, dkimKeys);
    const verificationResults = await this.verifyDNSRecords(domain.name, dnsRecords);

    // Update domain verification status
    const isVerified =
      verificationResults.dkim.status === 'verified' &&
      verificationResults.spf.status === 'verified';

    await prisma.domain.update({
      where: {
        id: domainId,
      },
      data: {
        isVerified,
        updatedAt: new Date(),
      },
    });

    return {
      domain: { ...domain, isVerified },
      dnsRecords: verificationResults,
    };
  }

  async regenerateDKIMKeys(domainId: string, tenantId: string) {
    const domain = await prisma.domain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    const dkimKeys = this.generateDKIMKeys();

    const updatedDomain = await prisma.domain.update({
      where: {
        id: domainId,
      },
      data: {
        dkimSelector: dkimKeys.selector,
        dkimPrivateKey: dkimKeys.privateKey,
        dkimPublicKey: dkimKeys.publicKey,
        isVerified: false, // Reset verification status
        updatedAt: new Date(),
      },
    });

    return {
      domain: updatedDomain,
      dnsRecords: this.getDNSRecords(updatedDomain.name, dkimKeys),
    };
  }

  private generateDKIMKeys(): DKIMKeys {
    const { generateKeyPairSync } = crypto;

    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    // Generate a random selector
    const selector = `dkim${Date.now()}`;

    return {
      selector,
      privateKey,
      publicKey,
    };
  }

  private getDNSRecords(
    domainName: string,
    dkimKeys: { selector: string; privateKey: string; publicKey: string }
  ): DNSRecords {
    // Generate DNS record from public key
    const dnsRecord = `v=DKIM1; k=rsa; p=${dkimKeys.publicKey.replace(
      /-----BEGIN PUBLIC KEY-----|\-----END PUBLIC KEY-----|\n/g,
      ''
    )}`;

    return {
      dkim: {
        name: `${dkimKeys.selector}._domainkey.${domainName}`,
        type: 'TXT',
        value: dnsRecord,
        status: 'pending',
      },
      spf: {
        name: domainName,
        type: 'TXT',
        value: 'v=spf1 include:_spf.google.com ~all',
        status: 'pending',
      },
      dmarc: {
        name: `_dmarc.${domainName}`,
        type: 'TXT',
        value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domainName}`,
        status: 'pending',
      },
    };
  }

  private async verifyDNSRecords(domainName: string, dnsRecords: DNSRecords): Promise<DNSRecords> {
    const results = { ...dnsRecords };

    try {
      // Verify DKIM record
      try {
        const dkimRecords = await resolveTxt(dnsRecords.dkim.name);
        const dkimRecord = dkimRecords.flat().find(record => record.includes('v=DKIM1'));

        if (
          dkimRecord &&
          dkimRecord.includes(dnsRecords.dkim.value.split('p=')[1]?.split(';')[0] || '')
        ) {
          results.dkim.status = 'verified';
        } else {
          results.dkim.status = 'failed';
        }
      } catch (error) {
        results.dkim.status = 'failed';
      }

      // Verify SPF record
      try {
        const spfRecords = await resolveTxt(domainName);
        const spfRecord = spfRecords.flat().find(record => record.includes('v=spf1'));

        if (spfRecord) {
          results.spf.status = 'verified';
        } else {
          results.spf.status = 'failed';
        }
      } catch (error) {
        results.spf.status = 'failed';
      }

      // Verify DMARC record
      if (results.dmarc && dnsRecords.dmarc) {
        try {
          const dmarcRecords = await resolveTxt(dnsRecords.dmarc.name);
          const dmarcRecord = dmarcRecords.flat().find(record => record.includes('v=DMARC1'));

          if (dmarcRecord) {
            results.dmarc.status = 'verified';
          } else {
            results.dmarc.status = 'failed';
          }
        } catch (error) {
          results.dmarc.status = 'failed';
        }
      }

      // Verify CNAME record (if applicable)
      if (results.cname && dnsRecords.cname) {
        try {
          const cnameRecords = await resolveCname(dnsRecords.cname.name);

          if (cnameRecords.includes(dnsRecords.cname.value)) {
            results.cname.status = 'verified';
          } else {
            results.cname.status = 'failed';
          }
        } catch (error) {
          results.cname.status = 'failed';
        }
      }
    } catch (error) {
      console.error('DNS verification error:', error);
    }

    return results;
  }

  async getDomainStats(tenantId: string) {
    const domains = await this.getDomains(tenantId);

    const stats = await Promise.all(
      domains.map(async domain => {
        // Get email sending stats for this domain
        const totalSent = await prisma.auditLog.count({
          where: {
            tenantId,
            action: 'EMAIL_SEND',
            metadata: {
              path: 'success',
              equals: true,
            },
          },
        });

        const totalFailed = await prisma.auditLog.count({
          where: {
            tenantId,
            action: 'EMAIL_SEND',
            metadata: {
              path: 'success',
              equals: false,
            },
          },
        });

        return {
          domainId: domain.id,
          domainName: domain.name,
          isVerified: domain.isVerified,
          totalSent,
          totalFailed,
          successRate:
            totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 0,
          createdAt: domain.createdAt,
        };
      })
    );

    return stats;
  }
}
