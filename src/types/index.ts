export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'HR'
  | 'PROJECT_MANAGER'
  | 'FIELD_TEAM_LEADER'
  | 'FIELD_TECHNICIAN'
  | 'DISPATCHER'
  | 'ACCOUNTANT'
  | 'STORE_OFFICER'
  | 'PROCUREMENT_OFFICER'
  | 'AUDITOR'
  | 'VIEWER';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CLARIFICATION_REQUIRED'
  | 'REJECTED'
  | 'APPROVED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'READY_FOR_ISSUE'
  | 'PARTIALLY_ISSUED'
  | 'ISSUED'
  | 'RECEIVED'
  | 'IN_USE'
  | 'RETURN_PENDING'
  | 'PARTIALLY_RETURNED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'COMPLETED';

export type MaterialCategory =
  | 'FIBRE_CABLE'
  | 'CONNECTORS'
  | 'SPLITTERS'
  | 'TOOLS'
  | 'TESTING_EQUIPMENT'
  | 'INSTALLATION_MATERIALS'
  | 'CONSUMABLES'
  | 'SAFETY_PPE'
  | 'NETWORK_EQUIPMENT'
  | 'ELECTRICAL'
  | 'OTHER';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  employeeId: string;
  role: UserRole;
  department?: string | null;
  teamId?: string | null;
  team?: Team | null;
  isActive?: boolean;
  mustChangePassword?: boolean;
  lastLogin?: string | null;
}

export interface TeamMember {
  id: string;
  teamId: string;
  fullName: string;
  phoneNumber?: string | null;
  employeeId?: string | null;
  roleTitle?: string | null;
  nationalId?: string | null;
  isActive: boolean;
  hasLogin?: boolean | number | string;
  joinedAt?: string;
  createdAt?: string;
}

export interface Team {
  id: string;
  teamCode: string;
  name: string;
  leaderId?: string | null;
  leaderName?: string | null;
  leaderEmail?: string | null;
  leaderEmployeeId?: string | null;
  leaderPhone?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  assignedArea?: string | null;
  status: string;
  contactInfo?: string | null;
  memberCount?: number;
  members?: TeamMember[];
}

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  networkType: 'FTTH' | 'FTTB';
  client: string;
  regionId?: string | null;
  regionName?: string | null;
  status: string;
  budget: number;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractHealth?: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_STARTED' | 'MISSING_DATES';
  daysUntilExpiry?: number | null;
  teamCount?: number;
  staffCount?: number;
  requestCount?: number;
  totalMaterialCost?: number;
}

export interface Material {
  id: string;
  sku: string;
  name: string;
  category: MaterialCategory;
  description?: string | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  reorderLevel: number;
  maximumStock: number;
  storeLocation?: string | null;
  isSerialRequired: boolean | number;
  isBarcodeRequired: boolean | number;
  isScanningMandatory: boolean | number;
  requiresSafaricomTracking: boolean | number;
  supplier?: string | null;
  unitCost: number;
  isActive: boolean | number;
}

export interface CreateMaterialPayload {
  sku: string;
  name: string;
  category: MaterialCategory;
  description?: string;
  unit: string;
  minimumStock?: number;
  reorderLevel?: number;
  maximumStock?: number;
  storeLocation?: string;
  isSerialRequired?: boolean;
  isBarcodeRequired?: boolean;
  isScanningMandatory?: boolean;
  requiresSafaricomTracking?: boolean;
  supplier?: string;
  unitCost?: number;
  initialStock?: number;
  warehouseId?: string;
}

export interface TrackedUnit {
  id: string;
  serialNumber: string;
  barcode?: string | null;
  materialId: string;
  materialName?: string;
  sku?: string;
  category?: string;
  status: 'IN_STORE' | 'ISSUED' | 'IN_TRANSIT' | 'WITH_TEAM' | 'IN_USE' | 'RETURNED' | 'DAMAGED' | 'LOST' | 'DISPOSED';
  currentLocation: string;
  currentTeamId?: string | null;
  teamCode?: string | null;
  custodianName?: string | null;
  safaricomTag?: string | null;
  updatedAt: string;
}

export interface MaterialRequestItem {
  id: string;
  materialId: string;
  sku?: string;
  materialName?: string;
  category?: string;
  quantityRequested: number;
  quantityApproved: number;
  quantityIssued: number;
  quantityRemaining: number;
  unit: string;
  reason?: string | null;
  currentWarehouseStock?: number;
  unitCost?: number;
  isSerialRequired?: boolean | number;
  requiresSafaricomTracking?: boolean | number;
  storeLocation?: string | null;
}

export interface ApprovalRecord {
  id: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  action: string;
  previousStatus: RequestStatus;
  newStatus: RequestStatus;
  comment?: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  accountantId: string;
  accountantName: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  paymentDate: string;
  receiptEvidence?: string | null;
  notes?: string | null;
  status: string;
}

export interface MaterialIssueRecord {
  id: string;
  storeOfficerId: string;
  storeOfficerName: string;
  recipientName: string;
  recipientSignature?: string | null;
  isPartial: boolean | number;
  issuedAt: string;
  receivedAt?: string | null;
  items?: Array<{
    id: string;
    materialId: string;
    materialName: string;
    sku: string;
    quantityIssued: number;
    serialNumber?: string | null;
    trackedUnitId?: string | null;
  }>;
}

export interface MaterialReturnRecord {
  id: string;
  receiverId: string;
  receiverName: string;
  status: string;
  createdAt: string;
  items?: Array<{
    id: string;
    materialId: string;
    materialName: string;
    sku: string;
    quantity: number;
    serialNumber?: string | null;
    condition: 'GOOD' | 'DAMAGED' | 'FAULTY' | 'MISSING_PARTS' | 'UNUSABLE';
    notes?: string | null;
  }>;
}

export interface MaterialRequest {
  id: string;
  requestNumber: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  teamArea?: string | null;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterEmployeeId?: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  projectClient?: string;
  siteName?: string | null;
  requiredDate: string;
  priority: Priority;
  reason: string;
  workOrderRef?: string | null;
  notes?: string | null;
  status: RequestStatus;
  estimatedCost: number;
  createdAt: string;
  updatedAt: string;
  items?: MaterialRequestItem[];
  approvals?: ApprovalRecord[];
  payment?: PaymentRecord | null;
  issues?: MaterialIssueRecord[];
  returns?: MaterialReturnRecord[];
  teamStock?: any[];
  auditLogs?: AuditLogRecord[];
  itemCount?: number;
  paymentReference?: string;
  paymentStatus?: string;
}

export interface AuditLogRecord {
  id: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  entity: string;
  entityId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface TeamStockItem {
  id: string;
  teamId: string;
  materialId: string;
  sku: string;
  materialName: string;
  category: string;
  unit: string;
  currentStock: number;
  totalIssued: number;
  totalConsumed: number;
  totalReturned: number;
  totalDamaged: number;
  totalLost: number;
  isSerialRequired: boolean | number;
  updatedAt: string;
}

export interface InventoryBalance {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  materialId: string;
  sku: string;
  materialName: string;
  category: string;
  unit: string;
  warehouseStock: number;
  totalStock: number;
  minimumStock: number;
  reorderLevel: number;
  isSerialRequired: boolean | number;
  requiresSafaricomTracking: boolean | number;
  storeLocation?: string;
  unitCost: number;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  manager?: string | null;
}

export interface InventoryTransaction {
  id: string;
  materialId: string;
  sku: string;
  materialName: string;
  unit: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  source?: string;
  destination?: string;
  reference?: string;
  reason?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean | number;
  createdAt: string;
}
