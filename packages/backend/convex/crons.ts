import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Event reminders are scheduled per event (events.remind); only cleanups run here.
crons.interval("expired shared locations", { minutes: 15 }, internal.locations.deleteExpired);
crons.daily("exchange rates", { hourUTC: 4, minuteUTC: 17 }, internal.rates.refresh);

export default crons;
