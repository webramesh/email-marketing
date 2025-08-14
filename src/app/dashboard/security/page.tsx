import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SecurityDashboard } from '@/components/security/SecurityDashboard';

export const metadata: Metadata = {
    title: 'Security Dashboard - Email Marketing Platform',
    description: 'Monitor security threats, login attempts, and manage access controls',
};

export default async function SecurityDashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/auth/signin');
    }

    // Only allow ADMIN and SUPERADMIN roles to access security dashboard
    if (!['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
        redirect('/forbidden');
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <SecurityDashboard />
        </div>
    );
}