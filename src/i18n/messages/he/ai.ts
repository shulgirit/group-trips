/** Hebrew — source of truth for the "ai" namespace. */
const ai = {
  /** Sent to the assistant so it knows who is talking. */
  speaker: "{name} מ{family}",
  untitledChat: "שיחה",
  lookAtPhoto: "תסתכל על התמונה הזו",
  privateNote: "השיחות שלכם פרטיות — רק מה שתשמרו למקומות או ללוח משותף לקבוצה",
  sharedNote: "מכיר את המקומות, הלו״ז ואת כל החבורה",
  newChat: "שיחה חדשה",
  deleteChat: "מחיקת השיחה {title}",
  signInForHistory: "רוצים היסטוריית שיחות פרטית? התחברו עם Google בהגדרות",
  reviews: {
    one: "ביקורת אחת בגוגל",
    other: "{n} ביקורות בגוגל",
  },
  dismiss: "הסר מהתוצאות",
  saved: "נשמר · לפרטים ולשיבוץ",
  savePlace: "הוסף למקומות",
  inPoll: "בסקר",
  toPoll: "לסקר…",
  tellMore: "ספרו לי עוד",
  website: "אתר",
  thinking: "חושב",
  attachedPhoto: "תמונה מצורפת",
  photoWillSend: "התמונה תישלח עם ההודעה",
  removePhoto: "הסרת התמונה",
  attachPhoto: "צירוף תמונה",
  continuePlaceholder: "המשיכו את השיחה…",
  send: "שליחה",
  loadingInfo: "טוען מידע",
  errors: {
    photoRead: "לא הצלחנו לקרוא את התמונה, נסו אחרת",
    placeInfo: "לא הצלחתי להביא מידע כרגע — נסו לסגור ולפתוח שוב",
    timeout:
      "התשובה לקחה יותר מדי זמן או שהחיבור נקטע — השאלה שלכם שמורה, אפשר לנסות שוב",
    uploadFailed: "העלאת התמונה נכשלה, נסו שוב",
    pollFailed: "ההוספה לסקר נכשלה, נסו שוב",
  },
};

export default ai;
