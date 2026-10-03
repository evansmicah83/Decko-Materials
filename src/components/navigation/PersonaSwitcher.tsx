import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, ChevronDown, LogOut, ShieldCheck, Mail, Hash, Briefcase, Users } from 'lucide-react';

export const PersonaSwitcher: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const roleLabels: Record<string, string> = {
    FIELD_TEAM_LEADER: 'Field Team Leader',
    FIELD_TECHNICIAN: 'Field Technician',
    DISPATCHER: 'Dispatcher',
    PROJECT_MANAGER: 'Project Manager',
    ACCOUNTANT: 'Accountant',
    STORE_OFFICER: 'Store Officer',
    PROCUREMENT_OFFICER: 'Procurement Officer',
    AUDITOR: 'Auditor',
    ADMIN: 'Administrator',
    SUPER_ADMIN: 'Super Admin'
  };

  const formattedRole = roleLabels[user.role] || user.role.replace(/_/g, ' ');

  const initials = user.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DA';

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg text-xs border border-slate-700 transition cursor-pointer select-none"
      >
        <div className="w-6 h-6 rounded-full bg-[#FAB417] text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <div className="font-semibold text-white truncate max-w-[140px] leading-tight">
            {user.fullName}
          </div>
          <div className="text-[10px] text-amber-300 font-medium leading-tight">
            {formattedRole}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 text-slate-800">
            {/* User Profile Header */}
            <div className="p-4 bg-gradient-to-r from-[#04446F] to-[#08558A] text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FAB417] text-slate-950 font-black text-sm flex items-center justify-center shadow-md">
                  {initials}
                </div>
                <div className="overflow-hidden">
                  <h4 className="font-bold text-sm truncate">{user.fullName}</h4>
                  <div className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-sky-100 border border-white/20">
                    {formattedRole}
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Meta Details */}
            <div className="p-3 text-xs space-y-2 bg-slate-50/50">
              <div className="flex items-center gap-2 text-slate-600">
                <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono text-slate-900 font-semibold">{user.employeeId}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              {user.department && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{user.department}</span>
                </div>
              )}
              {user.team && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">{user.team.name} ({user.team.teamCode})</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Session</span>
                </div>
                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                  Secure Exit
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
