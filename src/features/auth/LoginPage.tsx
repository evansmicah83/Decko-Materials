import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { Eye, EyeOff, Lock, User as UserIcon, ShieldCheck, AlertCircle, ArrowRight, CheckCircle2, Phone, Briefcase, Users, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DeckoLogo } from '../../components/common/DeckoLogo';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { Team } from '../../types';

export const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'access'>('signin');

  // Sign In Form States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register Form States
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regEmployeeId, setRegEmployeeId] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState('FIELD_TEAM_LEADER');
  const [regDepartment, setRegDepartment] = useState('Field Operations');
  const [regTeamId, setRegTeamId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Available Teams for Field Team Leader assignment
  const [teams, setTeams] = useState<Team[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Update default department whenever role changes
  const handleRoleChange = (newRole: string) => {
    setRegRole(newRole);
    if (newRole === 'FIELD_TEAM_LEADER') {
      setRegDepartment('Field Operations');
    } else if (newRole === 'HR') {
      setRegDepartment('Human Resources & Administration');
    } else if (newRole === 'PROJECT_MANAGER' || newRole === 'DISPATCHER') {
      setRegDepartment('Operations & Dispatch');
    } else if (newRole === 'ACCOUNTANT') {
      setRegDepartment('Finance & Accounting');
    } else if (newRole === 'STORE_OFFICER') {
      setRegDepartment('Warehousing & Logistics');
    } else if (newRole === 'AUDITOR') {
      setRegDepartment('Quality & Compliance');
    } else if (newRole === 'PROCUREMENT_OFFICER') {
      setRegDepartment('Procurement & Supply Chain');
    } else if (newRole === 'ADMIN') {
      setRegDepartment('Executive Administration');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter both your Employee ID / Email and your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await login(identifier.trim(), password, rememberMe);
    } catch (err: any) {
      setErrorMessage(null);
      await Swal.fire({
        icon: 'error',
        title: 'Sign-in failed',
        text: err.message || 'Invalid employee ID/email or password.',
        confirmButtonText: 'Try again',
        confirmButtonColor: '#04446F'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regEmail.trim() || !regEmployeeId.trim() || !regPassword) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (regPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await register({
        fullName: regFullName.trim(),
        email: regEmail.trim(),
        employeeId: regEmployeeId.trim(),
        phoneNumber: regPhone.trim(),
        role: regRole,
        department: regDepartment,
        teamId: regRole === 'FIELD_TEAM_LEADER' ? regTeamId : undefined,
        password: regPassword,
        confirmPassword: regConfirmPassword
      });
      // AuthContext will automatically update user session and redirect
    } catch (err: any) {
      setErrorMessage(err.message || 'Account registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#042844] to-[#011B30] flex flex-col justify-between p-4 sm:p-6 md:p-8 text-slate-100 font-sans selection:bg-[#FAB417] selection:text-slate-950">
      {/* Top Bar / Brand Header */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-[#FAB417]" />
          <span className="hidden sm:inline">Decko Africa Telecommunications Infrastructure</span>
          <span className="sm:hidden">Decko Africa</span>
        </div>
        <div className="text-[11px] font-mono bg-white/10 px-2.5 py-1 rounded-full text-slate-300 border border-white/10">
          Production System
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-lg mx-auto my-auto py-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 text-slate-900">
          {/* Official Decko Header */}
          <div className="bg-[#04446F] p-6 sm:p-7 text-center text-white relative">
            <div className="flex justify-center mb-4">
              <DeckoLogo variant="white" size="lg" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Decko Materials
            </h1>
            <p className="text-xs sm:text-sm text-sky-200/90 mt-1 font-medium">
              Field Materials Management System
            </p>
          </div>

          <div className="flex border-b border-slate-200 bg-slate-50" role="tablist" aria-label="Sign-in options">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'signin'}
              onClick={() => { setAuthMode('signin'); setErrorMessage(null); }}
              className={`flex-1 py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                authMode === 'signin' ? 'border-[#04446F] text-[#04446F] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'access'}
              onClick={() => { setAuthMode('access'); setErrorMessage(null); }}
              className={`flex-1 py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                authMode === 'access' ? 'border-[#04446F] text-[#04446F] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              Account Access
            </button>
          </div>

          {/* Form Area */}
          <div className="p-6 sm:p-8">
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{successMessage}</span>
              </div>
            )}

            {authMode === 'access' ? (
              <div role="tabpanel" className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Access for Decko Africa staff</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Sign-in accounts are created by an authorized manager. There is no public self-registration.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-800">HR, Project Managers, and Admins</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Ask an existing manager to provision your staff account with the appropriate role. Sign in here with the employee ID or work email and temporary password they provide. The role assigned to your account determines your access.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-800">Field Team Leaders and Technicians</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Your account must be created by HR, a Project Manager, or an Admin and assigned to a field team. Technicians use their own credentials and can access only their assigned team.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className="w-full min-h-[46px] rounded-xl bg-[#04446F] px-4 py-3 text-sm font-bold text-white hover:bg-[#08558A] transition"
                >
                  Continue to Sign In
                </button>
              </div>
            ) : authMode === 'signin' ? (
              /* ================= SIGN IN FORM ================= */
              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Employee ID or Work Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Employee ID or Work Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. DA-001 or admin@deckoafrica.com"
                      autoComplete="username"
                      disabled={isLoading}
                      className="w-full pl-10 pr-3.5 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] focus:border-transparent text-slate-900 transition min-h-[48px]"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-[#04446F] hover:text-[#08558A] font-semibold transition cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter account password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] focus:border-transparent text-slate-900 transition min-h-[48px]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded-sm border-slate-300 text-[#04446F] focus:ring-[#04446F]"
                    />
                    <span className="text-xs text-slate-600 font-medium">Remember my credentials</span>
                  </label>
                </div>

                {/* Sign In Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-[48px] py-3.5 px-4 bg-[#04446F] hover:bg-[#08558A] active:bg-[#012D4C] disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-md shadow-[#04446F]/20 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to System</span>
                        <ArrowRight className="w-4 h-4 text-[#FAB417]" />
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 text-center text-xs text-slate-600">
                  Accounts are created by HR or a Project Manager. Field technicians sign in with their own supervisor-provisioned account and can only access their assigned team.
                </div>
              </form>
            ) : (
              /* ================= CREATE ACCOUNT FORM ================= */
              <form onSubmit={handleRegister} className="space-y-3.5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Samuel Mutiso"
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] text-slate-900"
                    required
                  />
                </div>

                {/* Two column: Employee ID & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Employee ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={regEmployeeId}
                      onChange={(e) => setRegEmployeeId(e.target.value)}
                      placeholder="e.g. DA-210"
                      disabled={isLoading}
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+254 712 345 678"
                      disabled={isLoading}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] text-slate-900"
                    />
                  </div>
                </div>

                {/* Work Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="user@deckoafrica.com"
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] text-slate-900"
                    required
                  />
                </div>

                {/* Operational Role Selector - Emphasizing Field Team Leader */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Operational Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 text-sm font-medium bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] text-slate-900 cursor-pointer"
                  >
                    <option value="FIELD_TEAM_LEADER">Field Team Leader (Field Requisitions & Stock Custody)</option>
                    <option value="PROJECT_MANAGER">Project Manager (Universal Access & Approvals)</option>
                    <option value="HR">HR Manager (Universal Access & Team Roster Management)</option>
                    <option value="DISPATCHER">Dispatcher (Field Dispatch & Review)</option>
                    <option value="ACCOUNTANT">Accountant (Payment & Financial Release)</option>
                    <option value="STORE_OFFICER">Store Officer (Material Verification & Scanning)</option>
                    <option value="AUDITOR">Auditor (Compliance & Audit Trail)</option>
                    <option value="PROCUREMENT_OFFICER">Procurement Officer (Supply Orders)</option>
                    <option value="ADMIN">Administrator (Universal System Access)</option>
                  </select>
                </div>

                <div className="p-2.5 bg-slate-100/80 rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-normal">
                  <span className="font-bold text-slate-800">Field Personnel Policy:</span> Field technicians can sign in with individual accounts created by an authorized manager and are limited to their assigned team's information.
                </div>

                {/* Field Team Leader Specific Configuration */}
                {regRole === 'FIELD_TEAM_LEADER' && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <Users className="w-4 h-4 text-emerald-700" />
                      <span>Field Team Leader Assignment</span>
                    </div>
                    <p className="text-emerald-800 text-[11px] leading-relaxed">
                      As a <strong>Field Team Leader</strong>, you will manage material requisitions, virtual team stock custody, and on-site material consumption for your installation crew.
                    </p>

                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                        Select Assigned Field Team:
                      </label>
                      <select
                        value={regTeamId}
                        onChange={(e) => setRegTeamId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.teamCode} — {t.name} ({t.assignedArea || 'Area not specified'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Passwords */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        disabled={isLoading}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] text-slate-900"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      disabled={isLoading}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#04446F] text-slate-900"
                      required
                    />
                  </div>
                </div>

                {/* Submit Register Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full min-h-[48px] py-3 px-4 bg-[#04446F] hover:bg-[#08558A] active:bg-[#012D4C] disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-md shadow-[#04446F]/20 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 text-[#FAB417]" />
                        <span>Register & Sign In</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center text-xs text-slate-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setErrorMessage(null);
                    }}
                    className="font-bold text-[#04446F] hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}

            {/* Security Warning Notice */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                Authorized Personnel Only
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Official Decko Africa Ltd. Telecommunications Network System
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <footer className="w-full max-w-md mx-auto text-center py-2 text-[11px] text-slate-400">
        <div>© 2026 Decko Africa Ltd. All rights reserved.</div>
      </footer>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onSuccess={() => {
          setShowForgotModal(false);
          setSuccessMessage('Password reset instructions processed. You may now sign in.');
        }}
      />
    </div>
  );
};
