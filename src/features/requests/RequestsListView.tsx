import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { MaterialRequest, Team, Project } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Search,
  Filter,
  FilePlus2,
  Boxes,
  Camera,
  ChevronRight,
  Download,
  Clock,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface RequestsListViewProps {
  onOpenNewRequest: () => void;
  onOpenScanner: () => void;
  onViewRequest: (id: string) => void;
}

export const RequestsListView: React.FC<RequestsListViewProps> = ({
  onOpenNewRequest,
  onOpenScanner,
  onViewRequest
}) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadFilterMetadata();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [statusFilter, teamFilter, projectFilter, priorityFilter, search, user]);

  const loadFilterMetadata = async () => {
    try {
      const [tRes, pRes] = await Promise.all([api.getTeams(), api.getProjects()]);
      if (tRes.success) setTeams(tRes.teams);
      if (pRes.success) setProjects(pRes.projects);
    } catch (e) {}
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (teamFilter) params.teamId = teamFilter;
      if (projectFilter) params.projectId = projectFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (search) params.search = search;

      const res = await api.getRequests(params);
      if (res.success) {
        setRequests(res.requests);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (requests.length === 0) return;
    const headers = ['Request Number', 'Team', 'Project', 'Requester', 'Status', 'Priority', 'Reason', 'Cost (KES)', 'Date'];
    const rows = requests.map((r) => [
      r.requestNumber,
      r.teamCode,
      r.projectName,
      r.requesterName,
      r.status,
      r.priority,
      `"${r.reason?.replace(/"/g, '""') || ''}"`,
      r.estimatedCost,
      new Date(r.createdAt).toLocaleDateString('en-GB')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Decko_Material_Requests_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Field Material Requisitions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Digitized material chain from submission, approval, payment to warehouse gate pass
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={onOpenScanner}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scan QR</span>
          </button>

          <button
            onClick={onOpenNewRequest}
            className="px-4 py-2 bg-[#0B2545] hover:bg-[#133966] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <FilePlus2 className="w-4 h-4 text-amber-400" />
            New Requisition
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request # or reason..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">Submitted (Pending Review)</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PAYMENT_PENDING">Payment Pending</option>
            <option value="PAID">Paid</option>
            <option value="READY_FOR_ISSUE">Ready for Issue</option>
            <option value="PARTIALLY_ISSUED">Partially Issued</option>
            <option value="ISSUED">Issued</option>
            <option value="RECEIVED">Received</option>
            <option value="IN_USE">In Use</option>
            <option value="RETURNED">Returned</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">All Field Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.teamCode} — {t.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High (Urgent)</option>
            <option value="CRITICAL">Critical (Outage)</option>
          </select>
        </div>
      </div>

      {/* Requests Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600" />
            <div>Loading requisitions...</div>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <Boxes className="w-10 h-10 mx-auto text-slate-300" />
            <p>No material requests match the selected filters.</p>
            <button
              onClick={onOpenNewRequest}
              className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-semibold"
            >
              Create New Request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4 font-semibold">Request #</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Team & Project</th>
                  <th className="py-3 px-4 font-semibold">Reason / Scope</th>
                  <th className="py-3 px-4 font-semibold text-right">Items</th>
                  <th className="py-3 px-4 font-semibold text-right">Est. Cost</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r, idx) => (
                  <tr
                    key={r.id}
                    onClick={() => onViewRequest(r.id)}
                    className={`hover:bg-blue-50/50 cursor-pointer transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 block">
                        {r.requestNumber}
                      </span>
                      {r.workOrderRef && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {r.workOrderRef}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} size="sm" />
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-blue-900 block">{r.teamCode}</span>
                      <span className="text-[11px] text-slate-500 truncate max-w-[180px] block">
                        {r.projectName}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-700 font-medium line-clamp-1">{r.reason}</p>
                      <span className="text-[10px] text-slate-400">
                        Req by: {r.requesterName}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-600">
                      {r.itemCount || 0}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      KES {r.estimatedCost?.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="p-1 text-slate-400 hover:text-blue-600 inline-block">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
