import type he from "../he/common";

const common: typeof he = {
  appName: "Together",
  tagline: "Your group trip, all in one place",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
  close: "Close",
  confirm: {
    irreversible: "This cannot be undone",
    typeToConfirm: "To confirm, type {word}",
    working: "Deleting…",
    word: "DELETE",
  },
  delete: "Delete",
  edit: "Edit",
  back: "Back",
  next: "Next",
  continue: "Continue",
  done: "Done",
  later: "Later",
  loading: "Loading…",
  retry: "Try again",
  copy: "Copy",
  copied: "Copied",
  share: "Share",
  search: "Search",
  all: "All",
  everyone: "Everyone",
  yes: "Yes",
  no: "No",
  or: "or",
  today: "Today",
  tomorrow: "Tomorrow",
  errors: {
    generic: "Something went wrong. Try again",
    network: "You're offline. Check your connection and try again",
    saveFailed: "Couldn't save. Try again",
    connection: "Can't reach your trip data. Check your connection and refresh",
  },
  language: {
    title: "Language",
    hint: "Menus and buttons. Content your group wrote stays as written.",
  },
};

export default common;
