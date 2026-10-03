import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { MaterialRequest } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  FilePlus2,
  PackageCheck,
  CreditCard,
  Boxes,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface DashboardViewProps {
  onSelectTab: (tab: string) => void;
  onOpenNewRequest: () => void;
  onOpenScanner: () => void;
  onViewRequest: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectTab,
  onOpenNewRequest,
  onOpenScanner,
  onViewRequest
}) => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [recentRequests, setRecentRequests] = useState<MaterialRequest[]>([]);
  const [teamStocks, setTeamStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [sumRes, reqRes] = await Promise.all([
        api.getReportsSummary(),
        api.getRequests({ limit: '6' })
      ]);

      if (sumRes.success) setSummary(sumRes.summary);
      if (reqRes.success) setRecentRequests(reqRes.requests);

      if (user?.teamId) {
        const stockRes = await api.getTeamStock(user.teamId);
        if (stockRes.success) setTeamStocks(stockRes.stocks);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isField = ['FIELD_TECHNICIAN', 'FIELD_TEAM_LEADER'].includes(user?.role || '');
  const isDispatcher = user?.role === 'DISPATCHER';
  const isPM = user?.role === 'PROJECT_MANAGER';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const isStore = user?.role === 'STORE_OFFICER';
  const isAuditorOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'].includes(user?.role || '');
  const isManager = ['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER'].includes(user?.role || '');
  const isFieldLeader = user?.role === 'FIELD_TEAM_LEADER';

  return (
    <div className="space-y-6">
      {/* Welcome Banner / Header */}
      <div className="bg-gradient-to-r from-[#0B2545] to-[#133966] text-white rounded-xl p-5 sm:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/30 text-sky-300 rounded border border-blue-400/30">
              {user?.role?.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-300">
              {user?.department || 'Field Operations'}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            {isManager
              ? `${user?.role === 'HR' ? 'HR' : 'Admin'} Control Center`
              : isFieldLeader
              ? 'Field Team Leader Dashboard'
              : `Welcome back, ${user?.fullName}`}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            {isManager
              ? 'Manage teams and team leaders, review material requests, and oversee inventory, accounting, store operations, reports, and audit activity.'
              : isField
              ? 'Request telecommunications materials, monitor approval status, receive store issuances, and record field cable consumption.'
              : isDispatcher || isPM
              ? 'Review field material requisitions, verify technical scope, and approve allocations across assigned projects.'
              : isAccountant
              ? 'Verify approved requests in the accounting queue, disburse payments, and record financial transaction references.'
              : isStore
              ? 'Authorize material collection, scan serial numbers, issue fiber cables and tools, and accept field returns.'
              : 'Enterprise overview: immutable material chain of custody, Safaricom compliance, and inventory movement.'}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isManager && (
            <>
              <button
                onClick={() => onSelectTab('teams')}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
              >
                <Users className="w-4 h-4" />
                Manage Teams
              </button>
              <button
                onClick={() => onSelectTab('reports')}
                className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 border border-white/20 transition"
              >
                <TrendingUp className="w-4 h-4 text-sky-300" />
                Reports
              </button>
            </>
          )}

          {isField && (
            <button
              onClick={onOpenNewRequest}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
            >
              <FilePlus2 className="w-4 h-4 text-slate-950" />
              Request Materials
            </button>
          )}

          {isStore && (
            <button
              onClick={() => onSelectTab('store')}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
            >
              <PackageCheck className="w-4 h-4" />
              Store Issuance Queue
            </button>
          )}

          {isAccountant && (
            <button
              onClick={() => onSelectTab('accounting')}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
            >
              <CreditCard className="w-4 h-4" />
              Accounting Queue
            </button>
          )}

          <button
            onClick={onOpenScanner}
            className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 border border-white/20 transition"
          >
            <Boxes className="w-4 h-4 text-sky-300" />
            Scan QR / Barcode
          </button>
        </div>
      </div>

      {isManager && (
        <section aria-label="Administration overview" className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Active Teams', value: summary?.activeTeams ?? 0, icon: Users },
              { label: 'Team Leaders', value: summary?.activeTeamLeaders ?? 0, icon: ShieldCheck },
              { label: 'Field Technicians', value: summary?.activeTechnicians ?? 0, icon: Users }
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                <div className="p-2.5 bg-sky-50 text-[#04446F] rounded-lg"><Icon className="w-4 h-4" /></div>
                <div>
                  <div className="text-xl font-bold text-slate-900">{value}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { id: 'requests', label: 'Requests', icon: FilePlus2 },
              { id: 'teams', label: 'Teams & Crew', icon: Users },
              { id: 'inventory', label: 'Inventory', icon: Boxes },
              { id: 'accounting', label: 'Accounting', icon: CreditCard },
              { id: 'store', label: 'Store', icon: PackageCheck },
              { id: 'reports', label: 'Reports', icon: TrendingUp },
              { id: 'audit', label: 'Audit Trail', icon: ShieldCheck }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:bg-sky-50 transition"
              >
                <Icon className="w-4 h-4 text-[#04446F]" />
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1 */}
        <div
          onClick={() => onSelectTab('requests')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-blue-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isField ? 'Team Requests' : 'Pending Review'}
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {summary?.pendingRequests ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Awaiting supervisor review
          </span>
        </div>

        {/* Card 2 */}
        <div
          onClick={() => onSelectTab('accounting')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Accounting Queue
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {summary?.accountingQueueCount ?? 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            Approved & awaiting payment
          </span>
        </div>

        {/* Card 3 */}
        <div
          onClick={() => onSelectTab('store')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-cyan-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ready for Issue
            </span>
            <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {summary?.readyForIssueCount ?? 0}
          </div>
          <span className="text-[11px] text-cyan-700 font-medium mt-1 block">
            Authorized for collection
          </span>
        </div>

        {/* Card 4 */}
        <div
          onClick={() => onSelectTab('inventory')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-amber-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {summary?.lowStockCount ?? 0}
          </div>
          <span className="text-[11px] text-amber-700 font-medium mt-1 block">
            Below warehouse minimum
          </span>
        </div>
      </div>

      {/* Main Split Section: Recent Activity & Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Material Requests (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm sm:text-base">
                Recent Material Requisitions
              </h3>
              <p className="text-xs text-slate-500">
                Live field requests replacing WhatsApp communication
              </p>
            </div>
            <button
              onClick={() => onSelectTab('requests')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No recent material requests found.
              </div>
            ) : (
              recentRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => onViewRequest(req.id)}
                  className="p-4 hover:bg-slate-50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {req.requestNumber}
                      </span>
                      <StatusBadge status={req.status} size="sm" />
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {req.teamCode}
                      </span>
                    </div>

                    <p className="text-slate-700 font-medium line-clamp-1">
                      {req.reason}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Project: <strong className="text-slate-600">{req.projectName}</strong></span>
                      <span>•</span>
                      <span>Req by: {req.requesterName}</span>
                      <span>•</span>
                      <span>{new Date(req.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>

                  <div className="flex items-center sm:flex-col items-end gap-1.5 shrink-0">
                    <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                      KES {req.estimatedCost?.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {req.itemCount || 0} line items
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Context Information */}
        <div className="space-y-6">
          {/* Field Team Stock or Safaricom Tracking Box */}
          {user?.teamId && teamStocks.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {user?.team?.teamCode || 'My Team'} Virtual Stock
                  </h3>
                </div>
                <button
                  onClick={() => onSelectTab('teams')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Manage
                </button>
              </div>

              <div className="divide-y divide-slate-100 mt-2 text-xs">
                {teamStocks.slice(0, 5).map((stk) => (
                  <div key={stk.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800">{stk.materialName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{stk.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900">
                        {stk.currentStock} {stk.unit}
                      </div>
                      <div className="text-[10px] text-slate-400">In custody</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-slate-800 text-sm">
                  Safaricom Accountability
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Optical Power Meters, Laser Pens, Precision Cleavers, and Customer ONTs require serialized tracking for audit compliance.
              </p>

              <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1">
                <div className="text-xs font-semibold text-emerald-900">
                  Serialized Units in Custody
                </div>
                <div className="text-xl font-bold font-mono text-emerald-800">
                  {summary?.safaricomTrackedUnits ?? 12} Registered Units
                </div>
                <div className="text-[11px] text-emerald-700">
                  {summary?.outstandingReturns ?? 0} active with field teams
                </div>
              </div>

              <button
                onClick={() => onSelectTab('reports')}
                className="w-full mt-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded text-xs border border-slate-200 transition"
              >
                View Safaricom Audit Report
              </button>
            </div>
          )}

          {/* Quick SLA Health Box */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs space-y-2.5">
            <div className="flex items-center justify-between font-semibold text-slate-700">
              <span>Operational SLAs</span>
              <span className="text-[11px] text-emerald-600 font-bold">Compliant</span>
            </div>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Supervisor Approval Target:</span>
                <strong className="text-slate-800 font-mono">4 Hours</strong>
              </div>
              <div className="flex justify-between">
                <span>Accounting Payment Target:</span>
                <strong className="text-slate-800 font-mono">8 Hours</strong>
              </div>
              <div className="flex justify-between">
                <span>Store Issuance Target:</span>
                <strong className="text-slate-800 font-mono">4 Hours</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
