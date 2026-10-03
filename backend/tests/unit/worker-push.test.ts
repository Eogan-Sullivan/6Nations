import { it, expect } from 'vitest';
import { deliverPush } from '../../src/integrations/notifications/expo.js';
it('distinguishes acceptance from delivery and removes unregistered recipients', async () => {
  const messages = [
    { id: 'a', token: 'ExponentPushToken[a]', versionId: 'v1', kind: 'official' as const },
    { id: 'b', token: 'ExponentPushToken[b]', versionId: 'v1', kind: 'official' as const },
  ];
  const outcomes = await deliverPush(messages, async (_url, payload) => {
    expect(JSON.stringify(payload)).not.toContain('selection');
    return {
      data: [
        { status: 'ok', id: 'ticket-a' },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
      ],
    };
  });
  expect(outcomes).toEqual([
    { id: 'a', status: 'accepted', ticketId: 'ticket-a' },
    { id: 'b', status: 'invalid' },
  ]);
});
it('checks receipts and treats missing receipts as pending', async () => {
  const outcomes = await deliverPush(
    [{ id: 'a', token: 'x', ticketId: 't', versionId: 'v', kind: 'correction' }],
    async () => ({ data: {} }),
  );
  expect(outcomes).toEqual([{ id: 'a', status: 'retry' }]);
});
