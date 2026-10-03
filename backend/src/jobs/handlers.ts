import type {
  EntryRoundResult,
  Json,
  NormalizedObservation,
  Player,
  PlayerFixtureStatistics,
  SquadSelection,
} from '../contracts/types.js';
import type { WorkerRepository } from '../repositories/index.js';
import { scorePlayerFixture, scoreRound } from '../domain/scoring/index.js';
import { previewImport } from '../imports/preview.js';
import { JobError, unwrap, type JobHandler } from './worker.js';
import {
  fetchSixNationsObservation,
  type SixNationsConfiguration,
} from '../integrations/six-nations/client.js';
import { ProviderError } from '../integrations/http.js';
import { deliverPush, type PushMessage } from '../integrations/notifications/expo.js';

interface JobContext {
  skip?: boolean;
  roundId?: string;
  statisticsRevisionId?: string;
  statistics?: PlayerFixtureStatistics[];
  players?: Player[];
  inputManifest?: Json;
  entries?: { entryId: string; selection: SquadSelection | null }[];
  mode?: 'official' | 'halftime';
  runId?: string;
  approvalId?: string;
  observation?: NormalizedObservation;
  observations?: NormalizedObservation[];
  importText?: string;
  fixtureRequests?: { fixtureId: string; providerFixtureId: string }[];
  messages?: PushMessage[];
}
export function createJobHandler(
  repository: WorkerRepository,
  provider?: {
    config: SixNationsConfiguration;
    headers: Record<string, string>;
    maxRequests: number;
  },
): JobHandler {
  return async (job, lease, signal) => {
    const context = unwrap(await repository.jobContext<JobContext>(lease));
    if (signal.aborted) throw new JobError({ code: 'LEASE_LOST', message: 'Lease renewal failed' });
    if (context.skip) return { skipped: true };
    switch (job.kind) {
      case 'ingest_import': {
        const observation = context.importText
          ? previewImport(context.importText).observation
          : context.observation;
        if (!observation)
          throw new JobError({
            code: 'DATA_INCOMPLETE',
            message: 'Approved import observation missing',
          });
        // Database binds committed import, approval and lease; this does not create an automatic approval.
        return unwrap(await repository.ingestObservation({ ...lease, observation }));
      }
      case 'halftime':
      case 'reconcile':
      case 'recovery': {
        const observations = [...(context.observations ?? [])];
        if (provider && context.fixtureRequests?.length) {
          for (const fixture of context.fixtureRequests) {
            if (signal.aborted)
              throw new JobError({ code: 'LEASE_LOST', message: 'Lease renewal failed' });
            try {
              observations.push(
                await fetchSixNationsObservation(
                  provider.config,
                  fixture.fixtureId,
                  fixture.providerFixtureId,
                  provider.headers,
                  {
                    reserve: async (requestKey) =>
                      unwrap(
                        await repository.reserveRequest({
                          ...lease,
                          provider: 'six-nations',
                          requestKey: `${job.id}:${requestKey}`,
                          opportunityKey: job.id,
                          maxRequests: provider.maxRequests,
                        }),
                      ).reserved,
                  },
                ),
              );
            } catch (error) {
              if (error instanceof ProviderError)
                throw new JobError({
                  code: error.code,
                  message: error.message,
                  retryable: error.code === 'DEPENDENCY_UNAVAILABLE',
                });
              throw error;
            }
          }
        }
        if (!observations.length)
          throw new JobError({
            code: 'PROVIDER_DISABLED',
            message: 'Authorized ingestion source has not been configured',
          });
        const revisions: string[] = [];
        for (const observation of observations) {
          if (signal.aborted)
            throw new JobError({ code: 'LEASE_LOST', message: 'Lease renewal failed' });
          const normalized =
            job.kind === 'halftime'
              ? observation
              : {
                  ...observation,
                  provenance: { source: observation.provenance, label: 'Sunday update' },
                };
          revisions.push(
            unwrap(await repository.ingestObservation({ ...lease, observation: normalized }))
              .statisticsRevisionId,
          );
        }
        return { statisticsRevisionIds: revisions };
      }
      case 'score_round': {
        if (
          !context.roundId ||
          !context.statisticsRevisionId ||
          !context.statistics ||
          !context.players ||
          !context.entries ||
          !context.inputManifest
        )
          throw new JobError({ code: 'DATA_INCOMPLETE', message: 'Scoring inputs missing' });
        const playerScores = context.statistics.map((stat) => {
          const player = context.players!.find((value) => value.id === stat.playerId);
          if (!player)
            throw new JobError({
              code: 'DATA_INCOMPLETE',
              message: 'Player season configuration missing',
            });
          return scorePlayerFixture({ ...stat, position: player.position });
        });
        const complete = playerScores.every((score) => score.scoreHundredths !== null);
        if (!complete)
          throw new JobError({
            code: 'DATA_INCOMPLETE',
            message: 'Required scoring metrics missing',
          });
        const results: EntryRoundResult[] = context.entries.map((entry) =>
          entry.selection
            ? scoreRound(
                entry.entryId,
                entry.selection,
                context.players!,
                context.statistics!,
                context.mode ?? 'official',
              )
            : {
                entryId: entry.entryId,
                scoreHundredths: 0,
                captainBonusHundredths: 0,
                contributingTries: 0,
                effectivePlayerIds: [],
                captainId: null,
              },
        );
        return unwrap(
          await repository.stageRun({
            ...lease,
            roundId: context.roundId,
            statisticsRevisionId: context.statisticsRevisionId,
            inputManifest: context.inputManifest,
            results,
            playerScores,
            complete,
          }),
        );
      }
      case 'publish': {
        if (!context.runId || !context.approvalId)
          throw new JobError({
            code: 'APPROVAL_REQUIRED',
            message: 'Exact scoring run approval required',
          });
        return unwrap(
          await repository.publishRun({
            ...lease,
            runId: context.runId,
            approvalId: context.approvalId,
          }),
        );
      }
      case 'notify': {
        if (!context.messages?.length) return { deliveries: 0 };
        const deliveries = await deliverPush(context.messages, undefined, signal);
        return unwrap(
          await repository.executeJob({
            ...lease,
            kind: job.kind,
            deliveries: deliveries as unknown as Json,
          }),
        ) as Json;
      }
      case 'delete_account': {
        const anonymized = unwrap(await repository.executeJob({ ...lease, kind: job.kind })) as {
          userId?: string;
          anonymized?: boolean;
        };
        if (!anonymized.userId || !anonymized.anonymized)
          throw new JobError({
            code: 'DATA_INCOMPLETE',
            message: 'Account anonymization not confirmed',
          });
        if (signal.aborted)
          throw new JobError({ code: 'LEASE_LOST', message: 'Lease renewal failed' });
        unwrap(await repository.deleteAuthUser(anonymized.userId));
        return unwrap(await repository.executeJob({ ...lease, kind: job.kind, authDeleted: true }));
      }
      case 'lock_round':
      case 'reminder':
      case 'export_account':
        return unwrap(await repository.executeJob({ ...lease, kind: job.kind })) as Json;
    }
  };
}
