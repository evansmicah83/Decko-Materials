import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { MaterialRequest } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  PackageCheck,
  Camera,
  Search,
  CheckCircle2,
  AlertCircle,
  Boxes,
  ShieldCheck,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

interface StoreIssuanceViewProps {
  onViewRequest: (id: string) => void;
  onOpenScanner: () => void;
}

export const StoreIssuanceView: React.FC<StoreIssuanceViewProps> = ({
  onViewRequest,
  onOpenScanner
}) => {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'READY' | 'ISSUED' | 'ALL'>('READY');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadStoreQueue();
  }, [filter, search]);

  const loadStoreQueue = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter === 'READY') {
        params.status = 'READY_FOR_ISSUE_QUEUE';
      } else if (filter === 'ISSUED') {
        params.status = 'ISSUED';
      }
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Central Store Issuance & Gate Pass
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Scan request QR code, verify accounting authorization, validate serials, and issue materials
          </p>
        </div>

        <button
          onClick={onOpenScanner}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-sm transition self-start sm:self-auto"
        >
          <Camera className="w-4 h-4" />
          <span>Scan Request QR Code</span>
        </button>
      </div>

      {/* Filter and Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter('READY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'READY'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Ready for Issue ({filter === 'READY' ? requests.length : 'Queue'})
          </button>
          <button
            onClick={() => setFilter('ISSUED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'ISSUED'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Recently Issued
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'ALL'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Requisitions
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request # or team..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Queue List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Loading store issuance queue...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <PackageCheck className="w-8 h-8 text-cyan-600 mx-auto" />
            <p>No requisitions currently pending store issuance.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Authorization</th>
                  <th className="py-3 px-4 text-right">Items</th>
                  <th className="py-3 px-4 text-center">Issuance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r, idx) => (
                  <tr
                    key={r.id}
                    onClick={() => onViewRequest(r.id)}
                    className={`hover:bg-cyan-50/40 cursor-pointer transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 block">
                        {r.requestNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {r.workOrderRef || 'N/A'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-blue-900 block">{r.teamCode}</span>
                      <span className="text-[11px] text-slate-500">{r.teamName}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 block truncate max-w-xs">
                        {r.projectName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Requester: {r.requesterName}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} size="sm" />
                    </td>

                    <td className="py-3 px-4">
                      {r.paymentReference ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Paid & Verified
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {r.paymentReference}
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-semibold text-[11px]">
                          Pending Payment Authorization
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                      {r.itemCount || 0}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewRequest(r.id);
                        }}
                        className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-bold inline-flex items-center gap-1 transition"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Issue</span>
                      </button>
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
