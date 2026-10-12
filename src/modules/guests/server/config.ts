import "server-only";
import { CapabilityConfigurationError } from "@/server/config";
export function getGuestPartyLimit() {
  const value = process.env.GUEST_MAX_PARTY_SIZE ?? "20";
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 100) throw new CapabilityConfigurationError("Guest party-size limit");
  return Number(value);
}
