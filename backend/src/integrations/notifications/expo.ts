import type { Json } from '../../contracts/types.js';
export interface PushMessage {
  id: string;
  token: string;
  versionId: string | null;
  kind: 'official' | 'correction' | 'deadline';
  ticketId?: string;
}
export interface PushOutcome {
  id: string;
  status: 'accepted' | 'delivered' | 'invalid' | 'retry';
  ticketId?: string;
}
export type PushTransport = (url: string, payload: Json, signal: AbortSignal) => Promise<unknown>;
const transport: PushTransport = async (url, payload, signal) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) throw new Error('Push transport unavailable');
  return response.json();
};
interface Ticket {
  status?: string;
  id?: string;
  details?: { error?: string };
}
function outcome(message: PushMessage, ticket: Ticket | undefined, receipt: boolean): PushOutcome {
  if (ticket?.details?.error === 'DeviceNotRegistered')
    return { id: message.id, status: 'invalid' };
  if (ticket?.status === 'ok' && (receipt || ticket.id))
    return {
      id: message.id,
      status: receipt ? 'delivered' : 'accepted',
      ...(ticket.id ? { ticketId: ticket.id } : {}),
    };
  return { id: message.id, status: 'retry' };
}
/** Push content stays generic; no squad, account or league data crosses the notification transport. */
export async function deliverPush(
  messages: PushMessage[],
  send: PushTransport = transport,
  signal: AbortSignal = AbortSignal.timeout(15_000),
): Promise<PushOutcome[]> {
  signal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  if (messages.length > 100) throw new Error('Push batch exceeds bound');
  const pending = messages.filter((m) => !m.ticketId);
  const receipts = messages.filter((m) => m.ticketId);
  const results: PushOutcome[] = [];
  if (pending.length) {
    const response = (await send(
      'https://exp.host/--/api/v2/push/send',
      pending.map((m) => ({
        to: m.token,
        title: 'Six Nations Fantasy',
        body:
          m.kind === 'deadline'
            ? 'Your squad deadline is approaching.'
            : m.kind === 'correction'
              ? 'Updated official results are available.'
              : 'Official results are available.',
        data: { publicationId: m.versionId },
      })),
      signal,
    )) as { data?: Ticket[] };
    if (!Array.isArray(response.data) || response.data.length !== pending.length)
      throw new Error('Invalid push response');
    pending.forEach((message, i) => results.push(outcome(message, response.data?.[i], false)));
  }
  if (receipts.length) {
    const response = (await send(
      'https://exp.host/--/api/v2/push/getReceipts',
      { ids: receipts.map((m) => m.ticketId!) },
      signal,
    )) as { data?: Record<string, Ticket> };
    receipts.forEach((message) =>
      results.push(outcome(message, response.data?.[message.ticketId!], true)),
    );
  }
  return results;
}
