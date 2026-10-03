export class ProviderError extends Error {
  constructor(
    public readonly code:
      'PROVIDER_DISABLED' | 'QUOTA_EXCEEDED' | 'DATA_INCOMPLETE' | 'DEPENDENCY_UNAVAILABLE',
    message: string,
  ) {
    super(message);
  }
}
export interface Entitlement {
  enabled: boolean;
  evidenceReference: string;
  currentSeason: string;
  monthlyCostCents: number;
  storageAllowed: boolean;
  displayAllowed: boolean;
  derivedScoringAllowed: boolean;
}
export function requireEntitlement(
  value: Entitlement,
  season: string,
  combinedCostCents: number,
): void {
  if (
    !value.enabled ||
    !value.evidenceReference ||
    value.currentSeason !== season ||
    !value.storageAllowed ||
    !value.displayAllowed ||
    !value.derivedScoringAllowed ||
    !Number.isInteger(combinedCostCents) ||
    !Number.isInteger(value.monthlyCostCents) ||
    value.monthlyCostCents < 0 ||
    value.monthlyCostCents > combinedCostCents ||
    combinedCostCents > 500 ||
    combinedCostCents < 0
  ) {
    throw new ProviderError(
      'PROVIDER_DISABLED',
      'Provider authorization and budget gate are not satisfied',
    );
  }
}
export interface HttpResponse {
  status: number;
  body: string;
}
export type HttpTransport = (
  url: URL,
  headers: Record<string, string>,
  signal: AbortSignal,
) => Promise<HttpResponse>;
export const fetchTransport: HttpTransport = async (url, headers, signal) => {
  const response = await fetch(url, { headers, signal, redirect: 'error' });
  const maximum = 2_000_000;
  if (Number(response.headers.get('content-length') ?? 0) > maximum)
    throw new ProviderError('DATA_INCOMPLETE', 'Provider response exceeds bound');
  if (!response.body) return { status: response.status, body: '' };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > maximum) {
      await reader.cancel();
      throw new ProviderError('DATA_INCOMPLETE', 'Provider response exceeds bound');
    }
    chunks.push(item.value);
  }
  return { status: response.status, body: Buffer.concat(chunks).toString('utf8') };
};
export interface RequestReservation {
  reserve(requestKey: string): Promise<boolean>;
}
export async function authorizedGet(
  url: URL,
  headers: Record<string, string>,
  reservation: RequestReservation,
  requestKey: string,
  transport: HttpTransport = fetchTransport,
): Promise<string> {
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new ProviderError('PROVIDER_DISABLED', 'HTTPS provider endpoint required');
  // Reserve before HTTP; a process crash intentionally consumes the request rather than risking quota overspend.
  if (!(await reservation.reserve(requestKey)))
    throw new ProviderError('QUOTA_EXCEEDED', 'Provider request quota exhausted');
  const response = await transport(url, headers, AbortSignal.timeout(15_000));
  if (response.status < 200 || response.status >= 300)
    throw new ProviderError('DEPENDENCY_UNAVAILABLE', 'Provider request failed');
  return response.body;
}
