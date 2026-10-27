import type { Market } from "./markets";

export type Side = "yes" | "no";

export interface MarketDTO extends Market {
  pick: { side: Side; confidence: number };
  resolved: Side | null;
}

export interface LeaderRow {
  id: string;
  name: string;
  wins: number;
  total: number;
  hitRate: number;
  score: number;
}

export interface PickDTO {
  id: string;
  marketId: string;
  marketTitle: string;
  side: Side;
  stake: number;
  confidence: number;
  source: "user" | "copilot" | "caller";
  createdAt: string;
  checkpoint?: string;
  blobId?: string;
  fingerprint: string;
  status: "open" | "won" | "lost";
}

export interface AdviceDTO {
  marketId: string;
  marketTitle: string;
  side: Side;
  confidence: number;
  label: string;
  reasons: string[];
  because: string[];
  amount: number;
  callers: { name: string; side: Side; hitRate: number; total: number }[];
}

export interface CopilotReplyDTO {
  text: string;
  advice?: AdviceDTO;
  learned?: string;
  suggestions: string[];
  error?: string;
}
