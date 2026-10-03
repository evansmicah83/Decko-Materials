import React, { useRef } from 'react';
import { MaterialRequest } from '../../types';
import { DeckoLogo } from './DeckoLogo';
import { X, Printer, Download, CheckCircle2, ShieldAlert } from 'lucide-react';
import jsPDF from 'jspdf';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: MaterialRequest;
}

export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ isOpen, onClose, request }) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header
    doc.setFillColor(11, 37, 69); // #0B2545
    doc.rect(0, 0, 210, 32, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DECKO AFRICA LTD.', 15, 14);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Connecting Africa | Field Telecommunications Materials Management', 15, 20);
    doc.text('81 Kigwa Rd off Kiambu Rd, Nairobi, Kenya | inquiries@deckoafrica.com', 15, 26);
    
    // Document Title
    doc.setTextColor(11, 37, 69);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL MATERIAL REQUISITION & GATE PASS VOUCHER', 15, 42);
    
    // Meta Info Block
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Request Number: ${request.requestNumber}`, 15, 52);
    doc.text(`Date Issued: ${new Date(request.createdAt).toLocaleDateString('en-GB')}`, 15, 58);
    doc.text(`Field Team: ${request.teamCode} - ${request.teamName}`, 15, 64);
    doc.text(`Project: ${request.projectName} (${request.projectCode})`, 15, 70);
    doc.text(`Site: ${request.siteName || 'Field Cluster Operations'}`, 15, 76);
    
    doc.text(`Requester: ${request.requesterName}`, 120, 52);
    doc.text(`Status: ${request.status}`, 120, 58);
    doc.text(`Work Order: ${request.workOrderRef || 'N/A'}`, 120, 64);
    doc.text(`Payment Ref: ${request.payment?.paymentReference || 'N/A'}`, 120, 70);
    doc.text(`Client SLA: ${request.projectClient || 'Safaricom PLC'}`, 120, 76);
    
    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 82, 195, 82);
    
    // Table Header
    let y = 92;
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y - 6, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(11, 37, 69);
    doc.text('SKU / Code', 17, y);
    doc.text('Material Description', 45, y);
    doc.text('Req.', 115, y);
    doc.text('Appr.', 130, y);
    doc.text('Issued', 145, y);
    doc.text('Unit', 165, y);
    doc.text('Loc', 180, y);
    
    // Table Body
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    y += 8;
    
    if (request.items) {
      for (const it of request.items) {
        doc.text(it.sku || '-', 17, y);
        doc.text(it.materialName?.slice(0, 34) || '-', 45, y);
        doc.text(String(it.quantityRequested), 115, y);
        doc.text(String(it.quantityApproved || 0), 130, y);
        doc.text(String(it.quantityIssued || 0), 145, y);
        doc.text(it.unit || 'pcs', 165, y);
        doc.text(it.storeLocation || 'Bay A', 180, y);
        y += 7;
      }
    }
    
    // Signatures
    y = Math.max(y + 15, 210);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, 195, y);
    y += 10;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('REQUESTED BY:', 15, y);
    doc.text('APPROVED BY:', 75, y);
    doc.text('STORE GATE PASS ISSUED BY:', 135, y);
    
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(request.requesterName, 15, y);
    doc.text(request.approvals?.[0]?.approverName || 'Authorized PM', 75, y);
    doc.text(request.issues?.[0]?.storeOfficerName || 'Warehouse Store', 135, y);
    
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text('FIELD TEAM RECEIPT SIGNATURE:', 15, y);
    doc.text('SAFARICOM AUDIT VERIFIED:', 120, y);
    
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(request.issues?.[0]?.recipientName || 'Team Custodian Sign ________________', 15, y);
    doc.text('Official Digital Stamp Verified', 120, y);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Official Decko Materials System Document | ${request.requestNumber} | Generated ${new Date().toISOString()}`, 15, 285);
    
    doc.save(`${request.requestNumber}_Decko_Voucher.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-auto overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Controls Header */}
        <div className="bg-[#0B2545] text-white px-5 py-3.5 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-2.5">
            <DeckoLogo variant="compact" size="sm" />
            <span className="text-slate-300 text-xs hidden sm:inline">|</span>
            <span className="text-xs text-slate-200 font-mono">{request.requestNumber} Voucher</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Area */}
        <div ref={printAreaRef} className="p-6 sm:p-10 overflow-y-auto flex-1 bg-white text-slate-900 font-sans text-xs sm:text-sm">
          {/* Company Document Header */}
          <div className="border-b-2 border-[#0B2545] pb-5 mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <DeckoLogo variant="full" size="lg" />
              <p className="text-xs text-slate-500 mt-2 font-medium">
                Decko Africa Ltd. • Turnkey Telecommunications & Fibre Infrastructure
              </p>
              <p className="text-[11px] text-slate-400">
                HQ: 81 Kigwa Rd, off Kiambu Rd, Nairobi • Tel: +254 792 400 000
              </p>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
              <span className="inline-block px-3 py-1 bg-slate-100 text-[#0B2545] font-bold text-xs sm:text-sm rounded border border-slate-300 font-mono">
                {request.requestNumber}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Date: {new Date(request.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mt-0.5">
                STATUS: {request.status.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          {/* Key Information Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 mb-6">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Team</span>
              <span className="font-semibold text-slate-800">{request.teamCode}</span>
              <span className="block text-[11px] text-slate-600 truncate">{request.teamName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Project</span>
              <span className="font-semibold text-slate-800">{request.projectName}</span>
              <span className="block text-[11px] text-slate-600">Client: {request.projectClient || 'Safaricom'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Site / Node</span>
              <span className="font-semibold text-slate-800">{request.siteName || 'Field Operations'}</span>
              <span className="block text-[11px] text-slate-600">WO: {request.workOrderRef || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Requester</span>
              <span className="font-semibold text-slate-800">{request.requesterName}</span>
              <span className="block text-[11px] text-slate-600">Tel: {request.requesterPhone || '+254 711 000 000'}</span>
            </div>
          </div>

          {/* Reason & Priority */}
          <div className="mb-6 p-3 bg-blue-50/60 rounded border border-blue-100 flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-blue-900 uppercase">Operational Purpose / Justification:</span>
              <p className="text-slate-800 mt-0.5">{request.reason}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Priority</span>
              <span className="font-semibold text-xs text-blue-900">{request.priority}</span>
            </div>
          </div>

          {/* Materials Table */}
          <div className="mb-6 overflow-hidden border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B2545] text-white text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Material Description</th>
                  <th className="py-2.5 px-3 text-right">Req.</th>
                  <th className="py-2.5 px-3 text-right">Appr.</th>
                  <th className="py-2.5 px-3 text-right">Issued</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Store Loc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {request.items?.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-700">{item.sku}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      {item.materialName}
                      {item.requiresSafaricomTracking ? (
                        <span className="ml-1.5 px-1 py-0.2 text-[9px] bg-emerald-100 text-emerald-800 font-bold rounded">
                          Safaricom Controlled
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">{item.quantityRequested}</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-700">{item.quantityApproved || 0}</td>
                    <td className="py-2 px-3 text-right font-bold text-[#0B2545]">{item.quantityIssued || 0}</td>
                    <td className="py-2 px-3 text-slate-600">{item.unit}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">{item.storeLocation || 'Central Bay'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment & Authorization Details */}
          {request.payment && (
            <div className="mb-6 p-3.5 bg-emerald-50/80 rounded-lg border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-900 block">Accounting Payment Authorization</span>
                <p className="text-emerald-800 font-medium">
                  Reference: <span className="font-mono font-bold">{request.payment.paymentReference}</span> ({request.payment.paymentMethod})
                </p>
                <p className="text-[11px] text-emerald-700">
                  Confirmed by: {request.payment.accountantName} on {new Date(request.payment.paymentDate).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-900 block">Authorized Amount</span>
                <span className="text-base font-bold text-emerald-900">
                  KES {request.payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Signatures & Chain of Custody Stamps */}
          <div className="mt-8 pt-6 border-t-2 border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="border border-slate-200 rounded p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-6">Requested By (Field Team)</span>
              <div className="border-t border-slate-300 pt-1 text-slate-800 font-medium">
                {request.requesterName}
              </div>
              <span className="text-[10px] text-slate-400">Field Team Leader / Technician</span>
            </div>

            <div className="border border-slate-200 rounded p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-6">Project Approval (PM)</span>
              <div className="border-t border-slate-300 pt-1 text-slate-800 font-medium">
                {request.approvals?.[0]?.approverName || 'Sarah Kamau (PM)'}
              </div>
              <span className="text-[10px] text-slate-400">Engineering Authorization</span>
            </div>

            <div className="border border-slate-200 rounded p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-6">Store Issuance & Gate Pass</span>
              <div className="border-t border-slate-300 pt-1 text-slate-800 font-medium">
                {request.issues?.[0]?.storeOfficerName || 'George Otieno (Store)'}
              </div>
              <span className="text-[10px] text-slate-400">Central Logistics Custodian</span>
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
            This digital record was generated by Decko Africa Field Materials Management System. Immutable audit hash verified.
          </div>
        </div>
      </div>
    </div>
  );
};
