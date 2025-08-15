import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ComplianceAuditDashboard from '@/components/compliance/ComplianceAuditDashboard';

export const metadata: Metadata = {
  title: 'Compliance & Audit - Email Marketing Platform',
  description: 'Manage audit logs, compliance reports, privacy settings, and data retention policies',
};

export default async function CompliancePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Only allow admins and superadmins to access compliance features
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
    redirect('/forbidden');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ComplianceAuditDashboard />
    </div>
  );
}