import React from 'react';
import { RequestStatus } from '../../types';

interface StatusBadgeProps {
  status: RequestStatus | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm font-semibold'
  };

  const getStatusConfig = (st: string) => {
    switch (st) {
      case 'DRAFT':
        return { label: 'Draft', bg: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' };
      case 'SUBMITTED':
        return { label: 'Submitted', bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
      case 'UNDER_REVIEW':
        return { label: 'Under Review', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' };
      case 'CLARIFICATION_REQUIRED':
        return { label: 'Clarification Needed', bg: 'bg-amber-50 text-amber-800 border-amber-300', dot: 'bg-amber-500' };
      case 'REJECTED':
        return { label: 'Rejected', bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
      case 'APPROVED':
        return { label: 'Approved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' };
      case 'PAYMENT_PENDING':
        return { label: 'Payment Pending', bg: 'bg-orange-50 text-orange-800 border-orange-300', dot: 'bg-orange-500' };
      case 'PAYMENT_PROCESSING':
        return { label: 'Processing Payment', bg: 'bg-orange-100 text-orange-900 border-orange-300', dot: 'bg-orange-600' };
      case 'PAID':
        return { label: 'Paid & Authorized', bg: 'bg-teal-50 text-teal-700 border-teal-300', dot: 'bg-teal-500' };
      case 'READY_FOR_ISSUE':
        return { label: 'Ready for Issue', bg: 'bg-cyan-50 text-cyan-800 border-cyan-300 font-semibold', dot: 'bg-cyan-600' };
      case 'PARTIALLY_ISSUED':
        return { label: 'Partially Issued', bg: 'bg-yellow-50 text-yellow-800 border-yellow-300', dot: 'bg-yellow-500' };
      case 'ISSUED':
        return { label: 'Issued from Store', bg: 'bg-sky-50 text-sky-800 border-sky-300', dot: 'bg-sky-600' };
      case 'RECEIVED':
        return { label: 'Received by Team', bg: 'bg-green-50 text-green-800 border-green-300', dot: 'bg-green-600' };
      case 'IN_USE':
        return { label: 'In Field Use', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' };
      case 'RETURN_PENDING':
        return { label: 'Return Pending', bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' };
      case 'RETURNED':
        return { label: 'Returned to Store', bg: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-600' };
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-slate-100 text-slate-800 border-slate-300', dot: 'bg-slate-600' };
      default:
        return { label: st.replace(/_/g, ' '), bg: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded border ${config.bg} ${sizeClasses[size]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};
