import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, FilePlus2, Boxes, PackageCheck, Camera, CreditCard } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenNewRequest: () => void;
  onOpenScanner: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenNewRequest,
  onOpenScanner
}) => {
  const { user } = useAuth();
  const isStore = user?.role === 'STORE_OFFICER';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const isField = ['FIELD_TECHNICIAN', 'FIELD_TEAM_LEADER'].includes(user?.role || '');

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-lg no-print">
      <div className="grid grid-cols-5 items-center">
        {/* Dashboard */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1.5 transition ${
            currentTab === 'dashboard' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Home</span>
        </button>

        {/* Requests */}
        <button
          onClick={() => onSelectTab('requests')}
          className={`flex flex-col items-center justify-center py-1.5 transition ${
            currentTab === 'requests' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Boxes className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Requests</span>
        </button>

        {/* Big Central Action Button */}
        <div className="flex justify-center -mt-4">
          {isStore ? (
            <button
              onClick={onOpenScanner}
              className="w-13 h-13 rounded-full bg-blue-600 text-white flex flex-col items-center justify-center shadow-lg border-2 border-white hover:bg-blue-700 active:scale-95 transition"
              title="Scan QR / Serial"
            >
              <Camera className="w-6 h-6" />
              <span className="text-[9px] font-bold">Scan</span>
            </button>
          ) : (
            <button
              onClick={onOpenNewRequest}
              className="w-13 h-13 rounded-full bg-[#0B2545] text-white flex flex-col items-center justify-center shadow-lg border-2 border-white hover:bg-slate-800 active:scale-95 transition"
              title="New Material Request"
            >
              <FilePlus2 className="w-6 h-6 text-amber-400" />
              <span className="text-[9px] font-bold">Request</span>
            </button>
          )}
        </div>

        {/* Role Specific Tab: Store or Accounting or Stock */}
        {isStore ? (
          <button
            onClick={() => onSelectTab('store')}
            className={`flex flex-col items-center justify-center py-1.5 transition ${
              currentTab === 'store' ? 'text-blue-600 font-bold' : 'text-slate-500'
            }`}
          >
            <PackageCheck className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Issuance</span>
          </button>
        ) : isAccountant ? (
          <button
            onClick={() => onSelectTab('accounting')}
            className={`flex flex-col items-center justify-center py-1.5 transition ${
              currentTab === 'accounting' ? 'text-blue-600 font-bold' : 'text-slate-500'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Payment</span>
          </button>
        ) : (
          <button
            onClick={() => onSelectTab('teams')}
            className={`flex flex-col items-center justify-center py-1.5 transition ${
              currentTab === 'teams' ? 'text-blue-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Boxes className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Team Stock</span>
          </button>
        )}

        {/* Scan Button on far right */}
        <button
          onClick={onOpenScanner}
          className="flex flex-col items-center justify-center py-1.5 text-slate-500 hover:text-blue-600 transition"
        >
          <Camera className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Scanner</span>
        </button>
      </div>
    </div>
  );
};
