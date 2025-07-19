"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Dropdown } from '../ui/Dropdown';

export interface DashboardLayoutProps {
  /**
   * Dashboard content
   */
  children: React.ReactNode;
}

/**
 * Dashboard layout component with sidebar and header
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="flex h-screen bg-secondary-50">
      {/* Sidebar for mobile */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-secondary-900/50"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
        
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 w-64 flex flex-col bg-white border-r border-secondary-200">
          <div className="flex items-center justify-between h-16 px-4 border-b border-secondary-200">
            <Link href="/dashboard" className="flex items-center">
              <img
                src="/jetmail-logo.svg"
                alt="JetMail"
                className="h-8 w-auto"
              />
              <span className="ml-2 text-lg font-semibold text-primary-900">JetMail</span>
            </Link>
            <button
              type="button"
              className="text-secondary-500 hover:text-secondary-700"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">Close sidebar</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Sidebar />
          </div>
        </div>
      </div>
      
      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-secondary-200">
          <div className="flex items-center h-16 px-4 border-b border-secondary-200">
            <Link href="/dashboard" className="flex items-center">
              <img
                src="/jetmail-logo.svg"
                alt="JetMail"
                className="h-8 w-auto"
              />
              <span className="ml-2 text-lg font-semibold text-primary-900">JetMail</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Sidebar />
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-10 bg-white border-b border-secondary-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden text-secondary-500 hover:text-secondary-700"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
            
            {/* Breadcrumb */}
            <div className="hidden md:flex items-center">
              <Breadcrumb />
            </div>
            
            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              <NotificationButton />
              <TenantSwitcher />
              <UserMenu />
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Sidebar navigation component
 */
function Sidebar() {
  const pathname = usePathname();
  
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Campaigns', href: '/dashboard/campaigns', icon: EnvelopeIcon },
    { name: 'Subscribers', href: '/dashboard/subscribers', icon: UsersIcon },
    { name: 'Lists', href: '/dashboard/lists', icon: ListIcon },
    { name: 'Automations', href: '/dashboard/automations', icon: AutomationIcon },
    { name: 'Forms', href: '/dashboard/forms', icon: FormIcon },
    { name: 'Analytics', href: '/dashboard/analytics', icon: ChartIcon },
    { name: 'Settings', href: '/dashboard/settings', icon: SettingsIcon },
  ];

  const handleNavClick = (href: string) => {
    // Force refresh for campaigns page to reset view state
    if (href === '/dashboard/campaigns' && pathname === '/dashboard/campaigns') {
      window.location.href = href;
    }
  };
  
  return (
    <nav className="space-y-6">
      <div className="space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => handleNavClick(item.href)}
            className={cn(
              'group flex items-center px-3 py-2 text-sm font-medium rounded-md',
              pathname === item.href || pathname?.startsWith(`${item.href}/`)
                ? 'bg-primary-50 text-primary-700'
                : 'text-secondary-700 hover:bg-secondary-50 hover:text-secondary-900'
            )}
          >
            <item.icon
              className={cn(
                'mr-3 h-5 w-5 flex-shrink-0',
                pathname === item.href || pathname?.startsWith(`${item.href}/`)
                  ? 'text-primary-500'
                  : 'text-secondary-400 group-hover:text-secondary-500'
              )}
            />
            {item.name}
          </Link>
        ))}
      </div>
      
      <div className="pt-6">
        <div className="px-3 text-xs font-semibold text-secondary-500 uppercase tracking-wider">
          Support
        </div>
        <div className="mt-2 space-y-1">
          <Link
            href="/support"
            className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-secondary-700 hover:bg-secondary-50 hover:text-secondary-900"
          >
            <SupportIcon className="mr-3 h-5 w-5 flex-shrink-0 text-secondary-400 group-hover:text-secondary-500" />
            Help Center
          </Link>
          <Link
            href="/tickets"
            className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-secondary-700 hover:bg-secondary-50 hover:text-secondary-900"
          >
            <TicketIcon className="mr-3 h-5 w-5 flex-shrink-0 text-secondary-400 group-hover:text-secondary-500" />
            Support Tickets
          </Link>
        </div>
      </div>
    </nav>
  );
}

/**
 * Breadcrumb navigation component
 */
function Breadcrumb() {
  const pathname = usePathname();
  
  // Skip for root paths
  if (!pathname || pathname === '/' || pathname === '/dashboard') {
    return <div className="text-lg font-medium text-secondary-900">Dashboard</div>;
  }
  
  // Generate breadcrumb segments
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => ({
      name: segment.charAt(0).toUpperCase() + segment.slice(1),
      href: `/${segment}`,
    }));
  
  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <Link href="/dashboard" className="text-secondary-500 hover:text-secondary-700">
            Dashboard
          </Link>
        </li>
        
        {segments.map((segment, index) => (
          <li key={segment.href}>
            <div className="flex items-center">
              <svg
                className="h-4 w-4 text-secondary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <Link
                href={segment.href}
                className={cn(
                  'ml-2',
                  index === segments.length - 1
                    ? 'text-secondary-900 font-medium'
                    : 'text-secondary-500 hover:text-secondary-700'
                )}
                aria-current={index === segments.length - 1 ? 'page' : undefined}
              >
                {segment.name}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Notification button component
 */
function NotificationButton() {
  const [hasNotifications, setHasNotifications] = useState(true);
  
  return (
    <button
      type="button"
      className="relative p-1 rounded-full text-secondary-500 hover:text-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <span className="sr-only">View notifications</span>
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
      {hasNotifications && (
        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-error ring-2 ring-white" />
      )}
    </button>
  );
}

/**
 * Tenant switcher component
 */
function TenantSwitcher() {
  const tenants = [
    { label: 'Acme Inc', value: 'acme' },
    { label: 'Globex Corp', value: 'globex' },
    { label: 'Stark Industries', value: 'stark' },
  ];
  
  const [selectedTenant, setSelectedTenant] = useState('acme');
  
  return (
    <div className="hidden md:block">
      <Dropdown
        items={tenants}
        value={selectedTenant}
        onChange={setSelectedTenant}
        className="w-48"
      />
    </div>
  );
}

/**
 * User menu component
 */
function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  
  const userMenuItems = [
    { label: 'Your Profile', value: 'profile' },
    { label: 'Account Settings', value: 'settings' },
    { label: 'Sign out', value: 'signout' },
  ];
  
  const handleMenuItemClick = async (value: string) => {
    setIsOpen(false);
    
    // Handle menu item actions
    if (value === 'signout') {
      await signOut({ 
        callbackUrl: '/',
        redirect: true 
      });
    }
  };
  
  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sr-only">Open user menu</span>
        <Avatar
          size="sm"
          src="https://i.pravatar.cc/300"
          alt="User"
          fallback="JD"
          status="online"
        />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="px-4 py-2 border-b border-secondary-200">
            <p className="text-sm font-medium text-secondary-900">John Doe</p>
            <p className="text-xs text-secondary-500">john@example.com</p>
          </div>
          {userMenuItems.map((item) => (
            <button
              key={item.value}
              className="block w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50"
              onClick={() => handleMenuItemClick(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Icon components
function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function EnvelopeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

function ListIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}

function AutomationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
      />
    </svg>
  );
}

function FormIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}

function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function SupportIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      />
    </svg>
  );
}

function TicketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"
      />
    </svg>
  );
}