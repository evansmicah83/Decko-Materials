import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/navigation/Navbar';
import { BottomNav } from './components/navigation/BottomNav';
import { DashboardView } from './features/dashboard/DashboardView';
import { RequestsListView } from './features/requests/RequestsListView';
import { AccountingQueueView } from './features/accounting/AccountingQueueView';
import { StoreIssuanceView } from './features/store/StoreIssuanceView';
import { InventoryView } from './features/inventory/InventoryView';
import { TeamsView } from './features/teams/TeamsView';
import { ReportsView } from './features/reports/ReportsView';
import { AuditTrailView } from './features/audit/AuditTrailView';

import { LoginPage } from './features/auth/LoginPage';
import { ForceChangePasswordModal } from './features/auth/ForceChangePasswordModal';
import { NewRequestModal } from './features/requests/NewRequestModal';
import { RequestDetailModal } from './features/requests/RequestDetailModal';
import { QRScannerModal } from './components/common/QRScannerModal';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { DeckoLogo } from './components/common/DeckoLogo';

const MainApp: React.FC = () => {
  const { user, isLoading, mustChangePassword } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Modals
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Automatically route to role-appropriate initial tab when user logs in
  useEffect(() => {
    if (user) {
      if (user.role === 'ACCOUNTANT') {
        setCurrentTab('accounting');
      } else if (user.role === 'STORE_OFFICER') {
        setCurrentTab('store');
      } else if (user.role === 'AUDITOR') {
        setCurrentTab('audit');
      } else {
        setCurrentTab('dashboard');
      }
    }
  }, [user?.id, user?.role]);

  // Global Ctrl+K shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleScanSuccess = (code: string) => {
    // If the scanned code matches a Request format (e.g. REQ-...)
    if (code.toUpperCase().startsWith('REQ-')) {
      setSelectedRequestId(code);
    } else {
      // If it's a serial, go to inventory tab
      setCurrentTab('inventory');
      setSelectedRequestId(code);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#042844] to-[#011B30] flex flex-col items-center justify-center text-white space-y-5">
        <DeckoLogo variant="white" size="xl" />
        <div className="w-10 h-10 border-3 border-[#FAB417] border-t-transparent rounded-full animate-spin mt-2" />
        <div className="text-center font-sans">
          <div className="text-xs text-sky-200 tracking-widest uppercase font-semibold">Materials Management System</div>
          <div className="text-[11px] text-slate-400 mt-1">Connecting Telecom Field Operations</div>
        </div>
      </div>
    );
  }

  // Not authenticated: Show dedicated professional Login Page
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900 pb-16 md:pb-8">
      {/* Top Corporate Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            onSelectTab={setCurrentTab}
            onOpenNewRequest={() => setIsNewRequestOpen(true)}
            onOpenScanner={() => setIsScannerOpen(true)}
            onViewRequest={(id) => setSelectedRequestId(id)}
          />
        )}

        {currentTab === 'requests' && (
          <RequestsListView
            onOpenNewRequest={() => setIsNewRequestOpen(true)}
            onOpenScanner={() => setIsScannerOpen(true)}
            onViewRequest={(id) => setSelectedRequestId(id)}
          />
        )}

        {currentTab === 'accounting' && (
          <AccountingQueueView onViewRequest={(id) => setSelectedRequestId(id)} />
        )}

        {currentTab === 'store' && (
          <StoreIssuanceView
            onViewRequest={(id) => setSelectedRequestId(id)}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {currentTab === 'inventory' && <InventoryView />}

        {currentTab === 'teams' && <TeamsView />}

        {currentTab === 'reports' && <ReportsView />}

        {currentTab === 'audit' && <AuditTrailView />}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenNewRequest={() => setIsNewRequestOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      {/* Force Password Change for Temporary Passwords */}
      {mustChangePassword && <ForceChangePasswordModal />}

      {/* Modals */}
      <NewRequestModal
        isOpen={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        onRequestCreated={(id) => {
          setSelectedRequestId(id);
          setCurrentTab('requests');
        }}
      />

      <RequestDetailModal
        requestId={selectedRequestId}
        isOpen={!!selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
        onStatusChanged={() => {
          // Re-render / refresh active tabs
        }}
      />

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectRequest={(id) => setSelectedRequestId(id)}
        onSelectMaterial={() => setCurrentTab('inventory')}
        onSelectSerial={() => setCurrentTab('inventory')}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
