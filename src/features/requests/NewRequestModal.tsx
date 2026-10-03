import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { Material, Team, Project } from '../../types';
import { X, Plus, Trash2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: (requestId: string) => void;
}

interface RequestLineItem {
  id: string;
  materialId: string;
  materialName: string;
  sku: string;
  unit: string;
  availableStock: number;
  quantityRequested: number;
  reason?: string;
  isSerialRequired: boolean;
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestCreated
}) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingFormData, setLoadingFormData] = useState(false);
  const [formDataError, setFormDataError] = useState<string | null>(null);

  // Form State
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [requiredDate, setRequiredDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [reason, setReason] = useState('');
  const [workOrderRef, setWorkOrderRef] = useState('');
  const [notes, setNotes] = useState('');

  // Items State
  const [items, setItems] = useState<RequestLineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldUser = ['FIELD_TECHNICIAN', 'FIELD_TEAM_LEADER'].includes(user?.role || '');
  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const availableProjects = selectedTeam?.projectId
    ? projects.filter((project) => project.id === selectedTeam.projectId)
    : [];

  useEffect(() => {
    if (!isOpen) return;

    loadFormData();
  }, [isOpen]);

  useEffect(() => {
    if (selectedTeam?.projectId) {
      setSelectedProjectId(selectedTeam.projectId);
    } else if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id || '');
    }
  }, [selectedTeamId, selectedTeam?.projectId, projects, selectedProjectId]);

  const loadFormData = async () => {
    setLoadingFormData(true);
    setFormDataError(null);
    const [teamsResult, projectsResult, materialsResult] = await Promise.allSettled([
      api.getTeams(),
      api.getProjects(),
      api.getMaterials({ activeOnly: 'true' })
    ]);
    const failures: string[] = [];

    if (teamsResult.status === 'fulfilled' && teamsResult.value.success) {
      const loadedTeams = teamsResult.value.teams;
      setTeams(loadedTeams);
      const initialTeamId = user?.teamId && loadedTeams.some((team) => team.id === user.teamId)
        ? user.teamId
        : loadedTeams[0]?.id || '';
      setSelectedTeamId(initialTeamId);
    } else {
      const message = teamsResult.status === 'rejected' ? teamsResult.reason : null;
      failures.push(`teams: ${message instanceof Error ? message.message : 'could not be loaded'}`);
    }

    if (projectsResult.status === 'fulfilled' && projectsResult.value.success) {
      setProjects(projectsResult.value.projects);
      setSelectedProjectId(projectsResult.value.projects[0]?.id || '');
    } else {
      const message = projectsResult.status === 'rejected' ? projectsResult.reason : null;
      failures.push(`projects: ${message instanceof Error ? message.message : 'could not be loaded'}`);
    }

    if (materialsResult.status === 'fulfilled' && materialsResult.value.success) {
      setMaterials(materialsResult.value.materials);
    } else {
      const message = materialsResult.status === 'rejected' ? materialsResult.reason : null;
      failures.push(`materials: ${message instanceof Error ? message.message : 'could not be loaded'}`);
    }
    if (failures.length > 0) {
      const message = `Unable to load ${failures.join('; ')}. Close and reopen the form to retry.`;
      setFormDataError(message);
      console.error(message);
    }
    setLoadingFormData(false);
  };

  const addItemRow = () => {
    if (materials.length === 0) return;
    const defaultMat = materials[0];
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        materialId: defaultMat.id,
        materialName: defaultMat.name,
        sku: defaultMat.sku,
        unit: defaultMat.unit,
        availableStock: defaultMat.currentStock,
        quantityRequested: 1,
        reason: '',
        isSerialRequired: !!defaultMat.isSerialRequired
      }
    ]);
  };

  const removeItemRow = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMaterialChange = (rowId: string, materialId: string) => {
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              materialId: mat.id,
              materialName: mat.name,
              sku: mat.sku,
              unit: mat.unit,
              availableStock: mat.currentStock,
              isSerialRequired: !!mat.isSerialRequired
            }
          : item
      )
    );
  };

  const handleQuantityChange = (rowId: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId ? { ...item, quantityRequested: Math.max(1, qty) } : item
      )
    );
  };

  const handleLineReasonChange = (rowId: string, r: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, reason: r } : item))
    );
  };

  const handleSubmit = async (isDraft: boolean) => {
    setError(null);
    if (loadingFormData || formDataError || materials.length === 0 || teams.length === 0 || projects.length === 0) {
      setError(formDataError || 'Teams, projects, and at least one active material must load before creating a request.');
      return;
    }
    if (!selectedTeamId || !selectedProjectId || !reason.trim() || items.length === 0) {
      setError('Please select team, project, provide a reason, and add at least one material.');
      return;
    }
    if (fieldUser && selectedTeamId !== user?.teamId) {
      setError('You can only create requests for your assigned team.');
      return;
    }
    if (selectedTeam?.projectId && selectedProjectId !== selectedTeam.projectId) {
      setError('The selected project does not match the project assigned to this field team.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        teamId: selectedTeamId,
        projectId: selectedProjectId,
        siteName: siteName.trim() || undefined,
        requiredDate,
        priority,
        reason: reason.trim(),
        workOrderRef: workOrderRef.trim() || undefined,
        notes: notes.trim() || undefined,
        isDraft,
        items: items.map((it) => ({
          materialId: it.materialId,
          quantityRequested: it.quantityRequested,
          unit: it.unit,
          reason: it.reason
        }))
      };

      const res = await api.createRequest(payload);
      if (res.success) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
        onRequestCreated(res.requestId);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-auto overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#0B2545] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-base sm:text-lg">New Field Material Requisition</h3>
            <p className="text-xs text-slate-300">
              Official digital submission replacing WhatsApp material requests
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Form */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {formDataError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formDataError}</span>
            </div>
          )}
          {loadingFormData && <p className="text-xs text-slate-500">Loading teams, projects, and store materials…</p>}
          {!loadingFormData && !formDataError && materials.length === 0 && (
            <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              The material catalog is empty. Ask an administrator or store officer to add active materials before submitting a field request.
            </div>
          )}

          {/* Row 1: Team & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Requesting Field Team *
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                disabled={fieldUser || loadingFormData}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {teams.length === 0 && <option value="">No field teams available</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.teamCode} — {t.name} ({t.assignedArea || 'Metro'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telecom Project *
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={loadingFormData || !!selectedTeam?.projectId}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {availableProjects.length === 0 && <option value="">No project assigned to this team</option>}
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.client})
                  </option>
                ))}
              </select>
              {selectedTeam && !selectedTeam.projectId && (
                <p className="mt-1 text-[11px] text-amber-700">Assign a project to this team before submitting a material request.</p>
              )}
            </div>
          </div>

          {/* Row 2: Site, Work Order, Priority & Required Date */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Site / Cluster
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Customer site, route, or cabinet identifier"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Work Order / Ref
              </label>
              <input
                type="text"
                value={workOrderRef}
                onChange={(e) => setWorkOrderRef(e.target.value)}
                placeholder="Work order or ticket reference"
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High (Urgent)</option>
                <option value="CRITICAL">Critical (Outage)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Required Date *
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 3: Operational Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operational Justification / Reason *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Fiber drop cable & clips for Safaricom FTTH client connection"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Section: Material Line Items */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Requested Materials & Equipment ({items.length})
              </span>
              <button
                type="button"
                onClick={addItemRow}
                disabled={loadingFormData || materials.length === 0 || !!formDataError}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 text-blue-700 rounded text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
              {!loadingFormData && materials.length === 0 && items.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">There are no active materials to request.</div>
              )}
              {items.map((item, idx) => (
                <div key={item.id} className="p-3 bg-white hover:bg-slate-50/50 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Material Select */}
                    <div className="col-span-12 sm:col-span-7">
                      <select
                        value={item.materialId}
                        onChange={(e) => handleMaterialChange(item.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-medium focus:ring-1 focus:ring-blue-500"
                      >
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.sku} — {m.name} ({m.currentStock} {m.unit} in store)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-8 sm:col-span-3 flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        value={item.quantityRequested}
                        onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                        className="w-20 px-2 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-500 font-medium">{item.unit}</span>
                      {item.isSerialRequired && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded font-semibold shrink-0">
                          Serial
                        </span>
                      )}
                    </div>

                    {/* Delete Row Button */}
                    <div className="col-span-4 sm:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeItemRow(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Line Item Notes */}
                  <input
                    type="text"
                    value={item.reason || ''}
                    onChange={(e) => handleLineReasonChange(item.id, e.target.value)}
                    placeholder="Specific purpose for this item (optional)..."
                    className="w-full px-2.5 py-1 text-xs text-slate-600 border border-slate-200 rounded placeholder:text-slate-400"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-medium"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting || loadingFormData || !!formDataError || materials.length === 0 || teams.length === 0 || availableProjects.length === 0}
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-md text-xs transition"
            >
              Save as Draft
            </button>

            <button
              type="button"
              disabled={submitting || loadingFormData || !!formDataError || materials.length === 0 || teams.length === 0 || availableProjects.length === 0}
              onClick={() => handleSubmit(false)}
              className="px-5 py-2 bg-[#0B2545] hover:bg-[#133966] text-white font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
