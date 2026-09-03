// Service-config registry. All 14 workbook calculators are VERIFIED against
// docs/product/pricing-configs-full.md (the cell-cited extraction). The log tabs
// (Tech/Leave/Super Rem/SysImp deal logs) are NOT services and are excluded.

import type { ServiceConfig, ServiceKey } from "../types";
import { payroll360 } from "./payroll-360";
import { payReview } from "./pay-review";
import { awardInterpretation } from "./award-interpretation";
import { complianceReview, optimise, payCompliance, healthCheck } from "./reviews";
import { boot, remediation } from "./remediation-boot";
import { techProcurement, stp2, sysImp, superReview, lslReview } from "./technical";

export const SERVICE_CONFIGS: Record<ServiceKey, ServiceConfig> = {
  payroll_360: payroll360,
  pay_review: payReview,
  compliance_review: complianceReview,
  health_check: healthCheck,
  optimise,
  pay_compliance: payCompliance,
  boot,
  tech_procurement: techProcurement,
  stp2,
  award_interpretation: awardInterpretation,
  super_review: superReview,
  lsl_review: lslReview,
  sys_imp: sysImp,
  remediation,
};

export function getServiceConfig(key: ServiceKey): ServiceConfig {
  return SERVICE_CONFIGS[key];
}

export const VERIFIED_SERVICE_KEYS: ServiceKey[] = (Object.keys(SERVICE_CONFIGS) as ServiceKey[]).filter(
  (k) => SERVICE_CONFIGS[k].verified,
);
