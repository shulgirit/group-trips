import type he from "../he/server";

const server: typeof he = {
  push: {
    welcomeTitle: "Notifications are on",
    welcomeBody: "We'll let you know about new polls and remind you before every activity",
    pollTitle: "New group poll",
    pollOptionTitle: "New option in the group poll",
    pollOptionBody: "{title} · Cast your vote",
    eventTitle: "Added to the schedule",
    aiEventTitle: "{ai} added to the schedule",
    ideasUpdatedTitle: "The group's ideas poll was updated",
    andMore: "and {count} more",
    reminderTitle: "In {minutes} min: {title}",
    navigate: "Navigate",
  },
  booking: {
    checkIn: "Check-in",
    checkOut: "Check-out",
    importer: "Booking import",
  },
};

export default server;
