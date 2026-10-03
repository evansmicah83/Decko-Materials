import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { MaterialRequest } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RequestTimeline } from '../../components/common/RequestTimeline';
import { PDFViewerModal } from '../../components/common/PDFViewerModal';
import { QRScannerModal } from '../../components/common/QRScannerModal';
import {
  X,
  Printer,
  CheckCircle2,
  XCircle,
  HelpCircle,
  CreditCard,
  PackageCheck,
  Truck,
  RotateCcw,
  Boxes,
  FileText,
  AlertCircle,
  Camera,
  Calendar,
  Building,
  UserCheck,
  Shield,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface RequestDetailModalProps {
  requestId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged: () => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  requestId,
  isOpen,
  onClose,
  onStatusChanged
}) => {
  const { user } = useAuth();
  const [request, setRequest] = useState<MaterialRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal sub-dialogs
  const [showPDF, setShowPDF] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTargetLineId, setScannerTargetLineId] = useState<string | null>(null);

  // Action input states
  const [actionType, setActionType] = useState<
    'approve' | 'reject' | 'clarify' | 'payment' | 'issue' | 'receive' | 'consume' | 'return' | null
  >(null);

  // Action form fields
  const [commentInput, setCommentInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('M-PESA');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [recipientName, setRecipientName] = useState(user?.fullName || '');
  const [issuedQuantities, setIssuedQuantities] = useState<Record<string, number>>({});
  const [issuedSerials, setIssuedSerials] = useState<Record<string, string>>({});
  const [consumedQuantities, setConsumedQuantities] = useState<Record<string, number>>({});
  const [returnCondition, setReturnCondition] = useState<'GOOD' | 'DAMAGED' | 'FAULTY'>('GOOD');
  const [returnItemSerial, setReturnItemSerial] = useState('');
  const [returnQuantity, setReturnQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen || !requestId) {
      setRequest(null);
      setActionType(null);
      setError(null);
      setActionSuccess(null);
      return;
    }

    loadRequestDetails();
  }, [isOpen, requestId]);

  const loadRequestDetails = async () => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getRequest(requestId);
      if (res.success && res.request) {
        setRequest(res.request);

        // Pre-fill authorized quantities while requiring real serials at issue time.
        const initialQty: Record<string, number> = {};
        const initialConsume: Record<string, number> = {};

        res.request.items?.forEach((it) => {
          initialQty[it.id] = it.quantityApproved > 0 ? it.quantityRemaining : it.quantityRequested;
          initialConsume[it.materialId] = 0;
        });

        setIssuedQuantities(initialQty);
        setIssuedSerials({});
        setConsumedQuantities(initialConsume);
        setPaymentAmount(res.request.estimatedCost || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !requestId) return null;

  // Role permissions
  const canApprove =
    ['SUPER_ADMIN', 'DISPATCHER', 'PROJECT_MANAGER'].includes(user?.role || '') &&
    ['SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED'].includes(request?.status || '');

  const canPay =
    ['SUPER_ADMIN', 'ACCOUNTANT'].includes(user?.role || '') &&
    ['APPROVED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING'].includes(request?.status || '');

  const canIssue =
    ['SUPER_ADMIN', 'STORE_OFFICER'].includes(user?.role || '') &&
    ['READY_FOR_ISSUE', 'PARTIALLY_ISSUED', 'PAID'].includes(request?.status || '');

  const canReceive =
    ['SUPER_ADMIN', 'FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(user?.role || '') &&
    ['ISSUED', 'PARTIALLY_ISSUED'].includes(request?.status || '');

  const canConsumeOrReturn =
    ['RECEIVED', 'IN_USE'].includes(request?.status || '');

  // Handlers
  const handleApprove = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.approveRequest(requestId, {
        comment: commentInput || 'Technical scope and quantities approved for project execution.'
      });
      if (res.success) {
        confetti({ particleCount: 40, spread: 60 });
        setActionSuccess('Request approved! Routed to Accounting Queue for payment verification.');
        setActionType(null);
        await loadRequestDetails();
        onStatusChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!commentInput.trim()) {
      setError('A rejection reason is mandatory.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.rejectRequest(requestId, commentInput.trim());
      if (res.success) {
        setActionSuccess('Request has been rejected.');
        setActionType(null);
        await loadRequestDetails();
        onStatusChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Rejection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClarify = async () => {
    if (!commentInput.trim()) {
      setError('Please provide clarification query comment.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.clarifyRequest(requestId, commentInput.trim());
      if (res.success) {
        setActionSuccess('Clarification query sent to field team.');
        setActionType(null);
        await loadRequestDetails();
        onStatusChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Clarification query failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentRef.trim()) {
      setError('Payment Reference (e.g. M-Pesa / EFT Reference) is required.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.recordPayment(requestId, {
        amount: paymentAmount,
        paymentMethod,
        paymentReference: paymentRef.trim(),
        notes: commentInput || 'Authorized payment recorded by Finance department'
      });
      if (res.success) {
        confetti({ particleCount: 50, spread: 70 });
        setActionSuccess('Payment confirmed! Request is now READY FOR STORE ISSUANCE.');
        setActionType(null);
        await loadRequestDetails();
        onStatusChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueMaterials = async () => {
    if (!recipientName.trim()) {
      setError('Recipient Name is required.');
      return;
    }

    const itemsToIssue =
      request?.items?.map((it) => ({
        lineItemId: it.id,
        quantityIssued: Number(issuedQuantities[it.id]) || 0,
        serialNumber: issuedSerials[it.id] || undefined
      })) || [];

    const hasAny = itemsToIssue.some((it) => it.quantityIssued > 0);
    if (!hasAny) {
      setError('Please enter a quantity greater than zero for at least one item to issue.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.issueMaterials(requestId, {
        recipientName: recipientName.trim(),
        issuedItems: itemsToIssue
      });
      if (res.success) {
        confetti({ particleCount: 50, spread: 70 });
        setActionSuccess(res.message);
        setActionType(null);
        await loadRequestDetails();
        onStatusChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Issuance failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReceipt = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.confirmReceipt(requestId, {
        notes: commentInput || 'Field team confirmed physical receipt of all listed materials.'
      });
      if (res.success) {
        confetti({ particleCount: 40, spread: 60 });
        setActionSuccess('Material receipt acknowledged! Materials are now marked IN USE.');
        setActionType(null);
        await loadRequestDetails();
        onStatusChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordConsumption = async () => {
    const consumptions = Object.entries(consumedQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([materialId, qty]) => ({
        materialId,
        quantityConsumed: Number(qty),
        notes: commentInput || 'Field installation consumption'
      }));

    if (consumptions.length === 0) {
      setError('Please specify at least one quantity consumed.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.recordConsumption(requestId, consumptions);
      if (res.success) {
        setActionSuccess('Consumption logged and team virtual stock updated.');
        setActionType(null);
        await loadRequestDetails();
        onStatusChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Consumption logging failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordReturn = async () => {
    // Pick the first serialized or cable item
    const toolItem = request?.items?.find((it) => it.isSerialRequired) || request?.items?.[0];
    if (!toolItem) return;
    if (toolItem.isSerialRequired && !returnItemSerial.trim()) {
      setError('Enter or scan the actual serial number before returning this serialized item.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.recordReturn(requestId, [
        {
          materialId: toolItem.materialId,
          quantity: returnQuantity,
          serialNumber: returnItemSerial.trim() || undefined,
          condition: returnCondition,
          notes: commentInput || 'Tool returned upon completion of site installation'
        }
      ]);
      if (res.success) {
        confetti({ particleCount: 40, spread: 60 });
        setActionSuccess('Return accepted by Store Officer and warehouse inventory restored!');
        setActionType(null);
        await loadRequestDetails();
        onStatusChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Return failed');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = (code: string) => {
    if (scannerTargetLineId) {
      setIssuedSerials((prev) => ({ ...prev, [scannerTargetLineId]: code }));
    } else {
      setReturnItemSerial(code);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-auto overflow-hidden border border-slate-200 flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="bg-[#0B2545] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Boxes className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base sm:text-lg">
                  {request?.requestNumber || 'Loading...'}
                </span>
                {request && <StatusBadge status={request.status} size="sm" />}
              </div>
              <p className="text-xs text-slate-300">
                Team {request?.teamCode} • {request?.projectName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {request && (
              <button
                onClick={() => setShowPDF(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Voucher PDF</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
          {/* Status Alerts */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {request && (
            <>
              {/* Visual Workflow Timeline */}
              <RequestTimeline request={request} />

              {/* Action Banner depending on role and status */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                      Current Action Required:
                    </span>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {request.status === 'SUBMITTED' || request.status === 'UNDER_REVIEW'
                        ? 'Project Manager / Dispatcher Technical Approval'
                        : request.status === 'APPROVED' || request.status === 'PAYMENT_PENDING'
                        ? 'Accounting Payment Verification & Reference'
                        : request.status === 'READY_FOR_ISSUE' || request.status === 'PARTIALLY_ISSUED'
                        ? 'Store Officer Issuance & Serial Scanning'
                        : request.status === 'ISSUED'
                        ? 'Field Team Receipt Confirmation'
                        : request.status === 'RECEIVED' || request.status === 'IN_USE'
                        ? 'Active on Field Site (Consumption or Tool Return)'
                        : 'Request Completed'}
                    </p>
                  </div>

                  {/* Contextual Action Triggers */}
                  <div className="flex flex-wrap items-center gap-2">
                    {canApprove && (
                      <>
                        <button
                          onClick={() => setActionType('approve')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve Request
                        </button>
                        <button
                          onClick={() => setActionType('clarify')}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-md text-xs flex items-center gap-1.5 transition"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          Clarification
                        </button>
                        <button
                          onClick={() => setActionType('reject')}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}

                    {canPay && (
                      <button
                        onClick={() => setActionType('payment')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition"
                      >
                        <CreditCard className="w-4 h-4" />
                        Confirm Payment (KES {request.estimatedCost?.toLocaleString()})
                      </button>
                    )}

                    {canIssue && (
                      <button
                        onClick={() => setActionType('issue')}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition"
                      >
                        <PackageCheck className="w-4 h-4" />
                        Authorize & Issue Materials
                      </button>
                    )}

                    {canReceive && (
                      <button
                        onClick={() => setActionType('receive')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition"
                      >
                        <Truck className="w-4 h-4" />
                        Confirm Team Receipt
                      </button>
                    )}

                    {canConsumeOrReturn && (
                      <>
                        <button
                          onClick={() => setActionType('consume')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 transition"
                        >
                          Record Consumption
                        </button>
                        <button
                          onClick={() => setActionType('return')}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Return Tool / Item
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Action Forms */}
                {actionType === 'approve' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-lg border">
                    <span className="font-bold text-slate-800 text-xs block">
                      Approve Material Request
                    </span>
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add a comment about the approved project scope..."
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApprove}
                        className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold"
                      >
                        Confirm Approval
                      </button>
                    </div>
                  </div>
                )}

                {actionType === 'reject' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-lg border">
                    <span className="font-bold text-red-700 text-xs block">
                      Reject Request (Mandatory Reason)
                    </span>
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Specify reason for rejection..."
                      className="w-full px-3 py-2 border border-red-300 rounded text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
                        className="px-4 py-1.5 bg-red-600 text-white rounded text-xs font-bold"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}

                {actionType === 'clarify' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-lg border">
                    <span className="font-bold text-amber-800 text-xs block">
                      Request Clarification from Field Team
                    </span>
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="What clarification is required? (e.g. Check drum meters remaining)..."
                      className="w-full px-3 py-2 border border-amber-300 rounded text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClarify}
                        className="px-4 py-1.5 bg-amber-600 text-white rounded text-xs font-bold"
                      >
                        Send Query
                      </button>
                    </div>
                  </div>
                )}

                {actionType === 'payment' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-lg border">
                    <span className="font-bold text-emerald-800 text-xs block">
                      Record Accounting Payment & Procurement Authorization
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                        >
                          <option value="M-PESA">M-PESA Paybill</option>
                          <option value="BANK_EFT">Bank EFT / Wire</option>
                          <option value="PETTY_CASH">Petty Cash</option>
                          <option value="CORPORATE_PO">Corporate Purchase Order</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Reference Code *
                        </label>
                        <input
                          type="text"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          placeholder="e.g. MPESA-QKD892182"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Amount (KES)
                        </label>
                        <input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Payment notes or accounting voucher reference..."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmPayment}
                        className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold"
                      >
                        Authorize & Release to Store
                      </button>
                    </div>
                  </div>
                )}

                {actionType === 'issue' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-lg border">
                    <span className="font-bold text-cyan-900 text-xs block">
                      Store Issuance & Controlled Serial Verification
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Recipient Name (Technician / Custodian) *
                        </label>
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Full name of collecting team member"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                        />
                      </div>
                    </div>

                    {/* Table of items to issue with Serial Scan fields */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="py-2 px-3">Material</th>
                            <th className="py-2 px-3 text-center">Remaining</th>
                            <th className="py-2 px-3 text-center">Issue Qty</th>
                            <th className="py-2 px-3">Serial / Barcode Scan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {request.items?.map((it) => (
                            <tr key={it.id}>
                              <td className="py-2 px-3">
                                <span className="font-medium text-slate-800 block">
                                  {it.materialName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {it.sku}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-medium">
                                {it.quantityRemaining || it.quantityRequested} {it.unit}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={it.quantityRemaining || it.quantityRequested}
                                  value={issuedQuantities[it.id] ?? 0}
                                  onChange={(e) =>
                                    setIssuedQuantities((prev) => ({
                                      ...prev,
                                      [it.id]: Number(e.target.value)
                                    }))
                                  }
                                  className="w-16 px-2 py-1 border border-slate-300 rounded text-center font-mono font-bold"
                                />
                              </td>
                              <td className="py-2 px-3">
                                {it.isSerialRequired || it.requiresSafaricomTracking ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={issuedSerials[it.id] || ''}
                                      onChange={(e) =>
                                        setIssuedSerials((prev) => ({
                                          ...prev,
                                          [it.id]: e.target.value
                                        }))
                                      }
                                      placeholder="Scan or enter actual serial"
                                      className="w-36 px-2 py-1 border border-amber-300 rounded text-[11px] font-mono font-bold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setScannerTargetLineId(it.id);
                                        setShowScanner(true);
                                      }}
                                      className="p-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                      title="Scan Serial with Camera"
                                    >
                                      <Camera className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Bulk Consumable</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleIssueMaterials}
                        className="px-4 py-1.5 bg-cyan-700 text-white rounded text-xs font-bold"
                      >
                        Complete Issuance & Deduct Stock
                      </button>
                    </div>
                  </div>
                )}

                {actionType === 'receive' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-lg border">
                    <span className="font-bold text-indigo-900 text-xs block">
                      Digital Receipt & Custody Confirmation
                    </span>
                    <p className="text-xs text-slate-600">
                      I confirm physical receipt of all issued cables, splitters, and serialized tools on site.
                    </p>
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Receipt confirmation note (e.g. Received in good condition on site)..."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmReceipt}
                        className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold"
                      >
                        Sign & Acknowledge Custody
                      </button>
                    </div>
                  </div>
                )}

                {actionType === 'consume' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-lg border">
                    <span className="font-bold text-blue-900 text-xs block">
                      Record Field Cable / Material Consumption
                    </span>

                    <div className="space-y-2">
                      {request.items?.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-xs py-1">
                          <span className="font-medium text-slate-800">{it.materialName}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={consumedQuantities[it.materialId] || 0}
                              onChange={(e) =>
                                setConsumedQuantities((prev) => ({
                                  ...prev,
                                  [it.materialId]: Number(e.target.value)
                                }))
                              }
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-center font-mono font-bold"
                            />
                            <span className="text-slate-500 text-[11px] w-8">{it.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRecordConsumption}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold"
                      >
                        Log Consumption
                      </button>
                    </div>
                  </div>
                )}

                {actionType === 'return' && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-lg border">
                    <span className="font-bold text-purple-900 text-xs block">
                      Return Reusable Tool / Material to a Warehouse
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Serial Number
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={returnItemSerial}
                            onChange={(e) => setReturnItemSerial(e.target.value)}
                            placeholder="Scan or enter actual serial"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => setShowScanner(true)}
                            className="p-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                            title="Scan with Camera"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Condition Inspection
                        </label>
                        <select
                          value={returnCondition}
                          onChange={(e: any) => setReturnCondition(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-medium"
                        >
                          <option value="GOOD">GOOD (Reusable)</option>
                          <option value="DAMAGED">DAMAGED</option>
                          <option value="FAULTY">FAULTY (Needs Service)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Return Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={returnQuantity}
                          onChange={(e) => setReturnQuantity(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 text-slate-600 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRecordReturn}
                        className="px-4 py-1.5 bg-purple-700 text-white rounded text-xs font-bold"
                      >
                        Accept & Restore Stock
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Information Grid: Project, Team, Dates, Cost */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Team
                  </span>
                  <span className="font-semibold text-slate-900 block">{request.teamCode}</span>
                  <span className="text-[11px] text-slate-500">{request.teamName}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Project & Client
                  </span>
                  <span className="font-semibold text-slate-900 block truncate">
                    {request.projectName}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Client: {request.projectClient || 'Safaricom PLC'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Site / Work Order
                  </span>
                  <span className="font-semibold text-slate-900 block">
                    {request.siteName || 'Field Operations'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {request.workOrderRef || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Estimated Cost
                  </span>
                  <span className="font-bold text-slate-900 text-sm font-mono block">
                    KES {request.estimatedCost?.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {request.payment?.status === 'CONFIRMED' ? 'Paid & Verified' : 'Allocation Pending'}
                  </span>
                </div>
              </div>

              {/* Material Items Table */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
                  Requested Materials & Store Balances
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2545] text-white">
                      <tr>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Requested</th>
                        <th className="py-2.5 px-3 text-right">Approved</th>
                        <th className="py-2.5 px-3 text-right">Issued</th>
                        <th className="py-2.5 px-3">Store Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {request.items?.map((it, idx) => (
                        <tr key={it.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                            {it.sku}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900 block">
                              {it.materialName}
                            </span>
                            {it.requiresSafaricomTracking ? (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                Safaricom Controlled
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {it.quantityRequested} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                            {it.quantityApproved || 0} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-blue-900">
                            {it.quantityIssued || 0} {it.unit}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {it.currentWarehouseStock ?? '-'} {it.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Details if available */}
              {request.payment && (
                <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    Verified Payment Record
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-emerald-800 pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Reference</span>
                      <strong className="font-mono">{request.payment.paymentReference}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Method</span>
                      <span>{request.payment.paymentMethod}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Amount</span>
                      <span className="font-bold">KES {request.payment.amount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Accountant</span>
                      <span>{request.payment.accountantName}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Immutable Audit Log Records */}
              {request.auditLogs && request.auditLogs.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    Immutable Audit Trail ({request.auditLogs.length} Events)
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs bg-white">
                    {request.auditLogs.map((log) => (
                      <div key={log.id} className="p-2.5 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-slate-900">
                            {log.action}
                          </span>
                          <span className="text-slate-500 ml-2">
                            by {log.userName || 'System'}
                          </span>
                          {log.reason && (
                            <span className="text-slate-600 italic ml-2">"{log.reason}"</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-md text-xs transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* PDF Voucher Modal */}
      {request && (
        <PDFViewerModal
          isOpen={showPDF}
          onClose={() => setShowPDF(false)}
          request={request}
        />
      )}

      {/* Camera QR/Barcode Scanner Modal */}
      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        title="Scan Serial Number / Barcode"
        description="Point camera at tool serial number or barcode tag."
      />
    </div>
  );
};
