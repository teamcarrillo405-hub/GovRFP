-- =============================================================================
-- Phase 12: Add naics_codes column to rfp_analysis
-- =============================================================================
-- Fixes SBA size eligibility for raw PDF uploads.
-- Previously NAICS only arrived via win_factors.naics (GovRFP handoff path).
-- The analyze-proposal edge function now extracts NAICS directly from the RFP
-- text and stores up to 5 codes here, ordered by relevance.

ALTER TABLE public.rfp_analysis
  ADD COLUMN IF NOT EXISTS naics_codes text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.rfp_analysis.naics_codes IS
  'NAICS codes extracted from the RFP document during analysis. Up to 5 codes, ordered by relevance. Populated by the analyze-proposal edge function. Empty array for GovRFP-handoff-only rows (use win_factors.naics as fallback).';
