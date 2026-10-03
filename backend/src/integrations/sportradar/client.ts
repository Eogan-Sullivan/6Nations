import { ProviderError } from '../http.js';
/** No verified competition route or entitlement is present. This alternative stays explicitly gated. */
export function sportradarAdapter(): never {
  throw new ProviderError(
    'PROVIDER_DISABLED',
    'Sportradar route, coverage and permitted-use review required',
  );
}
