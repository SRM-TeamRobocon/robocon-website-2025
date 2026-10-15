export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "issued"
  | "returned"
  | "cancelled";

export type UsageLocation = "in_lab" | "outside";

export type BazaarRole = "lead" | "viewer" | "member";

export interface BazaarUser {
  id: string;
  name: string;
  email?: string;
  regNumber?: string;
  role: BazaarRole;
  isStaffAccount: boolean;
}

export interface BazaarCategory {
  id: string;
  name: string;
  created_at: string;
}

export interface BazaarItem {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  location: string | null;
  image_url: string | null;
  total_quantity: number;
  reserved_quantity: number;
  issued_quantity: number;
  damaged_quantity: number;
  available_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string } | null;
}

export interface BazaarPublicItem {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  image_url: string | null;
  available_quantity: number;
  category?: { id: string; name: string } | null;
}

export interface BazaarRequest {
  id: string;
  item_id: string | null;
  custom_item_name: string | null;
  member_id: string;
  member_name: string;
  member_email: string | null;
  member_reg_number: string | null;
  quantity: number;
  purpose: string;
  project_name: string | null;
  taking_date: string;
  expected_return_date: string;
  usage_location: UsageLocation;
  location_details: string | null;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  issued_by: string | null;
  issued_at: string | null;
  returned_by: string | null;
  returned_at: string | null;
  returned_good_qty: number | null;
  returned_damaged_qty: number | null;
  returned_lost_qty: number | null;
  return_note: string | null;
  last_reminder_at: string | null;
  created_at: string;
  updated_at: string;
  is_overdue?: boolean;
  days_overdue?: number;
  item?: {
    id: string;
    name: string;
    image_url: string | null;
    available_quantity?: number;
    location?: string | null;
  } | null;
}

export interface BazaarActivity {
  id: number;
  request_id: string | null;
  item_id: string | null;
  actor: string;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  item?: { id: string; name: string } | null;
  request?: { id: string; member_name: string } | null;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}
