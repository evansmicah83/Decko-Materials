import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { Team, TeamMember, Project } from '../../types';
import {
  Users,
  Boxes,
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight,
  RotateCcw,
  Wrench,
  UserPlus,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  Clock3,
  Hash,
  Mail,
  UserCheck,
  Pencil,
  X,
  Search
} from 'lucide-react';

export const TeamsView: React.FC = () => {
  const { user, register } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teamStock, setTeamStock] = useState<any[]>([]);
  const [teamTools, setTeamTools] = useState<any[]>([]);
  const [availableLeaders, setAvailableLeaders] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'stock' | 'tools'>('members');
  const [managementTab, setManagementTab] = useState<'teams' | 'staff'>('teams');
  const [teamType, setTeamType] = useState<'FTTH' | 'FTTB' | 'OTHER'>('FTTH');
  const [teamSearch, setTeamSearch] = useState('');

  // Modal States
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState('');
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAssignLeaderModal, setShowAssignLeaderModal] = useState(false);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [returnToTechnicianAfterTeamCreate, setReturnToTechnicianAfterTeamCreate] = useState(false);

  // New Team Form States
  const [newTeamCode, setNewTeamCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newRegionName, setNewRegionName] = useState('');
  const [newTeamType, setNewTeamType] = useState<'FTTH' | 'FTTB'>('FTTH');
  const [newAssignedArea, setNewAssignedArea] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newLeaderId, setNewLeaderId] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<'FTTH' | 'FTTB'>('FTTH');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [newProjectRegion, setNewProjectRegion] = useState('');
  const [newProjectBudget, setNewProjectBudget] = useState('');
  const [newProjectStatus, setNewProjectStatus] = useState('IN_PROGRESS');
  const [newProjectStartDate, setNewProjectStartDate] = useState('');
  const [newProjectEndDate, setNewProjectEndDate] = useState('');

  // New Member Form States
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Fibre Splicer');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberEmpId, setNewMemberEmpId] = useState('');
  const [newMemberNationalId, setNewMemberNationalId] = useState('');

  // Assign Leader Form State
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [accountFullName, setAccountFullName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountEmployeeId, setAccountEmployeeId] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountRole, setAccountRole] = useState('FIELD_TEAM_LEADER');
  const [accountTeamId, setAccountTeamId] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountProjectIds, setAccountProjectIds] = useState<string[]>([]);
  const [accountStep, setAccountStep] = useState<'details' | 'assignment' | 'security'>('details');

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if current user has managerial privileges (HR, PM, Admin)
  const isManager = ['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER'].includes(user?.role || '');

  useEffect(() => {
    loadTeams();
    if (isManager) {
      loadManagerData();
    }
  }, [user]);

  const loadManagerData = async () => {
    const [leadersResult, projectsResult] = await Promise.allSettled([
      api.getAvailableLeaders(),
      api.getProjects()
    ]);
    const errors: string[] = [];

    if (leadersResult.status === 'fulfilled') {
      if (leadersResult.value.success) setAvailableLeaders(leadersResult.value.leaders);
    } else {
      console.error('Failed to load available field team leaders:', leadersResult.reason);
      errors.push(leadersResult.reason instanceof Error ? leadersResult.reason.message : 'Unable to load team leaders.');
    }

    if (projectsResult.status === 'fulfilled') {
      if (projectsResult.value.success) setProjects(projectsResult.value.projects);
    } else {
      console.error('Failed to load client projects:', projectsResult.reason);
      errors.push(projectsResult.reason instanceof Error ? projectsResult.reason.message : 'Unable to load projects.');
    }

    if (errors.length) showFeedback('error', errors.join(' '));
  };

  const loadTeams = async () => {
    setLoading(true);
    try {
      const res = await api.getTeams();
      if (res.success && res.teams.length > 0) {
        setTeams(res.teams);
        const defaultTeamId = res.teams.some((team) => team.id === selectedTeamId)
          ? selectedTeamId
          : user?.teamId && res.teams.some((team) => team.id === user.teamId)
            ? user.teamId
            : res.teams[0].id;
        setSelectedTeamId(defaultTeamId);
        const defaultTeam = res.teams.find((team) => team.id === defaultTeamId);
        if (defaultTeam) setTeamType(getTeamType(defaultTeam));
        loadTeamStock(defaultTeamId);
      } else if (res.success) {
        setTeams([]);
        setSelectedTeamId('');
        setTeamStock([]);
        setTeamTools([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamStock = async (teamId: string) => {
    try {
      const res = await api.getTeamStock(teamId);
      if (res.success) {
        setTeamStock(res.stocks);
        setTeamTools(res.tools);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    loadTeamStock(teamId);
  };

  const handleSelectTeamType = (type: 'FTTH' | 'FTTB' | 'OTHER') => {
    setTeamType(type);
    const firstTeam = teams.find((team) => getTeamType(team) === type);
    if (firstTeam) handleSelectTeam(firstTeam.id);
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // Create New Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!isEditingTeam && !newTeamCode.trim()) || !newTeamName.trim()) {
      showFeedback('error', 'Team code and team name are required.');
      return;
    }
    if (!newProjectId || !newRegionName.trim() || !newAssignedArea.trim()) {
      showFeedback('error', 'Select an active project and enter the county/region and assigned area.');
      return;
    }
    if (!isEditingTeam && !newTeamCode.trim().toUpperCase().replace(/^(FTTH|FTTB)-/, '')) {
      showFeedback('error', 'Enter a team number after the FTTH/FTTB prefix.');
      return;
    }

    setIsSubmitting(true);
    try {
      let result: { success: boolean; message: string };
      let createdTeamId: string | undefined;
      let createdTeamCode: string | undefined;
      if (isEditingTeam) {
        result = await api.updateTeam(selectedTeamId, {
            name: newTeamName.trim(),
            projectId: newProjectId,
            regionName: newRegionName.trim(),
            assignedArea: newAssignedArea.trim(),
            contactInfo: newContactPhone.trim()
          });
      } else {
        const codeSuffix = newTeamCode.trim().toUpperCase().replace(/^(FTTH|FTTB)-/, '');
        const teamCode = `${newTeamType}-${codeSuffix}`;
        createdTeamCode = teamCode;
        const created = await api.createTeam({
            teamCode,
            name: newTeamName.trim(),
            projectId: newProjectId,
            regionName: newRegionName.trim(),
            assignedArea: newAssignedArea.trim(),
            contactInfo: newContactPhone.trim(),
            leaderId: newLeaderId || null
          });
        result = created;
        createdTeamId = created.team.id;
      }

      if (result.success) {
        const returnToTechnician = returnToTechnicianAfterTeamCreate;
        showFeedback('success', isEditingTeam ? 'Team details updated.' : `Field Team ${createdTeamCode} created successfully.`);
        setShowAddTeamModal(false);
        setIsEditingTeam(false);
        setNewTeamCode('');
        setNewTeamName('');
        setNewAssignedArea('');
        setNewContactPhone('');
        setNewLeaderId('');
        await loadTeams();
        if (createdTeamId) {
          setSelectedTeamId(createdTeamId);
          if (returnToTechnician) {
            setReturnToTechnicianAfterTeamCreate(false);
            setAccountRole('FIELD_TECHNICIAN');
            setAccountTeamId(createdTeamId);
            setAccountProjectIds(newProjectId ? [newProjectId] : []);
            setAccountStep('assignment');
            setShowCreateAccountModal(true);
          } else if (!newLeaderId) {
            setAccountRole('FIELD_TEAM_LEADER');
            setAccountTeamId(createdTeamId);
            setAccountProjectIds(newProjectId ? [newProjectId] : []);
            setAccountStep('details');
            setShowCreateAccountModal(true);
          }
        }
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to create team.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const projectInput = {
        projectCode: newProjectCode.trim(),
        name: newProjectName.trim(),
        networkType: newProjectType,
        client: newProjectClient.trim(),
        regionName: newProjectRegion.trim(),
        budget: newProjectBudget ? Number(newProjectBudget) : 0,
        status: newProjectStatus,
        contractStartDate: newProjectStartDate,
        contractEndDate: newProjectEndDate
      };

      const result = isEditingProject
        ? await api.updateProject(editingProjectId, projectInput)
        : await api.createProject(projectInput);
      setProjects((current) => {
        const withoutUpdated = current.filter((project) => project.id !== result.project.id);
        return [...withoutUpdated, result.project].sort((a, b) => a.name.localeCompare(b.name));
      });
      if (!isEditingProject) {
        setNewProjectId(result.project.id);
        setNewTeamType(result.project.networkType);
        setTeamType(result.project.networkType);
      }
      setShowCreateProjectModal(false);
      setIsEditingProject(false);
      setEditingProjectId('');
      setNewProjectCode('');
      setNewProjectName('');
      setNewProjectClient('');
      setNewProjectRegion('');
      setNewProjectBudget('');
      setNewProjectStatus('IN_PROGRESS');
      showFeedback('success', isEditingProject
        ? `Project ${result.project.projectCode} updated.`
        : `Project ${result.project.projectCode} created. It is selected for the new team.`);
    } catch (error) {
      showFeedback('error', error instanceof Error ? error.message : 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Delete project ${project.projectCode}? Projects with teams, staff assignments, or material request history cannot be deleted. To retain project history, edit its status to Completed instead.`)) return;
    setDeletingProjectId(project.id);
    try {
      await api.deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setAccountProjectIds((current) => current.filter((id) => id !== project.id));
      setNewProjectId((current) => current === project.id ? '' : current);
      showFeedback('success', `Project ${project.projectCode} deleted.`);
    } catch (error) {
      showFeedback('error', error instanceof Error ? error.message : 'Failed to delete project.');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const openEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setIsEditingProject(true);
    setNewProjectCode(project.projectCode);
    setNewProjectName(project.name);
    setNewProjectType(project.networkType);
    setNewProjectClient(project.client);
    setNewProjectRegion(project.regionName || '');
    setNewProjectBudget(String(project.budget || 0));
    setNewProjectStatus(project.status);
    setNewProjectStartDate(project.contractStartDate || '');
    setNewProjectEndDate(project.contractEndDate || '');
    setShowCreateProjectModal(true);
  };

  const openCreateProject = (type: 'FTTH' | 'FTTB') => {
    setIsEditingProject(false);
    setEditingProjectId('');
    setNewProjectCode('');
    setNewProjectName('');
    setNewProjectType(type);
    setNewProjectClient('');
    setNewProjectRegion('');
    setNewProjectBudget('');
    setNewProjectStatus('IN_PROGRESS');
    setNewProjectStartDate('');
    setNewProjectEndDate('');
    setShowCreateProjectModal(true);
  };

  const hasCurrentContract = (project: Project) => {
    const today = new Date().toISOString().slice(0, 10);
    return ['IN_PROGRESS', 'ACTIVE'].includes(project.status) &&
      Boolean(project.contractStartDate && project.contractEndDate &&
        project.contractStartDate <= today && project.contractEndDate >= today);
  };
  const activeContractProjects = projects.filter(hasCurrentContract);

  const openCreateTeamForTechnician = (project: Project) => {
    setReturnToTechnicianAfterTeamCreate(true);
    setShowCreateAccountModal(false);
    setIsEditingTeam(false);
    setNewTeamCode('');
    const networkType = project.networkType;
    const nextNumber = teamTypeCounts[networkType] + 1;
    setNewTeamName(`Team ${nextNumber}`);
    setNewTeamType(networkType);
    setNewProjectId(project.id);
    setNewRegionName(project.regionName || '');
    setNewAssignedArea('');
    setNewContactPhone('');
    setNewLeaderId('');
    setShowAddTeamModal(true);
  };

  const cancelTeamCreation = () => {
    setShowAddTeamModal(false);
    setIsEditingTeam(false);
    if (returnToTechnicianAfterTeamCreate) {
      setReturnToTechnicianAfterTeamCreate(false);
      setAccountStep('assignment');
      setShowCreateAccountModal(true);
    }
  };

  const handleEditTeam = () => {
    if (!selectedTeam) return;
    setNewTeamCode(selectedTeam.teamCode);
    setNewTeamName(selectedTeam.name);
    setNewProjectId(selectedTeam.projectId || '');
    setNewRegionName(selectedTeam.regionName || '');
    setNewTeamType(getTeamType(selectedTeam) === 'FTTB' ? 'FTTB' : 'FTTH');
    setNewAssignedArea(selectedTeam.assignedArea || '');
    setNewContactPhone(selectedTeam.contactInfo || '');
    setIsEditingTeam(true);
    setShowAddTeamModal(true);
  };

  const handleArchiveTeam = async () => {
    if (!selectedTeam) return;
    const action = selectedTeam.status === 'ACTIVE' ? 'archive' : 'restore';
    if (!confirm(`Are you sure you want to ${action} ${selectedTeam.teamCode}? ${action === 'archive' ? 'Its history and records will be kept.' : ''}`)) return;
    try {
      await api.updateTeam(selectedTeam.id, { status: action === 'archive' ? 'INACTIVE' : 'ACTIVE' });
      showFeedback('success', `Team ${selectedTeam.teamCode} ${action}d.`);
      await loadTeams();
    } catch (err: any) {
      showFeedback('error', err.message || `Failed to ${action} team.`);
    }
  };

  // Add Teammate / Crew Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      showFeedback('error', 'Teammate full name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.addTeamMember(selectedTeamId, {
        fullName: newMemberName.trim(),
        roleTitle: newMemberRole.trim(),
        phoneNumber: newMemberPhone.trim(),
        employeeId: newMemberEmpId.trim() || undefined,
        nationalId: newMemberNationalId.trim() || undefined
      });

      if (res.success) {
        showFeedback('success', `Teammate ${newMemberName} added to crew roster.`);
        setShowAddMemberModal(false);
        setNewMemberName('');
        setNewMemberPhone('');
        setNewMemberEmpId('');
        setNewMemberNationalId('');
        await loadTeams();
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to add teammate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTechnicianLogin = (member: TeamMember) => {
    setAccountFullName(member.fullName);
    setAccountEmail('');
    setAccountEmployeeId(member.employeeId || '');
    setAccountPhone(member.phoneNumber || '');
    setAccountRole('FIELD_TECHNICIAN');
    setAccountTeamId(selectedTeamId);
    const teamProjectId = teams.find((team) => team.id === selectedTeamId)?.projectId;
    setAccountProjectIds(teamProjectId ? [teamProjectId] : []);
    setAccountStep('details');
    setAccountPassword('');
    setNewMemberRole(member.roleTitle || 'Field Technician');
    setShowCreateAccountModal(true);
  };

  // Delete Teammate
  const handleDeleteMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this team roster?`)) return;

    try {
      const res = await api.deleteTeamMember(selectedTeamId, memberId);
      if (res.success) {
        showFeedback('success', `${memberName} removed from crew.`);
        await loadTeams();
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to remove teammate.');
    }
  };

  // Assign Team Leader
  const handleAssignLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaderId) return;

    setIsSubmitting(true);
    try {
      const res = await api.updateTeam(selectedTeamId, { leaderId: selectedLeaderId });
      if (res.success) {
        showFeedback('success', 'Field Team Leader assigned successfully.');
        setShowAssignLeaderModal(false);
        await loadTeams();
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to assign team leader.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (['FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(accountRole) && (!accountTeamId || accountProjectIds.length !== 1)) {
      showFeedback('error', 'Select a serving project and one of its field teams before creating this account.');
      setAccountStep('assignment');
      return;
    }
    if (!['ADMIN', 'HR', 'PROJECT_MANAGER'].includes(accountRole) && accountProjectIds.length === 0) {
      showFeedback('error', 'Assign this employee to at least one active client project.');
      setAccountStep('assignment');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({
        fullName: accountFullName.trim(),
        email: accountEmail.trim(),
        employeeId: accountEmployeeId.trim(),
        phoneNumber: accountPhone.trim(),
        role: accountRole,
        teamId: ['FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(accountRole) ? accountTeamId || undefined : undefined,
        projectIds: accountProjectIds,
        roleTitle: accountRole === 'FIELD_TECHNICIAN' ? newMemberRole : undefined,
        password: accountPassword
      });
      showFeedback('success', `Account created for ${accountFullName.trim()}.`);
      setShowCreateAccountModal(false);
      setAccountFullName('');
      setAccountEmail('');
      setAccountEmployeeId('');
      setAccountPhone('');
      setAccountRole('FIELD_TEAM_LEADER');
      setAccountTeamId('');
      setAccountProjectIds([]);
      setAccountPassword('');
      setNewMemberRole('Field Technician');
      setAccountStep('details');
      await Promise.all([loadTeams(), loadManagerData()]);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to create employee account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const currentMembers = selectedTeam?.members || [];
  const getTeamType = (team: Team): 'FTTH' | 'FTTB' | 'OTHER' => {
    const teamCode = team.teamCode.toUpperCase();
    if (teamCode.startsWith('FTTH-')) return 'FTTH';
    if (teamCode.startsWith('FTTB-')) return 'FTTB';
    const typeText = team.projectName?.toUpperCase() || '';
    if (typeText.includes('FTTH')) return 'FTTH';
    if (typeText.includes('FTTB')) return 'FTTB';
    return 'OTHER';
  };
  const typeTeams = teams.filter((team) => getTeamType(team) === teamType);
  const visibleTeams = typeTeams.filter((team) => {
    const search = teamSearch.trim().toLowerCase();
    if (!search) return true;
    return [
      team.teamCode,
      team.name,
      team.projectName,
      team.assignedArea,
      team.leaderName,
      ...(team.members || []).map((member) => member.fullName)
    ].some((value) => value?.toLowerCase().includes(search));
  });
  const activeTeams = teams.filter((team) => team.status === 'ACTIVE');
  const teamTypeCounts = {
    FTTH: teams.filter((team) => getTeamType(team) === 'FTTH').length,
    FTTB: teams.filter((team) => getTeamType(team) === 'FTTB').length,
    OTHER: teams.filter((team) => getTeamType(team) === 'OTHER').length
  };
  const hasActiveProject = activeContractProjects.length > 0;
  return (
    <div className="space-y-6">
      {/* Header & Manager Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#04446F]" />
            <span>Field Teams, Leaders & Crew Roster</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Field Team Leaders, assigned installation crew members, and virtual materials stock custody
          </p>
        </div>

      </div>

      {isManager && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5" role="tablist" aria-label="Manage field teams and staff">
          <button
            type="button"
            role="tab"
            aria-selected={managementTab === 'teams'}
            onClick={() => setManagementTab('teams')}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${managementTab === 'teams' ? 'bg-[#04446F] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Users className="h-4 w-4" />
            Field Teams
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={managementTab === 'staff'}
            onClick={() => setManagementTab('staff')}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${managementTab === 'staff' ? 'bg-[#04446F] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <UserPlus className="h-4 w-4" />
            Staff & Technicians
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`fixed right-4 top-4 z-[100] flex max-w-lg items-center gap-2.5 rounded-xl border p-3.5 text-xs font-semibold shadow-lg animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {isManager && managementTab === 'teams' && (
        <section className="space-y-3" aria-label="Client project contracts">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <Building2 className="h-4 w-4 text-[#04446F]" />
                Client Projects & Contracts
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Track every client contract, assigned teams, workforce, and expiry date.</p>
            </div>
            <button
              type="button"
              onClick={() => openCreateProject(teamType === 'FTTB' ? 'FTTB' : 'FTTH')}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#04446F] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#08558A]"
            >
              <PlusCircle className="h-4 w-4 text-[#FAB417]" />
              New client project
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No projects yet. Add a client contract with its dates to begin assigning teams and staff.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {projects.map((project) => {
                const expired = project.contractHealth === 'EXPIRED';
                const expiring = project.contractHealth === 'EXPIRING_SOON';
                const notStarted = project.contractHealth === 'NOT_STARTED';
                const missingDates = project.contractHealth === 'MISSING_DATES';
                const tone = expired
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : expiring
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : notStarted
                      ? 'border-sky-200 bg-sky-50 text-sky-800'
                      : missingDates
                        ? 'border-slate-200 bg-slate-100 text-slate-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800';
                return (
                  <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#04446F]">{project.projectCode}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{project.networkType}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{project.status.replace('_', ' ')}</span>
                        </div>
                        <h4 className="mt-1 truncate font-bold text-slate-900">{project.name}</h4>
                        <p className="mt-0.5 text-xs text-slate-500">{project.client} · {project.regionName || 'Region not set'}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditProject(project)}
                          aria-label={`Edit ${project.projectCode}`}
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-[#04446F]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(project)}
                          disabled={deletingProjectId !== null}
                          aria-label={`Delete ${project.projectCode}`}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        <span>{project.contractStartDate || '—'} to {project.contractEndDate || 'No expiry recorded'}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${tone}`}>
                        <Clock3 className="h-3 w-3" />
                        {expired ? 'Contract expired' : expiring ? `Expires in ${Math.max(0, project.daysUntilExpiry ?? 0)} days` : notStarted ? 'Contract not started' : missingDates ? 'Contract dates required' : 'Contract active'}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-4 text-[11px] text-slate-500">
                      <span><strong className="text-slate-800">{project.teamCount || 0}</strong> teams</span>
                      <span><strong className="text-slate-800">{project.staffCount || 0}</strong> assigned staff</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {isManager && managementTab === 'staff' && (
        <section className="space-y-4" aria-label="Staff assignments">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Add staff to a field team</h3>
              <p className="mt-1 text-xs text-slate-500">
                Choose a team when creating a technician account. The technician reports to that team’s assigned leader. If no leader is assigned yet, the technician can still be added to the team and will appear under its leader once one is appointed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAccountRole('FIELD_TECHNICIAN');
                setAccountTeamId('');
                setAccountProjectIds([]);
                setAccountStep('details');
                setShowCreateAccountModal(true);
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#04446F] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#08558A]"
            >
              <UserPlus className="h-4 w-4" />
              Add Staff
            </button>
          </div>

          {activeTeams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 font-semibold text-slate-700">Create an active field team before assigning technicians.</p>
              <button type="button" onClick={() => setManagementTab('teams')} className="mt-3 rounded-lg bg-[#04446F] px-4 py-2 text-xs font-bold text-white hover:bg-[#08558A]">
                Go to Field Teams
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activeTeams.map((team) => (
                <article key={team.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-black text-[#04446F]">{team.teamCode}</p>
                      <h4 className="mt-0.5 font-bold text-slate-900">{team.name}</h4>
                      <p className="mt-1 text-xs text-slate-500">{team.projectName || 'Project not set'} · {team.assignedArea || team.regionName || 'Area not set'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountRole('FIELD_TECHNICIAN');
                        setAccountTeamId(team.id);
                        setAccountProjectIds(team.projectId ? [team.projectId] : []);
                        setAccountStep('details');
                        setShowCreateAccountModal(true);
                      }}
                      className="shrink-0 rounded-lg border border-[#04446F] px-3 py-2 text-xs font-bold text-[#04446F] hover:bg-sky-50"
                    >
                      Add technician
                    </button>
                  </div>
                  <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${team.leaderName ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                    <span className="font-semibold">Team leader:</span> {team.leaderName || 'Not assigned yet; technicians can still be added.'}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {team.members?.length || 0} staff member{team.members?.length === 1 ? '' : 's'} assigned
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Team categories and roster directory */}
      {(!isManager || managementTab === 'teams') && <section className="space-y-4" aria-label="Field team directory">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Browse teams by network type</h3>
            <p className="text-xs text-slate-500 mt-0.5">Choose FTTH or FTTB to see each team, its leader, and crew roster.</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={teamSearch}
              onChange={(event) => setTeamSearch(event.target.value)}
              placeholder="Search teams or members"
              aria-label="Search teams or team members"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-[#04446F] focus:outline-none focus:ring-2 focus:ring-[#04446F]/20"
            />
          </label>
          {isManager && (
            <button
              type="button"
              disabled={!hasActiveProject}
              title={!hasActiveProject ? 'Create an active project before adding a field team.' : undefined}
              onClick={() => {
                setIsEditingTeam(false);
                setNewTeamCode('');
                const selectedType = teamType === 'FTTB' ? 'FTTB' : 'FTTH';
                const nextNumber = teamTypeCounts[selectedType] + 1;
                setNewTeamName(`Team ${nextNumber}`);
                setNewTeamType(selectedType);
                const eligibleProject = projects.find((project) =>
                  project.networkType === selectedType &&
                  hasCurrentContract(project)
                );
                setNewProjectId(eligibleProject?.id || '');
                setNewRegionName('');
                setNewAssignedArea('');
                setNewContactPhone('');
                setNewLeaderId('');
                setShowAddTeamModal(true);
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#04446F] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#08558A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4 text-[#FAB417]" />
              Add field team
            </button>
          )}
        </div>

        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
          <span>Filter teams by network</span>
          <select
            value={teamType}
            onChange={(event) => handleSelectTeamType(event.target.value as 'FTTH' | 'FTTB' | 'OTHER')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-[#04446F]"
          >
            <option value="FTTH">FTTH ({teamTypeCounts.FTTH})</option>
            <option value="FTTB">FTTB ({teamTypeCounts.FTTB})</option>
            {teamTypeCounts.OTHER > 0 && <option value="OTHER">Other teams ({teamTypeCounts.OTHER})</option>}
          </select>
        </label>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading field teams…</div>
        ) : visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 font-semibold text-slate-700">No {teamType} teams found</p>
            <p className="mt-1 text-xs text-slate-500">
              {teamSearch ? 'Try another search term.' : !hasActiveProject ? 'Create an active FTTH or FTTB project before adding teams.' : 'Create a team and assign it to an FTTH or FTTB project.'}
            </p>
            {isManager && !hasActiveProject && (
              <button
                type="button"
                onClick={() => openCreateProject(teamType === 'FTTB' ? 'FTTB' : 'FTTH')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#04446F] px-4 py-2 text-xs font-bold text-white hover:bg-[#08558A]"
              >
                <Briefcase className="h-4 w-4" />
                Create first project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {visibleTeams.map((team) => {
              const isSelected = team.id === selectedTeamId;
              return (
                <article
                  key={team.id}
                  className={`overflow-hidden rounded-xl border bg-white shadow-xs transition ${
                    isSelected ? 'border-[#04446F] ring-2 ring-[#04446F]/10' : 'border-slate-200 hover:border-sky-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectTeam(team.id)}
                    aria-pressed={isSelected}
                    className="w-full p-4 text-left hover:bg-slate-50/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-lg font-black text-[#04446F]">{team.teamCode}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            team.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>{team.status}</span>
                        </div>
                        <h4 className="mt-1 font-bold text-slate-900">{team.name}</h4>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {team.assignedArea || team.regionName || 'Area not set'}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {(team.members?.length || 0) + (team.leaderName ? 1 : 0)} people
                      </span>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Team Leader / Supervisor</p>
                        <p className="truncate text-sm font-bold text-slate-900">{team.leaderName || 'No leader assigned'}</p>
                      </div>
                      {isManager && team.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectTeam(team.id);
                            setSelectedLeaderId(team.leaderId || '');
                            setShowAssignLeaderModal(true);
                          }}
                          className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-[#04446F] hover:bg-white"
                        >
                          {team.leaderName ? 'Change' : 'Assign'}
                        </button>
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Team members</p>
                        <span className="text-[10px] text-slate-400">{team.members?.length || 0} members</span>
                      </div>
                      {team.members?.length ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {team.members.map((member) => (
                            <li key={member.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                              {member.fullName}
                              {member.roleTitle ? <span className="text-slate-400"> · {member.roleTitle}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">No members added yet.</p>
                      )}
                    </div>
                    {isManager && team.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectTeam(team.id);
                          setShowAddMemberModal(true);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#04446F] hover:bg-sky-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Add member
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>}

      {/* Selected team details */}
      {(!isManager || managementTab === 'teams') && <div className="space-y-6">
          {selectedTeam ? (
            <>
              {/* Selected Team Header Banner */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black font-mono text-[#04446F]">
                        {selectedTeam.teamCode}
                      </span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs font-semibold text-slate-600">
                        {selectedTeam.projectName || 'No project assigned'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mt-0.5">
                      {selectedTeam.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>Assigned Sector: {selectedTeam.assignedArea || 'Area not specified'}</span>
                    </p>
                  </div>

                  {/* Appointed Team Leader Card */}
                  <div className="p-3 bg-gradient-to-br from-slate-50 to-sky-50 rounded-xl border border-sky-100 text-xs shrink-0 sm:max-w-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#04446F] uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Field Team Leader
                      </span>
                      {isManager && selectedTeam.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLeaderId(selectedTeam.leaderId || '');
                            setShowAssignLeaderModal(true);
                          }}
                          className="text-[10px] text-[#04446F] font-bold hover:underline cursor-pointer"
                        >
                          Change Leader
                        </button>
                      )}
                    </div>
                    <div className="text-slate-900 font-bold text-sm mt-1">
                      {selectedTeam.leaderName || 'No Leader Assigned'}
                    </div>
                    {selectedTeam.leaderPhone && (
                      <div className="text-slate-600 font-mono text-[11px] mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{selectedTeam.leaderPhone}</span>
                      </div>
                    )}
                    {selectedTeam.leaderEmail && (
                      <div className="text-slate-500 text-[10px] mt-0.5 truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{selectedTeam.leaderEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                {isManager && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={handleEditTeam}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit Team
                    </button>
                    <button
                      type="button"
                      onClick={handleArchiveTeam}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                        selectedTeam.status === 'ACTIVE'
                          ? 'border-red-200 text-red-700 hover:bg-red-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {selectedTeam.status === 'ACTIVE' ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      {selectedTeam.status === 'ACTIVE' ? 'Archive Team' : 'Restore Team'}
                    </button>
                  </div>
                )}

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-200 gap-6 text-xs font-bold pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    className={`pb-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
                      activeTab === 'members'
                        ? 'border-[#04446F] text-[#04446F]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Crew Roster & Teammates ({currentMembers.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('stock')}
                    className={`pb-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
                      activeTab === 'stock'
                        ? 'border-[#04446F] text-[#04446F]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Boxes className="w-4 h-4" />
                    <span>Virtual Materials Stock ({teamStock.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('tools')}
                    className={`pb-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
                      activeTab === 'tools'
                        ? 'border-[#04446F] text-[#04446F]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Serialized Equipment ({teamTools.length})</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: CREW ROSTER & TEAMMATES */}
              {activeTab === 'members' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#04446F]" />
                        <span>Team Crew Members under {selectedTeam.leaderName || 'Team Leader'}</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Fibre splicers, aerial riggers, and civil installation teammates on this crew
                      </p>
                    </div>

                    {isManager && selectedTeam.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => setShowAddMemberModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#04446F] hover:bg-[#08558A] text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[#FAB417]" />
                        <span>Add Teammate to Crew</span>
                      </button>
                    )}
                  </div>

                  {currentMembers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-medium text-slate-600">No crew members registered for this team yet.</p>
                      {isManager && (
                        <p className="text-[11px] text-slate-400">
                          Click <strong>"Add Teammate to Crew"</strong> above to register technicians under this leader.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {currentMembers.map((member) => (
                        <div
                          key={member.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                              {member.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{member.fullName}</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold rounded-full">
                                  {member.roleTitle || 'Technician'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500 font-mono">
                                {member.employeeId && (
                                  <span className="flex items-center gap-1">
                                    <Hash className="w-3 h-3 text-slate-400" />
                                    {member.employeeId}
                                  </span>
                                )}
                                {member.phoneNumber && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {member.phoneNumber}
                                  </span>
                                )}
                                {member.nationalId && (
                                  <span className="text-slate-400">
                                    ID: {member.nationalId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                              Active Crew
                            </span>
                            {member.hasLogin && (
                              <span className="px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg">
                                Login enabled
                              </span>
                            )}
                            {isManager && !member.id.startsWith('usrmember-') && !member.hasLogin && (
                              <button
                                type="button"
                                onClick={() => handleCreateTechnicianLogin(member)}
                                className="px-2 py-1.5 text-[10px] font-bold text-[#04446F] hover:bg-sky-50 rounded-lg"
                              >
                                Create Login
                              </button>
                            )}
                            {isManager && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMember(member.id, member.fullName)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                                title="Remove teammate from crew roster"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: VIRTUAL MATERIALS STOCK */}
              {activeTab === 'stock' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Virtual Materials Stock Ledger
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Drop cables, splitters, connectors, and consumables in crew custody
                      </p>
                    </div>
                  </div>

                  {teamStock.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No materials currently held in virtual custody by this team.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#0B2545] text-white">
                          <tr>
                            <th className="py-2.5 px-3">SKU</th>
                            <th className="py-2.5 px-3">Material Description</th>
                            <th className="py-2.5 px-3 text-right">Current Stock</th>
                            <th className="py-2.5 px-3 text-right">Total Issued</th>
                            <th className="py-2.5 px-3 text-right">Consumed</th>
                            <th className="py-2.5 px-3 text-right">Returned</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {teamStock.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-3 text-slate-600 font-medium">{s.sku}</td>
                              <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                                {s.materialName}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-blue-900 text-sm">
                                {s.currentStock} {s.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600">
                                {s.totalIssued}
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-700">
                                {s.totalConsumed}
                              </td>
                              <td className="py-2.5 px-3 text-right text-purple-700">
                                {s.totalReturned}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SERIALIZED TOOLS */}
              {activeTab === 'tools' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-[#04446F]" />
                        <span>Serialized Equipment & Tools with Team</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Power meters, optical fault locators, cleavers, and Safaricom tracked devices
                      </p>
                    </div>
                  </div>

                  {teamTools.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No serialized tools currently registered in custody with this team.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {teamTools.map((tool) => (
                        <div key={tool.id} className="p-3.5 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-900 text-sm">
                                {tool.serialNumber}
                              </span>
                              {tool.safaricomTag && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                                  Safaricom Tag: {tool.safaricomTag}
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-slate-800 mt-0.5">{tool.materialName}</p>
                            <span className="text-[11px] text-slate-400">
                              Custodian: {tool.custodianName || selectedTeam.leaderName || 'Team Leader'}
                            </span>
                          </div>

                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">
                            In Field Use
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
              Select a field team above to view its materials stock and serialized tools.
            </div>
          )}
        </div>}

        {/* ================= MODAL: CREATE STAFF ACCOUNT ================= */}
      {showCreateAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#04446F] text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <UserPlus className="w-4 h-4 text-[#FAB417]" />
                <span>Create Staff Portal Account</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateAccountModal(false)}
                className="text-white/70 hover:text-white cursor-pointer"
                aria-label="Close account form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-5 space-y-3.5 text-xs">
              <p className="p-2.5 bg-sky-50 rounded-lg border border-sky-100 text-[11px] text-sky-900">
                Create an employee record, assign the client contract they serve, and configure team access where applicable.
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Staff account setup">
                {([
                  ['details', '1. Employee'],
                  ['assignment', '2. Project & team'],
                  ['security', '3. Sign-in']
                ] as const).map(([step, label]) => (
                  <button
                    key={step}
                    type="button"
                    role="tab"
                    aria-selected={accountStep === step}
                    onClick={() => setAccountStep(step)}
                    className={`rounded-md px-2 py-2 text-[11px] font-bold ${accountStep === step ? 'bg-white text-[#04446F] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {accountStep === 'details' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                    <input value={accountFullName} onChange={(e) => setAccountFullName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" autoComplete="name" required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Employee ID *</label>
                      <input value={accountEmployeeId} onChange={(e) => setAccountEmployeeId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" required />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                      <input type="tel" value={accountPhone} onChange={(e) => setAccountPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" autoComplete="tel" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Work Email *</label>
                    <input type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" autoComplete="email" required />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Role *</label>
                    <select
                      value={accountRole}
                      onChange={(e) => {
                        setAccountRole(e.target.value);
                        setAccountTeamId('');
                        setAccountProjectIds([]);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="FIELD_TEAM_LEADER">Field Team Leader</option>
                      <option value="FIELD_TECHNICIAN">Field Technician (team sign-in)</option>
                      <option value="HR">HR Manager</option>
                      <option value="PROJECT_MANAGER">Project Manager</option>
                      <option value="ADMIN">Administrator</option>
                      <option value="DISPATCHER">Dispatcher</option>
                      <option value="ACCOUNTANT">Accountant</option>
                      <option value="STORE_OFFICER">Store Officer</option>
                      <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                      <option value="AUDITOR">Auditor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  </div>
                </div>
              )}

              {accountStep === 'assignment' && (
                <div className="space-y-3.5">
                  {['FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(accountRole) ? (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Serving Client Project *</label>
                        <select
                          value={accountProjectIds[0] || ''}
                          onChange={(event) => {
                            setAccountProjectIds(event.target.value ? [event.target.value] : []);
                            setAccountTeamId('');
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                          required
                        >
                          <option value="">-- Select an active client contract --</option>
                          {projects.map((project) => {
                            const isAvailable = activeContractProjects.some((activeProject) => activeProject.id === project.id);
                            const availability = isAvailable
                              ? ''
                              : project.contractHealth === 'EXPIRED'
                                ? ' — Contract expired'
                                : project.contractHealth === 'NOT_STARTED'
                                  ? ' — Contract not started'
                                  : project.contractHealth === 'MISSING_DATES'
                                    ? ' — Contract dates required'
                                    : ` — ${project.status.replace('_', ' ').toLowerCase()}`;
                            return (
                              <option key={project.id} value={project.id} disabled={!isAvailable}>
                                {project.client} · {project.projectCode} — {project.name}{availability}
                              </option>
                            );
                          })}
                        </select>
                        {projects.length === 0 ? (
                          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                            <p>No client projects have been created yet. Create a project before assigning this employee.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setShowCreateAccountModal(false);
                                setManagementTab('teams');
                              }}
                              className="mt-2 rounded-md bg-[#04446F] px-3 py-1.5 font-bold text-white hover:bg-[#08558A]"
                            >
                              Go to Client Projects
                            </button>
                          </div>
                        ) : activeContractProjects.length === 0 && (
                          <p className="mt-1 text-xs text-amber-700">
                            No project currently has an active contract. Update its status and contract dates in Client Projects &amp; Contracts.
                          </p>
                        )}
                      </div>
                      {accountProjectIds[0] && (
                        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-900">
                          <strong>Contract expiry:</strong> {projects.find((project) => project.id === accountProjectIds[0])?.contractEndDate || 'Not available'}.
                        </div>
                      )}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Assigned Field Team *</label>
                        <select
                          value={accountTeamId}
                          onChange={(event) => setAccountTeamId(event.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                          required
                          disabled={!accountProjectIds[0]}
                        >
                          <option value="">-- Select team for this project --</option>
                          {teams.filter((team) => team.projectId === accountProjectIds[0] && team.status === 'ACTIVE').map((team) => (
                            <option key={team.id} value={team.id}>{team.teamCode} — {team.name} · {team.assignedArea || team.regionName || 'Area not set'}</option>
                          ))}
                        </select>
                        {accountProjectIds[0] && teams.filter((team) => team.projectId === accountProjectIds[0] && team.status === 'ACTIVE').length === 0 && (
                          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-[11px] text-amber-900">There is no active field team for this project yet. Create one now; your technician details will be kept and this account setup will resume after the team is created.</p>
                            <button
                              type="button"
                              onClick={() => {
                                const project = activeContractProjects.find((item) => item.id === accountProjectIds[0]);
                                if (project) openCreateTeamForTechnician(project);
                              }}
                              className="mt-2 rounded-lg bg-[#04446F] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#08558A]"
                            >
                              Create a team for this project
                            </button>
                          </div>
                        )}
                        {accountTeamId && (
                          <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-[11px] text-sky-900">
                            This technician will be assigned to <strong>{teams.find((team) => team.id === accountTeamId)?.teamCode}</strong> and report to <strong>{teams.find((team) => team.id === accountTeamId)?.leaderName || 'no leader yet'}</strong>. You can still add the technician before a leader is appointed.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h4 className="font-bold text-slate-800">Client projects this employee serves</h4>
                        <p className="mt-0.5 text-[11px] text-slate-500">Select one or more active contracts. HR, Admin, and Project Manager accounts may be organization-wide.</p>
                      </div>
                      {activeContractProjects.length === 0 ? (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">There are no active client contracts to assign.</p>
                      ) : (
                        <div className="max-h-56 space-y-2 overflow-y-auto">
                          {activeContractProjects.map((project) => {
                            const checked = accountProjectIds.includes(project.id);
                            return (
                              <label key={project.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 ${checked ? 'border-[#04446F] bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => setAccountProjectIds((current) =>
                                    event.target.checked
                                      ? [...current, project.id]
                                      : current.filter((id) => id !== project.id)
                                  )}
                                  className="mt-0.5 rounded text-[#04446F]"
                                />
                                <span className="min-w-0">
                                  <span className="block font-bold text-slate-800">{project.client} · {project.projectCode}</span>
                                  <span className="block text-[11px] text-slate-600">{project.name} · {project.networkType}</span>
                                  <span className="block text-[10px] text-slate-500">Expires {project.contractEndDate} · {project.regionName || 'Region not set'}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                  {accountRole === 'FIELD_TEAM_LEADER' && accountTeamId && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-900">
                      This account will supervise {teams.find((team) => team.id === accountTeamId)?.teamCode}. Add its crew members after creating the leader account.
                    </p>
                  )}
                  {accountRole === 'FIELD_TECHNICIAN' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Technician Specialization</label>
                      <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                        <option value="Field Technician">Field Technician</option>
                        <option value="Senior Fibre Splicer">Senior Fibre Splicer</option>
                        <option value="Aerial Rigger & Pole Specialist">Aerial Rigger & Pole Specialist</option>
                        <option value="OTDR & Optical Testing Specialist">OTDR & Optical Testing Specialist</option>
                        <option value="Civil Drop Cable Installer">Civil Drop Cable Installer</option>
                        <option value="FAT Enclosure Specialist">FAT Enclosure Specialist</option>
                        <option value="Assistant Technician">Assistant Technician</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {accountStep === 'security' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Temporary Password *</label>
                  <input type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" autoComplete="new-password" minLength={8} required />
                  <p className="text-[10px] text-slate-500 mt-1">At least 8 characters, including uppercase, lowercase, number, and symbol. The employee will be required to change it at first sign-in.</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateAccountModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <div className="flex gap-2">
                  {accountStep !== 'details' && (
                    <button
                      type="button"
                      onClick={() => setAccountStep(accountStep === 'security' ? 'assignment' : 'details')}
                      className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Back
                    </button>
                  )}
                  {accountStep !== 'security' ? (
                    <button
                      type="button"
                      onClick={() => setAccountStep(accountStep === 'details' ? 'assignment' : 'security')}
                      className="px-4 py-2 bg-[#04446F] hover:bg-[#08558A] text-white rounded-lg font-bold"
                    >
                      Continue
                    </button>
                  ) : (
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#04446F] hover:bg-[#08558A] disabled:opacity-60 text-white rounded-lg font-bold">
                      {isSubmitting ? 'Creating...' : 'Create Account'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE PROJECT ================= */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#04446F] text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Briefcase className="w-4 h-4 text-[#FAB417]" />
                <span>{isEditingProject ? 'Update Client Contract' : 'Create Client Contract / Project'}</span>
              </div>
              <button type="button" onClick={() => setShowCreateProjectModal(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Project Code *</label>
                  <input
                    value={newProjectCode}
                    onChange={(event) => setNewProjectCode(event.target.value)}
                    placeholder="e.g. NBI-FTTH-01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Network Type *</label>
                  <select
                    value={newProjectType}
                    onChange={(event) => setNewProjectType(event.target.value as 'FTTH' | 'FTTB')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="FTTH">FTTH</option>
                    <option value="FTTB">FTTB</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Project Name *</label>
                <input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="e.g. North Region Fibre Deployment"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Client / Contracting Customer *</label>
                  <input
                    value={newProjectClient}
                    onChange={(event) => setNewProjectClient(event.target.value)}
                    placeholder="e.g. Safaricom PLC, Airtel Kenya"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Country / County / Region *</label>
                  <input
                    value={newProjectRegion}
                    onChange={(event) => setNewProjectRegion(event.target.value)}
                    placeholder="e.g. Kenya / County or region"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Approved Budget (KES)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProjectBudget}
                  onChange={(event) => setNewProjectBudget(event.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contract Status *</label>
                  <select
                    value={newProjectStatus}
                    onChange={(event) => setNewProjectStatus(event.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On hold</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contract Start *</label>
                  <input
                    type="date"
                    value={newProjectStartDate}
                    onChange={(event) => setNewProjectStartDate(event.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contract Expiry *</label>
                  <input
                    type="date"
                    value={newProjectEndDate}
                    min={newProjectStartDate}
                    onChange={(event) => setNewProjectEndDate(event.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreateProjectModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#04446F] hover:bg-[#08558A] disabled:opacity-60 text-white rounded-lg font-bold">
                  {isSubmitting ? (isEditingProject ? 'Saving…' : 'Creating…') : (isEditingProject ? 'Save contract' : 'Create project')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD NEW FIELD TEAM ================= */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#04446F] text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <PlusCircle className="w-4 h-4 text-[#FAB417]" />
                <span>{isEditingTeam ? `Edit ${selectedTeam?.teamCode || 'Field Team'}` : 'Create New Field Installation Team'}</span>
              </div>
              <button
                type="button"
                onClick={cancelTeamCreation}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Network Type</label>
                  <select
                    value={newTeamType}
                    onChange={(event) => {
                      const type = event.target.value as 'FTTH' | 'FTTB';
                      setNewTeamType(type);
                      setNewProjectId(projects.find((project) => project.networkType === type && hasCurrentContract(project))?.id || '');
                    }}
                    disabled={isEditingTeam}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold text-[#04446F]"
                  >
                    <option value="FTTH">FTTH</option>
                    <option value="FTTB">FTTB</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Team Code / Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTeamCode}
                    onChange={(e) => setNewTeamCode(e.target.value)}
                    placeholder="e.g. NBI-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold uppercase focus:ring-2 focus:ring-[#04446F]"
                    required
                    disabled={isEditingTeam}
                    readOnly={isEditingTeam}
                  />
                  {!isEditingTeam && <p className="mt-1 text-[10px] text-slate-500">Saved as {newTeamType}-{newTeamCode.trim().toUpperCase().replace(/^(FTTH|FTTB)-/, '') || '…'}</p>}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="+254 711 000 044"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#04446F]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. FTTH Charlie Splicing Crew"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-[#04446F]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Assigned Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    required
                  >
                    <option value="">-- Select an active {newTeamType} project --</option>
                    {projects.filter((project) => project.networkType === newTeamType).map((project) => {
                      const available = hasCurrentContract(project);
                      const reason = available
                        ? ''
                        : project.contractHealth === 'EXPIRED'
                          ? ' — Contract expired'
                          : project.contractHealth === 'NOT_STARTED'
                            ? ' — Contract not started'
                            : project.contractHealth === 'MISSING_DATES'
                              ? ' — Contract dates required'
                              : ` — ${project.status.replace('_', ' ').toLowerCase()}`;
                      return (
                        <option key={project.id} value={project.id} disabled={!available}>
                          {project.projectCode} — {project.name}{reason}
                        </option>
                      );
                    })}
                  </select>
                  {!projects.some((project) => project.networkType === newTeamType && hasCurrentContract(project)) && (
                    <p className="mt-1 text-[10px] text-amber-700">
                      No assignable {newTeamType} project. Projects must have an active status and contract dates that include today. Edit the project above to update its contract.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Country / County / Region <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRegionName}
                    onChange={(e) => setNewRegionName(e.target.value)}
                    placeholder="e.g. Kenya / County or region"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Assigned Geographic Sector / Area
                </label>
                <input
                  type="text"
                  value={newAssignedArea}
                  onChange={(e) => setNewAssignedArea(e.target.value)}
                  placeholder="e.g. assigned sites, wards, or routes"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              {!isEditingTeam && <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Appoint Field Team Leader
                </label>
                <select
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="">-- Appoint Leader Later --</option>
                  {availableLeaders.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.fullName} ({lead.employeeId}) {lead.currentTeamCode ? `— currently with ${lead.currentTeamCode}` : '— Available'}
                    </option>
                  ))}
                </select>
              </div>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={cancelTeamCreation}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#04446F] hover:bg-[#08558A] text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-4 h-4 text-[#FAB417]" />
                  <span>{isSubmitting ? (isEditingTeam ? 'Saving...' : 'Creating Team...') : (isEditingTeam ? 'Save Changes' : 'Create Team')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD TEAMMATE TO CREW ================= */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#04446F] text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <UserPlus className="w-4 h-4 text-[#FAB417]" />
                <span>Add Crew Teammate to {selectedTeam?.teamCode}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-5 space-y-3.5 text-xs">
              <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-100 text-[11px] text-sky-900 leading-normal">
                Roster entries track crew membership. Use <strong>Create Staff Account</strong> to give a technician their own team-limited sign-in.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Peter Njoroge"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-[#04446F]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Specialization / Role
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Senior Fibre Splicer">Senior Fibre Splicer</option>
                    <option value="Aerial Rigger & Pole Specialist">Aerial Rigger & Pole Specialist</option>
                    <option value="OTDR & Optical Testing Specialist">OTDR & Optical Testing Specialist</option>
                    <option value="Civil Drop Cable Installer">Civil Drop Cable Installer</option>
                    <option value="FAT Enclosure Specialist">FAT Enclosure Specialist</option>
                    <option value="Assistant Technician">Assistant Technician</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Employee / Badge ID
                  </label>
                  <input
                    type="text"
                    value={newMemberEmpId}
                    onChange={(e) => setNewMemberEmpId(e.target.value)}
                    placeholder="e.g. TC-055"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    placeholder="+254 712 000 111"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    National ID No.
                  </label>
                  <input
                    type="text"
                    value={newMemberNationalId}
                    onChange={(e) => setNewMemberNationalId(e.target.value)}
                    placeholder="e.g. 29182901"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#04446F] hover:bg-[#08558A] text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-4 h-4 text-[#FAB417]" />
                  <span>{isSubmitting ? 'Adding...' : 'Add Teammate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ASSIGN TEAM LEADER ================= */}
      {showAssignLeaderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#04446F] text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-[#FAB417]" />
                <span>Appoint Field Team Leader for {selectedTeam?.teamCode}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignLeaderModal(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignLeader} className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600">
                Select a registered <strong>Field Team Leader</strong> to manage material requisitions, virtual stock custody, and on-site crew work for <strong>{selectedTeam?.name}</strong>.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Team Leader
                </label>
                <select
                  value={selectedLeaderId}
                  onChange={(e) => setSelectedLeaderId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                  required
                >
                  <option value="">-- Choose Field Team Leader --</option>
                  {availableLeaders.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.fullName} ({lead.employeeId}) {lead.currentTeamCode ? `— currently with ${lead.currentTeamCode}` : '— Available'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignLeaderModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedLeaderId}
                  className="px-4 py-2 bg-[#04446F] hover:bg-[#08558A] disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-[#FAB417]" />
                  <span>{isSubmitting ? 'Appointing...' : 'Appoint Leader'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
