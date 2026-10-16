import { describe, expect, it } from "vitest";
import { planBooking } from "../src/booking";

const labels = { checkIn: "Check-in", checkOut: "Check-out" };
const base = {
  title: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  location: "",
  city: "",
  confirmationCode: "",
  flightNumber: "",
  from: "",
  to: "",
  travelers: [],
  notes: "",
};

describe("planBooking", () => {
  it("a flight: one event with the flight number, route and duration, no venue", () => {
    const plan = planBooking(
      { ...base, kind: "flight", title: "Flight to Rome", flightNumber: "LY381", startDate: "2026-08-15", startTime: "9:35", endDate: "2026-08-15", endTime: "12:50", from: "Tel Aviv (TLV)", to: "Rome (FCO)" },
      labels
    );
    expect(plan.venue).toBeNull();
    expect(plan.events).toEqual([
      { title: "Flight to Rome · LY381", emoji: "plane", day: "2026-08-15", startTime: "09:35", durationMin: 195, notes: "Tel Aviv (TLV) ← Rome (FCO)" },
    ]);
  });

  it("a stay: accommodation venue, check-in (15:00 default) and check-out", () => {
    const plan = planBooking(
      { ...base, kind: "lodging", title: "מלון Villa Maria", location: "Via Roma 1", city: "Taormina", startDate: "2026-08-15", endDate: "2026-08-20" },
      labels
    );
    expect(plan.venue).toMatchObject({ name: "Villa Maria", category: "accommodation", stayFrom: "2026-08-15", stayTo: "2026-08-20", lodging: true });
    expect(plan.events.map((e) => [e.title, e.day, e.startTime])).toEqual([
      ["Check-in · Villa Maria", "2026-08-15", "15:00"],
      ["Check-out · Villa Maria", "2026-08-20", "11:00"],
    ]);
  });

  it("an undated item keeps its venue but creates no events", () => {
    const plan = planBooking({ ...base, kind: "restaurant", title: "Trattoria da Nino" }, labels);
    expect(plan.venue?.category).toBe("restaurant");
    expect(plan.events).toEqual([]);
  });
});
