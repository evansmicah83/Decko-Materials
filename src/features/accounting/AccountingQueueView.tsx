import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { MaterialRequest } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CreditCard, CheckCircle2, Search, ArrowRight, DollarSign, Clock, ShieldCheck, ChevronRight } from 'lucide-react';

interface AccountingQueueViewProps {
  onViewRequest: (id: string) => void;
}

export const AccountingQueueView: React.FC<AccountingQueueViewProps> = ({ onViewRequest }) => {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'PAID' | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAccountingQueue();
  }, [filter, search]);

  const loadAccountingQueue = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter === 'PENDING') {
        params.status = 'ACCOUNTING_QUEUE';
      } else if (filter === 'PAID') {
        params.status = 'PAID';
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

  const totalValue = requests.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Accounting & Payment Queue
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Approved material requisitions awaiting disbursement confirmation and payment references
          </p>
        </div>

        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Queue Value</span>
            <span className="text-base font-bold font-mono text-emerald-900">
              KES {totalValue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'PENDING'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Awaiting Payment ({filter === 'PENDING' ? requests.length : 'Queue'})
          </button>
          <button
            onClick={() => setFilter('PAID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'PAID'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Disbursed & Paid
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === 'ALL'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Requests
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request # or ref..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Queue List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Loading accounting queue...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p>No requests currently awaiting payment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Team & Project</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Approved Amount</th>
                  <th className="py-3 px-4">Payment Ref</th>
                  <th className="py-3 px-4">Approval Date</th>
                  <th className="py-3 px-4 text-center">Process</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r, idx) => (
                  <tr
                    key={r.id}
                    onClick={() => onViewRequest(r.id)}
                    className={`hover:bg-emerald-50/40 cursor-pointer transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 block">
                        {r.requestNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        By {r.requesterName}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{r.teamCode}</span>
                      <span className="text-[11px] text-slate-500 truncate block max-w-xs">
                        {r.projectName}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} size="sm" />
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 text-sm">
                      KES {r.estimatedCost?.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {r.paymentReference || (
                        <span className="text-amber-600 font-semibold text-[11px]">
                          Payment Pending
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-500">
                      {new Date(r.updatedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewRequest(r.id);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Process</span>
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
