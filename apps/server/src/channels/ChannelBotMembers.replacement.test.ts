import { assert, describe, it } from "@effect/vitest";
import { CommandId, type ThreadId } from "@goat/contracts";
import * as Effect from "effect/Effect";

import * as Orchestrator from "../orchestration-v2/Orchestrator.ts";
import * as ChannelBotMembers from "./ChannelBotMembers.ts";
import * as ChannelLedger from "./ChannelLedger.ts";
import {
  makeHarness,
  modelSelection,
  owner,
  ownerId,
  scratchProjectId,
  setupBot,
} from "./testkit/ChannelHarness.ts";

/** The harness records launches without creating threads; a real launch creates the thread. */
const createThread = (threadId: ThreadId) =>
  Orchestrator.OrchestratorV2.pipe(
    Effect.flatMap((orchestrator) =>
      orchestrator.dispatch({
        type: "thread.create",
        commandId: CommandId.make("create:" + threadId),
        threadId,
        projectId: scratchProjectId,
        title: "Member",
        modelSelection,
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        createdBy: "system",
        creationSource: "server",
      }),
    ),
  );

const deleteThread = (threadId: ThreadId) =>
  Orchestrator.OrchestratorV2.pipe(
    Effect.flatMap((orchestrator) =>
      orchestrator.dispatch({
        type: "thread.delete",
        commandId: CommandId.make("delete:" + threadId),
        threadId,
      }),
    ),
  );

describe("a member bot whose conversation thread was deleted", () => {
  it.effect("moves to a new thread on the next list, and again if that one is deleted", () => {
    const harness = makeHarness();
    return Effect.gen(function* () {
      yield* setupBot;
      const members = yield* ChannelBotMembers.ChannelBotMembers;
      const ledger = yield* ChannelLedger.ChannelLedger;
      const created = yield* members.create(
        {
          clientRequestId: "replace",
          name: "Helper",
          avatar: null,
          purpose: "Checks builds.",
          defaultModelSelection: null,
        },
        owner,
      );
      yield* createThread(created.sessionThreadId);
      const listed = Effect.map(members.list({}, owner), (bots) =>
        bots.find((bot) => bot.botId === created.botId),
      );
      assert.strictEqual((yield* listed)?.sessionThreadId, created.sessionThreadId);

      yield* deleteThread(created.sessionThreadId);
      const second = (yield* listed)?.sessionThreadId;
      assert.isDefined(second);
      assert.notStrictEqual(second, created.sessionThreadId);
      // Ingress and delivery follow the ref, so it must name the same thread the profile lists.
      assert.strictEqual((yield* ledger.getBotById(ownerId, created.botId))?.bot.threadId, second);
      assert.strictEqual((yield* ledger.resolveIngressBot(ownerId, second!))?.botId, created.botId);
      assert.isUndefined(yield* ledger.resolveIngressBot(ownerId, created.sessionThreadId));
      assert.strictEqual((yield* listed)?.sessionThreadId, second);

      yield* createThread(second!);
      yield* deleteThread(second!);
      const third = (yield* listed)?.sessionThreadId;
      assert.notInclude([created.sessionThreadId, second], third);
    }).pipe(Effect.provide(harness.layer));
  });
});
