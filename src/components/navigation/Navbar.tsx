import React, { useState, useEffect } from 'react';
import { DeckoLogo } from '../common/DeckoLogo';
import { PersonaSwitcher } from './PersonaSwitcher';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { AppNotification } from '../../types';
import {
  Bell,
  Search,
  Camera,
  Wifi,
  WifiOff,
  LogOut,
  Menu,
  X,
  FileText,
  Boxes,
  CreditCard,
  PackageCheck,
  Users,
  BarChart3,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenScanner: () => void;
  onOpenSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenScanner,
  onOpenSearch
}) => {
  const { user, isOnline, logout } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications();
      if (res.success) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      }
    } catch (e) {
      // offline or unauth
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
    } catch (e) {}
  };

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'requests', label: 'Material Requests', icon: FileText },
    { id: 'inventory', label: 'Inventory & Serials', icon: Boxes },
    { id: 'accounting', label: 'Accounting Queue', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'] },
    { id: 'store', label: 'Store Issuance', icon: PackageCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'STORE_OFFICER'] },
    { id: 'teams', label: 'Teams & Stock', icon: Users },
    { id: 'reports', label: 'Reports & Safaricom', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT', 'STORE_OFFICER', 'AUDITOR'] },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR', 'PROJECT_MANAGER'] }
  ];

  const visibleLinks = navLinks.filter(
    (l) => !l.roles || ['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER'].includes(user?.role || '') || l.roles.includes(user?.role || '')
  );

  return (
    <header className="bg-[#0B2545] text-white sticky top-0 z-40 border-b border-slate-800 shadow-md">
      {/* Top Banner if Offline */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1 text-center text-xs font-semibold flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>OFFLINE MODE: You are currently disconnected. Changes will be queued and synchronized when network restores.</span>
        </div>
      )}

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Brand Logo & Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-md"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div onClick={() => onSelectTab('dashboard')} className="cursor-pointer">
            <DeckoLogo variant="white" size="md" />
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onSelectTab(link.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2">
          {/* Quick Search Button */}
          <button
            onClick={onOpenSearch}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-md text-xs flex items-center gap-1.5 transition"
            title="Global Search"
          >
            <Search className="w-4 h-4" />
            <span className="hidden xl:inline text-slate-400 font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              Ctrl+K
            </span>
          </button>

          {/* Quick Barcode/QR Scanner */}
          <button
            onClick={onOpenScanner}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            title="Scan QR or Barcode"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scan</span>
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-md relative transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-slate-950 font-extrabold text-[10px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-900 rounded-lg shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100">
                <div className="p-3 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-700">
                    <Bell className="w-3.5 h-3.5 text-blue-600" />
                    Notifications ({unreadCount} unread)
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs hover:bg-slate-50 transition cursor-pointer ${
                          !n.isRead ? 'bg-blue-50/50' : ''
                        }`}
                        onClick={() => {
                          api.markNotificationRead(n.id);
                          setShowNotifications(false);
                          if (n.link) {
                            onSelectTab('requests');
                          }
                        }}
                      >
                        <div className="font-semibold text-slate-900 flex items-center justify-between">
                          <span>{n.title}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Persona Switcher (Crucial for Review & Testing) */}
          <PersonaSwitcher />

          {/* API Docs Link */}
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1 p-1.5 text-slate-400 hover:text-sky-300 text-xs transition"
            title="OpenAPI Specification"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="text-[11px]">API</span>
          </a>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900/95 border-b border-slate-800 px-4 py-3 space-y-1">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  onSelectTab(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2.5 text-left transition ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
