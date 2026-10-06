export interface Company {
  id: string;
  slug: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  industry: string | null;
  employee_count: number | null;
  google_place_id: string | null;
  apollo_org_id: string | null;
  logo_path: string | null;
  logo_source_url: string | null;
  logo_grade: "usable" | "needs_cleanup" | "not_pvc" | null;
  logo_notes: string | null;
  logo_colors: string[] | null;
  logo_kind: "mark" | "wordmark" | "both" | null;
  logo_fetched_at: string | null;
  is_existing_customer: boolean;
  created_at: string;
}

export interface Person {
  id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string;
  email_verified: boolean;
  email_verified_at: string | null;
  email_check: "apollo_verified" | "ok" | "catch_all" | "unknown" | "invalid" | "disposable" | null;
  email_checked_at: string | null;
  email_check_attempts: number;
  apollo_person_id: string | null;
  created_at: string;
}

export type LeadStatus =
  | "new" | "reviewed" | "approved" | "sent" | "replied" | "quoted" | "won" | "lost" | "suppressed" | "held";

export interface Lead {
  id: string;
  company_id: string;
  person_id: string;
  campaign: "warm" | "cold" | "asapparel";
  status: LeadStatus;
  ab_arm: string | null;
  instantly_lead_id: string | null;
  page_token: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
  last_reply_at: string | null;
  reply_class: string | null;
  quoted_tier: number | null;
  quoted_colorway: string | null;
  shopify_draft_order_id: string | null;
  won_at: string | null;
  lost_reason: string | null;
  hold_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
