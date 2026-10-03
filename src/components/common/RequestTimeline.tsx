import React from 'react';
import { MaterialRequest } from '../../types';
import { CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight, ShieldCheck, CreditCard, PackageCheck, Truck } from 'lucide-react';

interface RequestTimelineProps {
  request: MaterialRequest;
}

export const RequestTimeline: React.FC<RequestTimelineProps> = ({ request }) => {
  const isRejected = request.status === 'REJECTED';
  const isClarification = request.status === 'CLARIFICATION_REQUIRED';

  const approval = request.approvals?.find((a) => a.action === 'APPROVED');
  const rejection = request.approvals?.find((a) => a.action === 'REJECTED');
  const clarification = request.approvals?.find((a) => a.action === 'CLARIFICATION_REQUESTED');
  const payment = request.payment;
  const issue = request.issues && request.issues.length > 0 ? request.issues[0] : null;

  const steps = [
    {
      id: 'created',
      title: 'Created & Submitted',
      completed: true,
      user: request.requesterName,
      timestamp: request.createdAt,
      icon: CheckCircle2,
      color: 'text-blue-600'
    },
    {
      id: 'review',
      title: isRejected ? 'Rejected' : isClarification ? 'Clarification Requested' : 'Reviewed & Approved',
      completed: !!approval || isRejected || isClarification,
      failed: isRejected,
      warning: isClarification,
      user: approval?.approverName || rejection?.approverName || clarification?.approverName || (request.status !== 'SUBMITTED' ? 'Project Supervisor' : null),
      timestamp: approval?.createdAt || rejection?.createdAt || clarification?.createdAt,
      comment: rejection?.comment || clarification?.comment || approval?.comment,
      icon: isRejected ? XCircle : isClarification ? AlertTriangle : CheckCircle2,
      color: isRejected ? 'text-red-600' : isClarification ? 'text-amber-600' : 'text-emerald-600'
    },
    {
      id: 'payment',
      title: 'Payment & Authorization',
      completed: ['READY_FOR_ISSUE', 'PARTIALLY_ISSUED', 'ISSUED', 'RECEIVED', 'IN_USE', 'RETURNED', 'COMPLETED'].includes(request.status) || !!payment,
      user: payment?.accountantName || (['READY_FOR_ISSUE', 'ISSUED', 'RECEIVED', 'IN_USE'].includes(request.status) ? 'Finance Team' : null),
      timestamp: payment?.paymentDate,
      comment: payment ? `Ref: ${payment.paymentReference} (${payment.paymentMethod}) - KES ${payment.amount.toLocaleString()}` : null,
      icon: CreditCard,
      color: 'text-teal-600'
    },
    {
      id: 'issue',
      title: request.status === 'PARTIALLY_ISSUED' ? 'Partially Issued' : 'Store Issuance',
      completed: ['PARTIALLY_ISSUED', 'ISSUED', 'RECEIVED', 'IN_USE', 'RETURNED', 'COMPLETED'].includes(request.status),
      user: issue?.storeOfficerName,
      timestamp: issue?.issuedAt,
      comment: issue ? `Issued to ${issue.recipientName} with verified gate pass` : null,
      icon: PackageCheck,
      color: 'text-sky-600'
    },
    {
      id: 'receipt',
      title: 'Team Receipt & In Use',
      completed: ['RECEIVED', 'IN_USE', 'RETURNED', 'COMPLETED'].includes(request.status),
      user: issue?.receivedAt ? issue.recipientName : null,
      timestamp: issue?.receivedAt,
      comment: ['RECEIVED', 'IN_USE', 'RETURNED', 'COMPLETED'].includes(request.status) ? 'Physical custody confirmed on field site' : null,
      icon: Truck,
      color: 'text-indigo-600'
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#0B2545]" />
          <h3 className="font-semibold text-slate-800 text-sm sm:text-base">
            Digital Chain of Custody & Workflow
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          {request.requestNumber}
        </span>
      </div>

      {/* Responsive timeline */}
      <div className="relative">
        <div className="hidden sm:block absolute top-5 left-6 right-6 h-0.5 bg-slate-200 -z-0" />

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = !step.completed && (idx === 0 || steps[idx - 1].completed);

            return (
              <div key={step.id} className="flex sm:flex-col items-start sm:items-center relative z-10 gap-3 sm:gap-1 text-left sm:text-center">
                {/* Status Dot / Icon */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 shrink-0 ${
                    step.failed
                      ? 'bg-red-50 border-red-500 text-red-600'
                      : step.warning
                      ? 'bg-amber-50 border-amber-500 text-amber-600'
                      : step.completed
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-600 shadow-sm'
                      : isCurrent
                      ? 'bg-blue-50 border-blue-600 text-blue-600 animate-pulse'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-semibold ${
                      step.failed
                        ? 'text-red-700'
                        : step.completed
                        ? 'text-slate-900'
                        : isCurrent
                        ? 'text-blue-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.title}
                  </p>

                  {step.user && (
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">
                      {step.user}
                    </p>
                  )}

                  {step.timestamp && (
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {new Date(step.timestamp).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}

                  {step.comment && (
                    <p className="text-[11px] text-slate-600 italic mt-1 line-clamp-2 bg-slate-50 p-1 rounded border border-slate-100 sm:max-w-[180px]">
                      "{step.comment}"
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
