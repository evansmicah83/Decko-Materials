import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Search, X, FileText, Package, QrCode, Users, ArrowRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRequest: (id: string) => void;
  onSelectMaterial: (id: string) => void;
  onSelectSerial: (serial: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectRequest,
  onSelectMaterial,
  onSelectSerial
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({ requests: [], materials: [], serials: [], teams: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ requests: [], materials: [], serials: [], teams: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.globalSearch(query);
        if (res.success) {
          setResults(res.results);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search request number, serial, tool, material, team, or work order..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 focus:outline-hidden"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="text-xs px-2 py-1 bg-slate-200 rounded text-slate-600 font-mono">
            ESC
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="text-center py-6 text-xs text-slate-500">Searching Decko database...</div>
          )}

          {!loading && !query && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Type at least 2 characters to search across materials, requests, teams, and serialized tools.
            </div>
          )}

          {/* Requests Section */}
          {results.requests.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Material Requests ({results.requests.length})
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                {results.requests.map((req: any) => (
                  <div
                    key={req.id}
                    onClick={() => {
                      onSelectRequest(req.id);
                      onClose();
                    }}
                    className="p-3 hover:bg-blue-50/60 cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{req.requestNumber}</span>
                        <StatusBadge status={req.status} size="sm" />
                      </div>
                      <p className="text-slate-600 truncate mt-0.5">{req.reason}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Serials / Tracked Units */}
          {results.serials.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <QrCode className="w-3.5 h-3.5 text-teal-600" />
                Serial Numbers & Safaricom Barcodes ({results.serials.length})
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                {results.serials.map((s: any) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSerial(s.serialNumber);
                      onClose();
                    }}
                    className="p-3 hover:bg-teal-50/60 cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <span className="font-mono font-bold text-teal-900">{s.serialNumber}</span>
                      <span className="ml-2 text-slate-600">{s.materialName}</span>
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-slate-100 rounded text-slate-600">
                        {s.status}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materials Section */}
          {results.materials.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <Package className="w-3.5 h-3.5 text-amber-600" />
                Materials Master ({results.materials.length})
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                {results.materials.map((m: any) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      onSelectMaterial(m.id);
                      onClose();
                    }}
                    className="p-3 hover:bg-amber-50/60 cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <span className="font-mono font-medium text-slate-500">{m.sku}</span>
                      <span className="ml-2 font-semibold text-slate-800">{m.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-800">{m.currentStock}</span>
                      <span className="ml-1 text-slate-500 text-[11px]">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
