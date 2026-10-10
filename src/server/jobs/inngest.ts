import "server-only";
import { Inngest } from "inngest";
import { dueAccountEmails, processAccountEmail } from "./account-email";
import { getDatabase } from "@/server/db/connection";

export const inngest = new Inngest({ id: "kalyanapura", logger: { info() {}, warn() {}, error() {}, debug() {} } });
export async function dispatchAccountEmails() {
  const db = await getDatabase();
  const jobs = await db.collection("background_jobs").find({ kind: "email", weddingId: null, state: "queued", dispatchState: "pending", nextDispatchAt: { $lte: new Date() }, "email.type": { $in: ["auth_verification", "auth_reset"] } }, { projection: { _id: 1 } }).limit(25).toArray();
  for (const job of jobs) {
    try {
      await inngest.send({ name: "accounts/email.queued", data: { id: job._id.toHexString() } });
      await db.collection("background_jobs").updateOne({ _id: job._id }, { $set: { dispatchState: "published" }, $inc: { dispatchAttempts: 1 } });
    } catch {
      await db.collection("background_jobs").updateOne({ _id: job._id }, { $set: { nextDispatchAt: new Date(Date.now() + 60000) }, $inc: { dispatchAttempts: 1 } });
    }
  }
}
export const accountEmail = inngest.createFunction({ id: "account-email", triggers: { event: "accounts/email.queued" }, concurrency: 2 }, async ({ event, step }) => {
  await step.run("deliver", () => processAccountEmail(String(event.data.id)));
});
export const reconcileAccountEmails = inngest.createFunction({ id: "reconcile-account-email", triggers: { cron: "*/1 * * * *" }, concurrency: 1 }, async ({ step }) => {
  const jobs = await step.run("find-due", async () => (await dueAccountEmails()).map((job) => job._id.toHexString()));
  for (const id of jobs) await step.run(`deliver-${id}`, () => processAccountEmail(id));
});
