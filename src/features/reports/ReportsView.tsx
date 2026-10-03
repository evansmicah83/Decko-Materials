import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BarChart3, ShieldCheck, Download, FileText, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'SAFARICOM' | 'CONSUMPTION' | 'SUMMARY'>('SAFARICOM');
  const [safaricomRecords, setSafaricomRecords] = useState<any[]>([]);
  const [consumptionRecords, setConsumptionRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [activeReport]);

  const loadReports = async () => {
    setLoading(true);
    try {
      if (activeReport === 'SAFARICOM') {
        const res = await api.getSafaricomReport();
        if (res.success) setSafaricomRecords(res.records);
      } else if (activeReport === 'CONSUMPTION') {
        const res = await api.getConsumptionReport();
        if (res.success) setConsumptionRecords(res.records);
      } else {
        const res = await api.getReportsSummary();
        if (res.success) setSummary(res.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportSafaricomCSV = () => {
    if (safaricomRecords.length === 0) return;
    const headers = ['Serial Number', 'Barcode', 'Safaricom Tag', 'Material', 'SKU', 'Status', 'Location', 'Team', 'Project', 'Client', 'Custodian', 'Last Movement'];
    const rows = safaricomRecords.map((r) => [
      r.serialNumber,
      r.barcode || '',
      r.safaricomTag || '',
      `"${r.materialName || ''}"`,
      r.sku,
      r.status,
      `"${r.currentLocation || ''}"`,
      r.teamCode || '',
      `"${r.projectName || ''}"`,
      r.client || 'Safaricom PLC',
      `"${r.custodianName || ''}"`,
      new Date(r.lastMovementDate).toLocaleDateString('en-GB')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Decko_Safaricom_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Compliance & Telecommunications Reports
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Official Safaricom accountability logs, field consumption records, and audit summaries
          </p>
        </div>

        {activeReport === 'SAFARICOM' && (
          <button
            onClick={exportSafaricomCSV}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export Safaricom Audit CSV</span>
          </button>
        )}
      </div>

      {/* Report Switcher Tabs */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveReport('SAFARICOM')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 transition ${
            activeReport === 'SAFARICOM'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Safaricom Transparency Report
        </button>

        <button
          onClick={() => setActiveReport('CONSUMPTION')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 transition ${
            activeReport === 'CONSUMPTION'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4 text-sky-400" />
          Field Material Consumption
        </button>

        <button
          onClick={() => setActiveReport('SUMMARY')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 transition ${
            activeReport === 'SUMMARY'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Management KPI Overview
        </button>
      </div>

      {/* Content: Safaricom Transparency */}
      {activeReport === 'SAFARICOM' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-emerald-950 text-xs sm:text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Safaricom Material & Device Custody Register
              </h3>
              <p className="text-[11px] text-emerald-800">
                Mandatory tracking for Power Meters, Laser Pens, Fibre Cleavers, and ONT devices
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded border border-emerald-200">
              {safaricomRecords.length} Registered Units
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Safaricom Asset Tag</th>
                  <th className="py-3 px-4">Material / Model</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned Team</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Custodian</th>
                  <th className="py-3 px-4">Last Movement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {safaricomRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {r.serialNumber}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                      {r.safaricomTag || (
                        <span className="text-slate-400 font-normal">Pending Tag</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800">{r.materialName}</td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          r.status === 'IN_STORE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'WITH_TEAM'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-bold text-blue-900">
                      {r.teamCode ? `Team ${r.teamCode}` : 'Central Store'}
                    </td>

                    <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{r.projectName}</td>

                    <td className="py-3 px-4 text-slate-700">{r.custodianName || 'Store Officer'}</td>

                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(r.lastMovementDate).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content: Field Material Consumption */}
      {activeReport === 'CONSUMPTION' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
              Field Installation Material Consumption Log
            </h3>
            <p className="text-[11px] text-slate-500">
              Audit trail of cable meters and splitters consumed across client premises
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4 text-right">Consumed</th>
                  <th className="py-3 px-4">Work Order</th>
                  <th className="py-3 px-4">Logged By</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consumptionRecords.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(c.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4 font-bold text-blue-900">{c.teamCode}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{c.materialName}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                      {c.quantityConsumed} {c.unit}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{c.workOrder || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{c.loggedByName}</td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-xs">{c.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content: Summary */}
      {activeReport === 'SUMMARY' && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Requests by Project</h4>
            <div className="divide-y divide-slate-100 text-xs">
              {summary.requestsByProject?.map((p: any) => (
                <div key={p.projectName} className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-800">{p.projectName}</span>
                  <div className="text-right">
                    <span className="font-bold font-mono text-slate-900 block">
                      KES {p.totalCost?.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-400">{p.requestCount} requests</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Top Demanded Materials</h4>
            <div className="divide-y divide-slate-100 text-xs">
              {summary.topDemanded?.map((m: any) => (
                <div key={m.materialName} className="py-2.5 flex items-center justify-between">
                  <span className="font-medium text-slate-800">{m.materialName}</span>
                  <div className="text-right">
                    <span className="font-bold font-mono text-blue-900">
                      {m.totalRequested} {m.unit} requested
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {m.totalIssued} {m.unit} issued
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
