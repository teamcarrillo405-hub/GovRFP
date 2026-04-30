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
  Shield,
  Handshake,
  Bookmark,
  FileCheck,
} from 'lucide-react';

interface NavItem  { label: string; href: string; icon: React.ReactNode }
interface NavSection { title: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'WORKSPACE',
    items: [
      { label: 'Dashboard',  href: '/dashboard', icon: <LayoutDashboard size={14} strokeWidth={1.5} /> },
      { label: 'Pipeline',   href: '/pipeline',  icon: <KanbanSquare    size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'PROPOSALS',
    items: [
      { label: 'All Proposals',    href: '/proposals',            icon: <FileText size={14} strokeWidth={1.5} /> },
      { label: 'Compliance Matrix', href: '/proposals/compliance', icon: <Grid     size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'CONTRACTS',
    items: [
      { label: 'Contract Cloud', href: '/contracts', icon: <FileCheck size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { label: 'Opportunities',    href: '/opportunities',    icon: <Search    size={14} strokeWidth={1.5} /> },
      { label: 'Saved Searches',  href: '/saved-searches',   icon: <Bookmark  size={14} strokeWidth={1.5} /> },
      { label: 'Content Library', href: '/library',          icon: <Library   size={14} strokeWidth={1.5} /> },
      { label: 'Past Performance', href: '/past-performance', icon: <Award    size={14} strokeWidth={1.5} /> },
      { label: 'Competitors',     href: '/competitors',      icon: <Shield    size={14} strokeWidth={1.5} /> },
      { label: 'Teaming Partners', href: '/teaming',         icon: <Handshake size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'ANALYZE',
    items: [
      { label: 'Analytics',       href: '/analytics', icon: <BarChart2 size={14} strokeWidth={1.5} /> },
      { label: 'Scoring & Red Team', href: '/scoring', icon: <Target   size={14} strokeWidth={1.5} /> },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { label: 'Team',         href: '/team',           icon: <Users      size={14} strokeWidth={1.5} /> },
      { label: 'Integrations', href: '/account',        icon: <Plug       size={14} strokeWidth={1.5} /> },
      { label: 'Billing',      href: '/account#billing', icon: <CreditCard size={14} strokeWidth={1.5} /> },
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
        background: 'rgba(11, 11, 13, 0.88)',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        borderRight: '1px solid rgba(192, 194, 198, 0.08)',
        overflowY: 'auto',
        flexShrink: 0,
        padding: '14px 0',
      }}
      className="scrollbar-none"
    >
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: 4 }}>
          {/* Section label */}
          <div style={{
            padding: '8px 16px 4px',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(192, 194, 198, 0.35)',
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
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
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#F5F5F7' : '#C0C2C6',
                  textDecoration: 'none',
                  background: isActive ? 'rgba(255, 26, 26, 0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid #FF1A1A' : '2px solid transparent',
                  transition: 'all 0.15s linear',
                }}
              >
                <span style={{
                  color: isActive ? '#FF1A1A' : 'rgba(192,194,198,0.6)',
                  flexShrink: 0,
                  transition: 'color 0.15s linear',
                }}>
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
