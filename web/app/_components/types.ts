export type Severity = "High" | "Medium" | "Low";

export interface Clause {
  title: string;
  type: "risky" | "missing";
  page: number | null;
  quote: string | null;
  severity: Severity;
  issue: string;
  plain_english: string;
  rewrite: string;
  verified?: boolean | null;
}

export interface AuditResult {
  summary: string;
  clauses: Clause[];
}

export interface QaResult {
  answer: string;
  direct_quote: string;
  is_in_contract: boolean;
}
