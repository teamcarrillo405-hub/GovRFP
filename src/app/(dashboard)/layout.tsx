import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/shell/AppHeader';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppFooter } from '@/components/shell/AppFooter';
import { createClient } from '@/lib/supabase/server';
import { checkSubscription } from '@/lib/billing/subscription-check';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const initials = user.email ? user.email.substring(0, 2).toUpperCase() : 'GC';

  const subscription = await checkSubscription(user.id);
  const showBanner = subscription.status === 'past_due' || subscription.status === 'canceled';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader userInitials={initials} />

      {/* Billing alert banner */}
      {showBanner && (
        <div
          style={{
            position: 'sticky',
            top: 52,
            zIndex: 150,
            background: '#dc2626',
            color: '#fff',
            padding: '10px 16px',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span>
            {subscription.status === 'past_due'
              ? 'Your payment is past due. Please update your billing information to restore access.'
              : 'Your subscription has been canceled. Renew to continue using AI features.'}
          </span>
          <Link
            href="/account"
            style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline' }}
          >
            Manage billing
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1 }}>
        <AppSidebar />
        <main style={{ flex: 1, padding: 28, overflow: 'visible', background: '#0B0B0D' }} className="cmd-grid">
          {children}
        </main>
      </div>

      <AppFooter />
    </div>
  );
}
