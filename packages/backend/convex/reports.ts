import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { resend } from "./email";
import { fail } from "./lib/authz";
import { tripMutation } from "./lib/functions";

const REPORT_TO = process.env.REPORTS_TO ?? "support@togethergroup.app";
const FROM = process.env.AUTH_EMAIL_FROM ?? "Together <no-reply@togethergroup.app>";

/**
 * "Report" on an AI reply, a place or a member. Stored for review and emailed to support, so the
 * owner can act within a day (required for apps with user-generated content).
 */
export const submit = tripMutation({
  args: {
    kind: v.union(v.literal("ai_reply"), v.literal("place"), v.literal("member"), v.literal("other")),
    targetId: v.string(),
    excerpt: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const excerpt = args.excerpt.trim().slice(0, 500);
    if (!args.targetId || args.targetId.length > 80) fail("invalid", "target");
    // A person can't flood the inbox: at most 20 reports a day
    const since = Date.now() - 86_400_000;
    const mine = await ctx.db
      .query("reports")
      .withIndex("by_trip", (q) => q.eq("tripId", ctx.tripId).gt("createdAt", since))
      .collect();
    if (mine.filter((row) => row.reporterId === ctx.user._id).length >= 20) fail("limit", "too_many_reports");
    const id = await ctx.db.insert("reports", {
      tripId: ctx.tripId,
      reporterId: ctx.user._id,
      kind: args.kind,
      targetId: args.targetId,
      excerpt,
      reason: (args.reason ?? "").trim().slice(0, 500),
      status: "open",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.reports.notify, { reportId: id });
    return { id };
  },
});

export const notify = internalAction({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    try {
      const row = await ctx.runQuery(internal.reportsData.get, { reportId });
      if (!row) return;
      const html = `<p><b>${row.kind}</b> reported in trip <code>${row.tripName}</code> by ${row.reporterName}</p>
<blockquote>${row.excerpt.replace(/</g, "&lt;")}</blockquote><p>${row.reason.replace(/</g, "&lt;")}</p>
<p>Report id: ${row.id} · target: ${row.targetId}</p>`;
      await resend.sendEmail(ctx, { from: FROM, to: REPORT_TO, subject: `[Together] Report: ${row.kind}`, html });
    } catch (error) {
      // The report is already stored; delivery problems must never lose it
      console.error("[reports] email failed", error);
    }
  },
});
