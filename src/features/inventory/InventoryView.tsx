import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Material, MaterialCategory, InventoryBalance, InventoryTransaction, TrackedUnit, Warehouse } from '../../types';
import {
  Boxes,
  Package,
  QrCode,
  History,
  AlertTriangle,
  Plus,
  PackagePlus,
  Search,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  X
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'BALANCES' | 'SERIALS' | 'LEDGER'>('BALANCES');
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [trackedUnits, setTrackedUnits] = useState<TrackedUnit[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [catalogMaterials, setCatalogMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Chain of custody modal state
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [chainData, setChainData] = useState<{ unit: any; chain: any[] } | null>(null);

  // Stock adjustment modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustMaterialId, setAdjustMaterialId] = useState('');
  const [adjustWarehouseId, setAdjustWarehouseId] = useState('');
  const [adjustType, setAdjustType] = useState('RECEIPT');
  const [adjustQuantity, setAdjustQuantity] = useState(10);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouseCode, setWarehouseCode] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [warehouseManager, setWarehouseManager] = useState('');
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [creatingWarehouse, setCreatingWarehouse] = useState(false);
  const [showCreateMaterialModal, setShowCreateMaterialModal] = useState(false);
  const [materialSku, setMaterialSku] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [materialCategory, setMaterialCategory] = useState<MaterialCategory>('OTHER');
  const [materialUnit, setMaterialUnit] = useState('pcs');
  const [materialUnitCost, setMaterialUnitCost] = useState('0');
  const [materialInitialStock, setMaterialInitialStock] = useState('0');
  const [materialWarehouseId, setMaterialWarehouseId] = useState('');
  const [materialMinimumStock, setMaterialMinimumStock] = useState('10');
  const [materialReorderLevel, setMaterialReorderLevel] = useState('20');
  const [materialMaximumStock, setMaterialMaximumStock] = useState('1000');
  const [materialStoreLocation, setMaterialStoreLocation] = useState('');
  const [materialSupplier, setMaterialSupplier] = useState('');
  const [materialIsSerialRequired, setMaterialIsSerialRequired] = useState(false);
  const [materialTracksSafaricom, setMaterialTracksSafaricom] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [creatingMaterial, setCreatingMaterial] = useState(false);
  const canManageWarehouses = ['SUPER_ADMIN', 'ADMIN', 'STORE_OFFICER'].includes(user?.role || '');
  const canManageMaterials = ['SUPER_ADMIN', 'ADMIN', 'STORE_OFFICER', 'PROCUREMENT_OFFICER'].includes(user?.role || '');

  useEffect(() => {
    loadData();
  }, [activeTab, search, lowStockFilter]);

  useEffect(() => {
    loadWarehouses();
    loadMaterials();
  }, []);

  const loadWarehouses = async () => {
    try {
      const response = await api.getWarehouses();
      setWarehouses(response.warehouses);
      if (!adjustWarehouseId && response.warehouses.length > 0) {
        setAdjustWarehouseId(response.warehouses[0].id);
      }
    } catch (error) {
      console.error('Failed to load warehouses:', error);
      setAdjustError(error instanceof Error ? error.message : 'Unable to load warehouses.');
    }
  };

  const loadMaterials = async () => {
    try {
      const response = await api.getMaterials({ activeOnly: 'true' });
      setCatalogMaterials(response.materials);
      setMaterialError(null);
      if (!adjustMaterialId && response.materials.length > 0) {
        setAdjustMaterialId(response.materials[0].id);
      }
    } catch (error) {
      console.error('Failed to load the material catalog:', error);
      setMaterialError(error instanceof Error ? error.message : 'Unable to load the material catalog.');
    }
  };

  const loadData = async () => {
    setLoading(true);
    setInventoryError(null);
    try {
      if (activeTab === 'BALANCES') {
        const res = await api.getInventoryBalances({
          lowStockOnly: lowStockFilter ? 'true' : 'false'
        });
        if (res.success) setBalances(res.balances);
      } else if (activeTab === 'SERIALS') {
        const res = await api.getTrackedUnits({ search });
        if (res.success) setTrackedUnits(res.units);
      } else if (activeTab === 'LEDGER') {
        const res = await api.getInventoryTransactions({ limit: '100' });
        if (res.success) setTransactions(res.transactions);
      }
    } catch (e) {
      console.error(e);
      setInventoryError(e instanceof Error ? e.message : 'Unable to load inventory data.');
    } finally {
      setLoading(false);
    }
  };

  const handleInspectSerial = async (serial: string) => {
    setSelectedSerial(serial);
    try {
      const res = await api.getChainOfCustody(serial);
      if (res.success) {
        setChainData(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustMaterialId || !adjustWarehouseId || adjustQuantity <= 0) {
      setAdjustError('Choose a material, warehouse, and positive quantity.');
      return;
    }
    setAdjusting(true);
    setAdjustError(null);
    try {
      const res = await api.adjustStock({
        materialId: adjustMaterialId,
        warehouseId: adjustWarehouseId,
        type: adjustType,
        quantity: adjustQuantity,
        reason: adjustReason || 'Manual inventory adjustment'
      });
      if (res.success) {
        setShowAdjustModal(false);
        await Promise.all([loadData(), loadMaterials()]);
      }
    } catch (err: any) {
      setAdjustError(err.message || 'Adjustment failed');
    } finally {
      setAdjusting(false);
    }
  };

  const handleCreateMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    setMaterialError(null);
    const initialStock = Number(materialInitialStock);
    if (!Number.isFinite(initialStock) || initialStock < 0) {
      setMaterialError('Initial stock must be a valid non-negative number.');
      return;
    }
    if (initialStock > 0 && !materialWarehouseId) {
      setMaterialError('Choose the warehouse receiving the initial stock.');
      return;
    }

    setCreatingMaterial(true);
    try {
      await api.createMaterial({
        sku: materialSku.trim(),
        name: materialName.trim(),
        category: materialCategory,
        unit: materialUnit.trim(),
        unitCost: Number(materialUnitCost),
        initialStock,
        warehouseId: initialStock > 0 ? materialWarehouseId : undefined,
        minimumStock: Number(materialMinimumStock),
        reorderLevel: Number(materialReorderLevel),
        maximumStock: Number(materialMaximumStock),
        storeLocation: materialStoreLocation.trim() || undefined,
        supplier: materialSupplier.trim() || undefined,
        isSerialRequired: materialIsSerialRequired,
        requiresSafaricomTracking: materialTracksSafaricom
      });
      setMaterialSku('');
      setMaterialName('');
      setMaterialCategory('OTHER');
      setMaterialUnit('pcs');
      setMaterialUnitCost('0');
      setMaterialInitialStock('0');
      setMaterialMinimumStock('10');
      setMaterialReorderLevel('20');
      setMaterialMaximumStock('1000');
      setMaterialStoreLocation('');
      setMaterialSupplier('');
      setMaterialIsSerialRequired(false);
      setMaterialTracksSafaricom(false);
      setShowCreateMaterialModal(false);
      await Promise.all([loadMaterials(), loadData()]);
    } catch (error) {
      setMaterialError(error instanceof Error ? error.message : 'Failed to create material.');
    } finally {
      setCreatingMaterial(false);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingWarehouse(true);
    setWarehouseError(null);
    try {
      const response = await api.createWarehouse({
        code: warehouseCode.trim(),
        name: warehouseName.trim(),
        location: warehouseLocation.trim(),
        manager: warehouseManager.trim() || undefined
      });
      setWarehouses((current) => [...current, response.warehouse].sort((a, b) => a.name.localeCompare(b.name)));
      setAdjustWarehouseId(response.warehouse.id);
      setWarehouseCode('');
      setWarehouseName('');
      setWarehouseLocation('');
      setWarehouseManager('');
      setShowWarehouseModal(false);
    } catch (error) {
      setWarehouseError(error instanceof Error ? error.message : 'Failed to create warehouse.');
    } finally {
      setCreatingWarehouse(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Inventory & Serial Chain of Custody
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time stock ledger, serial tracking for Safaricom compliance, and transaction history
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManageMaterials && (
            <button
              type="button"
              onClick={() => {
                setMaterialError(null);
                setMaterialWarehouseId(warehouses[0]?.id || '');
                setShowCreateMaterialModal(true);
              }}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto"
            >
              <PackagePlus className="w-4 h-4 text-[#04446F]" />
              <span>Add Material</span>
            </button>
          )}
          {canManageWarehouses && (
            <button
              type="button"
              onClick={() => { setWarehouseError(null); setShowWarehouseModal(true); }}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 text-[#04446F]" />
              <span>Add Warehouse</span>
            </button>
          )}
          {canManageWarehouses && <button
            disabled={warehouses.length === 0 || catalogMaterials.length === 0}
            title={warehouses.length === 0 ? 'Create a warehouse before posting inventory.' : catalogMaterials.length === 0 ? 'Add a material before posting inventory.' : undefined}
            onClick={() => {
              if (catalogMaterials.length > 0) setAdjustMaterialId(catalogMaterials[0].id);
              if (warehouses.length > 0) setAdjustWarehouseId(warehouses[0].id);
              setAdjustError(null);
              setShowAdjustModal(true);
            }}
            className="px-3.5 py-2 bg-[#0B2545] hover:bg-[#133966] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Stock Adjustment / Receipt</span>
          </button>}
        </div>
      </div>

      {(inventoryError || (materialError && !showCreateMaterialModal)) && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {inventoryError || materialError}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('BALANCES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'BALANCES'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Stock Balances
          </button>

          <button
            onClick={() => setActiveTab('SERIALS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'SERIALS'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Serialized Tools & Serials
          </button>

          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'LEDGER'
                ? 'bg-[#0B2545] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Inventory Ledger
          </button>
        </div>

        {/* Tab-specific Filters */}
        <div className="flex items-center gap-2">
          {activeTab === 'BALANCES' && (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockFilter}
                onChange={(e) => setLowStockFilter(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Low Stock Alerts Only</span>
            </label>
          )}

          {activeTab === 'SERIALS' && (
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search serial or tag..."
                className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {showCreateMaterialModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-900/80 p-4 backdrop-blur-xs">
              <div className="my-auto max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between bg-[#0B2545] p-4 text-white">
                  <div>
                    <h3 className="text-sm font-bold">Add Material to Store Catalog</h3>
                    <p className="mt-0.5 text-[11px] text-slate-300">New active materials become available in field requisitions.</p>
                  </div>
                  <button type="button" onClick={() => setShowCreateMaterialModal(false)} className="text-slate-300 hover:text-white" aria-label="Close add material form">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateMaterial} className="max-h-[calc(92vh-64px)] space-y-4 overflow-y-auto p-5 text-xs">
                  {materialError && <div role="alert" className="rounded border border-red-200 bg-red-50 p-2.5 text-red-700">{materialError}</div>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">SKU *</label>
                      <input value={materialSku} onChange={(event) => setMaterialSku(event.target.value)} placeholder="e.g. DROP-CABLE-1C" className="w-full rounded border border-slate-300 px-3 py-2 font-mono uppercase" required />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Material Name *</label>
                      <input value={materialName} onChange={(event) => setMaterialName(event.target.value)} placeholder="e.g. 1-Core FTTH Drop Cable" className="w-full rounded border border-slate-300 px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Category *</label>
                      <select value={materialCategory} onChange={(event) => setMaterialCategory(event.target.value as MaterialCategory)} className="w-full rounded border border-slate-300 bg-white px-3 py-2">
                        <option value="FIBRE_CABLE">Fibre Cable</option>
                        <option value="CONNECTORS">Connectors & Patch Cords</option>
                        <option value="SPLITTERS">Optical Splitters</option>
                        <option value="TOOLS">Field Tools</option>
                        <option value="TESTING_EQUIPMENT">Testing Equipment</option>
                        <option value="INSTALLATION_MATERIALS">Installation Materials</option>
                        <option value="CONSUMABLES">Consumables</option>
                        <option value="SAFETY_PPE">Safety & PPE</option>
                        <option value="NETWORK_EQUIPMENT">Network Equipment</option>
                        <option value="ELECTRICAL">Electrical</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Unit *</label>
                      <input value={materialUnit} onChange={(event) => setMaterialUnit(event.target.value)} placeholder="pcs, metres, rolls" className="w-full rounded border border-slate-300 px-3 py-2" required />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Unit Cost (KES)</label>
                      <input type="number" min="0" step="0.01" value={materialUnitCost} onChange={(event) => setMaterialUnitCost(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Opening Stock</label>
                      <input type="number" min="0" step="0.01" value={materialInitialStock} onChange={(event) => setMaterialInitialStock(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
                    </div>
                    {Number(materialInitialStock) > 0 && (
                      <div className="sm:col-span-2">
                        <label className="mb-1 block font-semibold text-slate-700">Opening Stock Warehouse *</label>
                        <select value={materialWarehouseId} onChange={(event) => setMaterialWarehouseId(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2" required>
                          <option value="">-- Select receiving warehouse --</option>
                          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} — {warehouse.name} ({warehouse.location})</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Minimum Stock</label>
                      <input type="number" min="0" step="0.01" value={materialMinimumStock} onChange={(event) => setMaterialMinimumStock(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Reorder Level</label>
                      <input type="number" min="0" step="0.01" value={materialReorderLevel} onChange={(event) => setMaterialReorderLevel(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Maximum Stock</label>
                      <input type="number" min="0" step="0.01" value={materialMaximumStock} onChange={(event) => setMaterialMaximumStock(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Store Location</label>
                      <input value={materialStoreLocation} onChange={(event) => setMaterialStoreLocation(event.target.value)} placeholder="e.g. Rack A-03" className="w-full rounded border border-slate-300 px-3 py-2" />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Supplier</label>
                      <input value={materialSupplier} onChange={(event) => setMaterialSupplier(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
                    <label className="flex items-center gap-2 text-slate-700">
                      <input type="checkbox" checked={materialIsSerialRequired} onChange={(event) => setMaterialIsSerialRequired(event.target.checked)} />
                      Serial number required
                    </label>
                    <label className="flex items-center gap-2 text-slate-700">
                      <input type="checkbox" checked={materialTracksSafaricom} onChange={(event) => setMaterialTracksSafaricom(event.target.checked)} />
                      Safaricom asset tracking
                    </label>
                  </div>
                  {warehouses.length === 0 && (
                    <p className="rounded border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
                      No warehouse exists yet. You can create the material with zero opening stock, but must create a warehouse before receiving stock.
                    </p>
                  )}
                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                    <button type="button" onClick={() => setShowCreateMaterialModal(false)} className="px-3 py-1.5 font-medium text-slate-600">Cancel</button>
                    <button type="submit" disabled={creatingMaterial} className="rounded bg-[#0B2545] px-4 py-1.5 font-bold text-white disabled:opacity-60">
                      {creatingMaterial ? 'Saving…' : 'Add Material'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab 1: Warehouse Stock Balances */}
      {activeTab === 'BALANCES' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Material Name & Category</th>
                  <th className="py-3 px-4 text-right">Available Stock</th>
                  <th className="py-3 px-4 text-right">Min Stock</th>
                  <th className="py-3 px-4 text-right">Unit Cost (KES)</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      No stocked materials are recorded yet. Add a material to the catalog and enter its opening stock, or add it with zero stock and post a receipt.
                    </td>
                  </tr>
                )}
                {balances.map((b, idx) => {
                  const isLow = b.warehouseStock <= b.minimumStock;
                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50 transition ${
                        isLow ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{b.sku}</td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{b.materialName}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{b.category}</span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                        <span className={isLow ? 'text-amber-700' : 'text-slate-900'}>
                          {b.warehouseStock.toLocaleString()} {b.unit}
                        </span>
                        {isLow && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded font-bold">
                            LOW
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {b.minimumStock} {b.unit}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        KES {b.unitCost?.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600">
                        {b.storeLocation || 'Central Bay'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {b.isSerialRequired ? (
                            <span className="px-1.5 py-0.5 text-[9px] bg-blue-100 text-blue-800 font-semibold rounded">
                              Serial Tracked
                            </span>
                          ) : null}
                          {b.requiresSafaricomTracking ? (
                            <span className="px-1.5 py-0.5 text-[9px] bg-emerald-100 text-emerald-800 font-semibold rounded">
                              Safaricom
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Serialized Units & Safaricom Barcodes */}
      {activeTab === 'SERIALS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Equipment / Material</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Current Custodian</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Safaricom Tag</th>
                  <th className="py-3 px-4 text-center">Chain of Custody</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trackedUnits.map((tu) => (
                  <tr key={tu.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-900 text-xs sm:text-sm">
                      {tu.serialNumber}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">{tu.materialName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{tu.sku}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          tu.status === 'IN_STORE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tu.status === 'WITH_TEAM'
                            ? 'bg-blue-100 text-blue-800'
                            : tu.status === 'DAMAGED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {tu.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 block">
                        {tu.custodianName || 'Store Officer'}
                      </span>
                      {tu.teamCode && (
                        <span className="text-[11px] text-blue-700 font-semibold">
                          Team {tu.teamCode}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-600">{tu.currentLocation}</td>

                    <td className="py-3 px-4 font-mono text-emerald-700 font-semibold">
                      {tu.safaricomTag || '-'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleInspectSerial(tu.serialNumber)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Timeline</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Complete Inventory Ledger Transactions */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Previous</th>
                  <th className="py-3 px-4 text-right">New Balance</th>
                  <th className="py-3 px-4">Reference / Reason</th>
                  <th className="py-3 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {transactions.map((tx) => {
                  const isPositive = ['RECEIPT', 'PURCHASE', 'RETURN'].includes(tx.type);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition text-[11px]">
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('en-GB')}{' '}
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-2.5 px-4 font-sans font-medium text-slate-800">
                        {tx.materialName} ({tx.sku})
                      </td>

                      <td className="py-2.5 px-4">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === 'RECEIPT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tx.type === 'ISSUE'
                              ? 'bg-blue-100 text-blue-800'
                              : tx.type === 'RETURN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>

                      <td className={`py-2.5 px-4 text-right font-bold ${isPositive ? 'text-emerald-700' : 'text-blue-900'}`}>
                        {isPositive ? '+' : '-'}{tx.quantity} {tx.unit}
                      </td>

                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {tx.previousStock}
                      </td>

                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {tx.newStock}
                      </td>

                      <td className="py-2.5 px-4 font-sans text-slate-700">
                        <strong className="font-mono">{tx.reference || '-'}</strong>
                        {tx.reason && <span className="text-slate-400 ml-1">({tx.reason})</span>}
                      </td>

                      <td className="py-2.5 px-4 font-sans text-slate-500">
                        {tx.userName || 'System Engine'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chain of Custody Detail Modal */}
      {selectedSerial && chainData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2545] text-white p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
                  Chain of Custody
                </span>
                <h3 className="font-bold text-base font-mono">{selectedSerial}</h3>
                <p className="text-xs text-slate-300">{chainData.unit.materialName}</p>
              </div>
              <button
                onClick={() => setSelectedSerial(null)}
                className="p-1.5 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                  <span className="font-bold text-slate-800">{chainData.unit.status}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Location</span>
                  <span className="font-semibold text-slate-800">{chainData.unit.currentLocation}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Custodian</span>
                  <span className="font-semibold text-slate-800">{chainData.unit.custodianName || 'Store'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Safaricom Asset Tag</span>
                  <span className="font-mono font-bold text-emerald-700">{chainData.unit.safaricomTag || 'None'}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Movement History & Audit Trail
                </span>
                <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 pl-7">
                  {chainData.chain.map((c: any, i: number) => (
                    <div key={i} className="relative text-xs">
                      <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
                      <div className="font-semibold text-slate-900">
                        {c.eventType === 'ISSUED_TO_TEAM' ? 'Issued to Team ' + c.teamCode : 'Returned to Store'}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Ref: {c.requestNumber} • Custodian: {c.recipientName || c.receiverName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(c.timestamp).toLocaleString('en-GB')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedSerial(null)}
                className="px-4 py-1.5 bg-slate-200 rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#0B2545] p-4 text-white">
              <div>
                <h3 className="text-sm font-bold">Create Warehouse</h3>
                <p className="mt-0.5 text-[11px] text-slate-300">Add a real stock location for receipts and issue tracking.</p>
              </div>
              <button type="button" onClick={() => setShowWarehouseModal(false)} className="text-slate-300 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateWarehouse} className="space-y-3 p-5 text-xs">
              {warehouseError && <div className="rounded border border-red-200 bg-red-50 p-2.5 text-red-700">{warehouseError}</div>}
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Warehouse Code *</label>
                <input value={warehouseCode} onChange={(event) => setWarehouseCode(event.target.value)} placeholder="e.g. NBI-STORE-01" className="w-full rounded border border-slate-300 px-3 py-2 font-mono uppercase" required />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Warehouse Name *</label>
                <input value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} placeholder="e.g. Regional Materials Store" className="w-full rounded border border-slate-300 px-3 py-2" required />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Location *</label>
                <input value={warehouseLocation} onChange={(event) => setWarehouseLocation(event.target.value)} placeholder="County, town, or site" className="w-full rounded border border-slate-300 px-3 py-2" required />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Warehouse Manager</label>
                <input value={warehouseManager} onChange={(event) => setWarehouseManager(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setShowWarehouseModal(false)} className="px-3 py-1.5 font-medium text-slate-600">Cancel</button>
                <button type="submit" disabled={creatingWarehouse} className="rounded bg-[#0B2545] px-4 py-1.5 font-bold text-white disabled:opacity-60">
                  {creatingWarehouse ? 'Creating…' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2545] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Stock Ledger Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} className="p-1 text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="p-5 space-y-4 text-xs">
              {adjustError && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded border border-red-200">
                  {adjustError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Warehouse</label>
                <select
                  value={adjustWarehouseId}
                  onChange={(e) => setAdjustWarehouseId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  required
                >
                  <option value="">-- Select warehouse --</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} — {warehouse.name} ({warehouse.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Material</label>
                <select
                  value={adjustMaterialId}
                  onChange={(e) => setAdjustMaterialId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                >
                  {catalogMaterials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.sku} — {material.name} ({material.currentStock} {material.unit} in store)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Type</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium"
                  >
                    <option value="RECEIPT">RECEIPT (Supplier / Intake)</option>
                    <option value="RETURN">RETURN (From Field)</option>
                    <option value="DAMAGE">DAMAGE (Write-off)</option>
                    <option value="LOSS">LOSS / MISSING</option>
                    <option value="ADJUSTMENT">STOCK AUDIT ADJUST</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. New supplier batch received from Yangtze Optical"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-4 py-1.5 bg-[#0B2545] text-white font-bold rounded"
                >
                  {adjusting ? 'Updating...' : 'Post to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
