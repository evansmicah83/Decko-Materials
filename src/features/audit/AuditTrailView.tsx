import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AuditLogRecord } from '../../types';
import { ShieldCheck, Search, Filter, History, User, Globe, ArrowRight, Download } from 'lucide-react';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter, entityFilter]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '150' };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity = entityFilter;

      const res = await api.getAuditLogs(params);
      if (res.success) {
        setLogs(res.logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportAuditCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Action', 'Entity', 'Entity ID', 'User', 'Role', 'IP Address', 'Reason', 'Previous Value', 'New Value'];
    const rows = logs.map((l) => [
      l.createdAt,
      l.action,
      l.entity,
      l.entityId,
      l.userName || 'System',
      l.userRole || '',
      l.ipAddress || '',
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.previousValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Decko_Immutable_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            Immutable System Audit Trail
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Cryptographic & ledger permanence tracking every requisition, approval, disbursement, store gate pass and tool return
          </p>
        </div>

        <button
          onClick={exportAuditCSV}
          className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Log (CSV)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 font-medium"
        >
          <option value="">All Action Types</option>
          <option value="REQUEST_CREATED">REQUEST_CREATED</option>
          <option value="REQUEST_SUBMITTED">REQUEST_SUBMITTED</option>
          <option value="REQUEST_APPROVED">REQUEST_APPROVED</option>
          <option value="REQUEST_REJECTED">REQUEST_REJECTED</option>
          <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
          <option value="MATERIAL_ISSUED">MATERIAL_ISSUED</option>
          <option value="MATERIAL_RECEIVED_BY_TEAM">MATERIAL_RECEIVED_BY_TEAM</option>
          <option value="MATERIAL_CONSUMPTION_LOGGED">MATERIAL_CONSUMPTION_LOGGED</option>
          <option value="MATERIAL_RETURNED">MATERIAL_RETURNED</option>
          <option value="STOCK_ADJUSTED">STOCK_ADJUSTED</option>
          <option value="USER_LOGIN">USER_LOGIN</option>
        </select>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 font-medium"
        >
          <option value="">All Entities</option>
          <option value="MaterialRequest">MaterialRequest</option>
          <option value="Inventory">Inventory</option>
          <option value="Material">Material</option>
          <option value="User">User</option>
          <option value="System">System</option>
        </select>

        <span className="text-xs text-slate-400 font-mono ml-auto">
          Showing {logs.length} immutable records
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Loading audit records...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No audit records match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action Event</th>
                  <th className="py-3 px-4">Actor / Role</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Reason / Comment</th>
                  <th className="py-3 px-4">Network IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('en-GB')}{' '}
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    <td className="py-2.5 px-4">
                      <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-800">
                        {log.userName || 'System Engine'}
                      </div>
                      {log.userRole && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          {log.userRole.replace(/_/g, ' ')}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-4">
                      <span className="font-mono text-slate-700 block">{log.entity}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{log.entityId}</span>
                    </td>

                    <td className="py-2.5 px-4 text-slate-700 max-w-sm">
                      <p className="line-clamp-2">{log.reason || '-'}</p>
                    </td>

                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                      {log.ipAddress || '127.0.0.1'}
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
