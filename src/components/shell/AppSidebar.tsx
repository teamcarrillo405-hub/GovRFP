'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  KanbanSquare,
  Search,
  FileText,
  Grid,
  Library,
  Award,
  BarChart2,
  Target,
  Users,
  Plug,
  CreditCard,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'WORKSPACE',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={15} strokeWidth={1.5} /> },
      { label: 'Pipeline', href: '/pipeline', icon: <KanbanSquare size={15} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'PROPOSALS',
    items: [
      { label: 'All Proposals', href: '/proposals', icon: <FileText size={15} strokeWidth={1.5} /> },
      { label: 'Compliance Matrix', href: '/proposals/compliance', icon: <Grid size={15} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { label: 'Opportunities', href: '/opportunities', icon: <Search size={15} strokeWidth={1.5} /> },
      { label: 'Content Library', href: '/library', icon: <Library size={15} strokeWidth={1.5} /> },
      { label: 'Past Performance', href: '/past-performance', icon: <Award size={15} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'ANALYZE',
    items: [
      { label: 'Analytics', href: '/analytics', icon: <BarChart2 size={15} strokeWidth={1.5} /> },
      { label: 'Scoring & Red Team', href: '/scoring', icon: <Target size={15} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { label: 'Team', href: '/team', icon: <Users size={15} strokeWidth={1.5} /> },
      { label: 'Integrations', href: '/account', icon: <Plug size={15} strokeWidth={1.5} /> },
      { label: 'Billing', href: '/account#billing', icon: <CreditCard size={15} strokeWidth={1.5} /> },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: 220,
        position: 'sticky',
        top: 52,
        height: 'calc(100vh - 52px)',
        background: '#0B1220',
        overflowY: 'auto',
        flexShrink: 0,
        padding: '12px 0',
      }}
    >
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: 4 }}>
          {/* Section label */}
          <div
            style={{
              padding: '8px 16px 4px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#263447',
            }}
          >
            {section.title}
          </div>

          {/* Nav items */}
          {section.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: isActive ? '#fff' : '#9AA4B2',
                  textDecoration: 'none',
                  background: isActive ? '#1E2B3C' : 'transparent',
                  borderLeft: isActive ? '2px solid #2F80FF' : '2px solid transparent',
                  transition: 'all 0.1s',
                }}
              >
                <span style={{ color: isActive ? '#2F80FF' : '#9AA4B2', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
