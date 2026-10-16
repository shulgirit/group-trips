import type he from "../he/ai";

const ai: typeof he = {
  speaker: "{name} ({family})",
  untitledChat: "Chat",
  lookAtPhoto: "Take a look at this photo",
  privateNote: "Your chats are private — only what you save to places or the schedule is shared with the group",
  sharedNote: "Knows the places, the schedule and the whole group",
  newChat: "New chat",
  deleteChat: "Delete chat {title}",
  signInForHistory: "Want a private chat history? Sign in with Google in Settings",
  reviews: {
    one: "1 Google review",
    other: "{n} Google reviews",
  },
  dismiss: "Remove from results",
  saved: "Saved · details & scheduling",
  savePlace: "Add to places",
  inPoll: "In a poll",
  toPoll: "Add to poll…",
  tellMore: "Tell me more",
  website: "Website",
  canDo: "What I can do",
  thinking: "Thinking",
  attachedPhoto: "Attached photo",
  photoWillSend: "The photo will be sent with your message",
  removePhoto: "Remove photo",
  attachPhoto: "Attach a photo",
  continuePlaceholder: "Continue the conversation…",
  send: "Send",
  loadingInfo: "Loading details",
  errors: {
    photoRead: "We couldn't read that photo — try another one",
    placeInfo: "Couldn't fetch details right now — close and try again",
    timeout:
      "The reply took too long or the connection dropped — your question is saved, you can try again",
    uploadFailed: "Photo upload failed, please try again",
    pollFailed: "Couldn't add to the poll, please try again",
    failed: "I couldn't answer this time. Try asking again",
    notConfigured: "The guide isn't connected yet. Try again later",
    quota: "Your trip reached its monthly AI limit ({limit} messages). It resets at the start of next month.",
  },
};

export default ai;
