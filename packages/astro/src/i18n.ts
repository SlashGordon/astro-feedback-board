export type Lang = "de" | "en" | "es";

export interface Strings {
  buttonLabel: string;
  dialogTitle: string;
  close: string;
  placeholder: string;
  nicknameLabel: string;
  nicknamePlaceholder: string;
  remember: string;
  remembered: string;
  privacyHint: string;
  privacyLink: string;
  forgetDevice: string;
  forgetConfirm: string;
  forgotten: string;
  submit: string;
  sending: string;
  thanksPending: string;
  thanksApproved: string;
  errorTooShort: string;
  errorTooLong: string;
  errorTooManyLinks: string;
  errorNicknameEmail: string;
  errorNicknamePhone: string;
  thanksCommentPending: string;
  thanksCommentApproved: string;
  commentsTitle: string;
  commentFormTitle: string;
  commentPlaceholder: string;
  commentsEmpty: string;
  commentsOne: string;
  commentsOther: string;
  reactionsLabel: string;
  reactionLike: string;
  reactionUnicorn: string;
  reactionMindblown: string;
  reactionClap: string;
  reactionFire: string;
  mineComment: string;
  openArticle: string;
  promptQuestion: string;
  promptGive: string;
  promptLater: string;
  errorRateLimited: string;
  errorDailyLimit: string;
  errorTooManyPending: string;
  errorAlreadyReacted: string;
  errorPaused: string;
  errorGeneric: string;
  kindLabel: string;
  kindFeedback: string;
  kindIdea: string;
  kindBug: string;
  placeholderIdea: string;
  placeholderBug: string;
  replyPlaceholder: string;
  thanksReplyPending: string;
  thanksReplyApproved: string;
  myPostsLink: string;
  newPost: string;
  filterAll: string;
  sortLabel: string;
  sortTop: string;
  sortNew: string;
  statusLabel: string;
  statusAll: string;
  statusOpen: string;
  statusPlanned: string;
  statusInProgress: string;
  statusDone: string;
  statusDeclined: string;
  votesOne: string;
  votesOther: string;
  vote: string;
  unvote: string;
  repliesOne: string;
  repliesOther: string;
  noReplies: string;
  replyTitle: string;
  replyFormTitle: string;
  back: string;
  loading: string;
  loadError: string;
  empty: string;
  team: string;
  mine: string;
  minePending: string;
  mineApproved: string;
  mineRejected: string;
  mineReplyTo: string;
  newRepliesOne: string;
  newRepliesOther: string;
  openThread: string;
  deletePost: string;
  deleteConfirm: string;
  anonymous: string;
}

export const strings: Record<Lang, Strings> = {
  de: {
    buttonLabel: "Feedback",
    dialogTitle: "Feedback geben",
    close: "Schließen",
    placeholder: "Was können wir besser machen?",
    nicknameLabel: "Name (optional)",
    nicknamePlaceholder: "Anonym",
    remember: "Auf diesem Gerät merken, damit ich Antworten sehe",
    remembered: "Dieses Gerät ist gemerkt.",
    privacyHint:
      "Freigegebenes Feedback ist öffentlich sichtbar. Bitte keine persönlichen Daten wie E-Mail-Adresse oder Telefonnummer eintragen.",
    privacyLink: "Datenschutz",
    forgetDevice: "Vergessen",
    forgetConfirm: "Alle deine Beiträge und Reaktionen löschen und dieses Gerät vergessen?",
    forgotten: "Erledigt. Deine Beiträge sind gelöscht und dieses Gerät ist vergessen.",
    submit: "Senden",
    sending: "Wird gesendet …",
    thanksPending: "Danke! Wir schauen uns dein Feedback an und schalten es dann frei.",
    thanksApproved: "Danke! Dein Feedback ist jetzt sichtbar.",
    errorTooShort: "Bitte schreib mindestens {n} Zeichen.",
    errorTooLong: "Bitte schreib höchstens {n} Zeichen.",
    errorTooManyLinks: "Bitte füge höchstens {n} Links ein.",
    errorNicknameEmail: "Der Name ist öffentlich. Bitte gib keine E-Mail-Adresse an.",
    errorNicknamePhone: "Der Name ist öffentlich. Bitte gib keine Telefonnummer an.",
    errorRateLimited: "Das waren viele Beiträge in kurzer Zeit. Bitte versuch es in einer Minute noch einmal.",
    errorDailyLimit: "Von deinem Anschluss kamen heute schon viele Beiträge. Bitte versuch es morgen noch einmal.",
    errorTooManyPending: "Deine letzten Beiträge warten noch auf Freigabe. Sobald wir sie angeschaut haben, kannst du wieder schreiben.",
    errorAlreadyReacted: "Von deinem Anschluss kam heute schon diese Reaktion.",
    errorPaused: "Beiträge sind hier gerade pausiert. Bitte versuch es später noch einmal.",
    errorGeneric: "Das hat nicht geklappt. Bitte versuch es später noch einmal.",
    kindLabel: "Art des Beitrags",
    kindFeedback: "Feedback",
    kindIdea: "Idee",
    kindBug: "Fehler",
    placeholderIdea: "Welche Funktion wünschst du dir?",
    placeholderBug: "Was ist passiert und was hast du erwartet?",
    replyPlaceholder: "Deine Antwort …",
    thanksReplyPending: "Danke! Wir schauen uns deine Antwort an und schalten sie dann frei.",
    thanksReplyApproved: "Danke! Deine Antwort ist jetzt sichtbar.",
    myPostsLink: "Deine Beiträge und Antworten",
    newPost: "Neuen Beitrag schreiben",
    filterAll: "Alle",
    sortLabel: "Sortierung",
    sortTop: "Beliebt",
    sortNew: "Neu",
    statusLabel: "Status",
    statusAll: "Alle Status",
    statusOpen: "Offen",
    statusPlanned: "Geplant",
    statusInProgress: "In Arbeit",
    statusDone: "Erledigt",
    statusDeclined: "Abgelehnt",
    votesOne: "1 Stimme",
    votesOther: "{n} Stimmen",
    vote: "Dafür stimmen",
    unvote: "Stimme zurücknehmen",
    repliesOne: "1 Antwort",
    repliesOther: "{n} Antworten",
    noReplies: "Noch keine Antworten.",
    replyTitle: "Antworten",
    replyFormTitle: "Antwort schreiben",
    back: "Zurück zur Übersicht",
    loading: "Lädt …",
    loadError: "Das Laden hat nicht geklappt. Bitte versuch es später noch einmal.",
    empty: "Hier gibt es noch keine Beiträge.",
    team: "Team",
    mine: "Deine Beiträge",
    minePending: "Wartet auf Freigabe",
    mineApproved: "Veröffentlicht",
    mineRejected: "Nicht veröffentlicht",
    mineReplyTo: "Antwort auf",
    newRepliesOne: "1 neue Antwort",
    newRepliesOther: "{n} neue Antworten",
    openThread: "Zum Beitrag",
    deletePost: "Löschen",
    deleteConfirm: "Diesen Beitrag endgültig löschen?",
    anonymous: "Anonym",
    thanksCommentPending: "Danke! Dein Kommentar erscheint, sobald er freigegeben ist.",
    thanksCommentApproved: "Danke! Dein Kommentar ist veröffentlicht.",
    commentsTitle: "Kommentare",
    commentFormTitle: "Kommentar schreiben",
    commentPlaceholder: "Was denkst du über den Artikel?",
    commentsEmpty: "Noch keine Kommentare. Schreib den ersten.",
    commentsOne: "{n} Kommentar",
    commentsOther: "{n} Kommentare",
    reactionsLabel: "Wie fandest du den Artikel?",
    reactionLike: "Gefällt mir",
    reactionUnicorn: "Einhorn",
    reactionMindblown: "Umgehauen",
    reactionClap: "Applaus",
    reactionFire: "Feuer",
    mineComment: "Kommentar",
    openArticle: "Zum Artikel",
    promptQuestion: "Du bist schon eine Weile hier. Magst du uns kurz sagen, wie es läuft?",
    promptGive: "Feedback geben",
    promptLater: "Nicht jetzt",
  },
  en: {
    buttonLabel: "Feedback",
    dialogTitle: "Send feedback",
    close: "Close",
    placeholder: "What could we do better?",
    nicknameLabel: "Name (optional)",
    nicknamePlaceholder: "Anonymous",
    remember: "Remember this device so I can see replies",
    remembered: "This device is remembered.",
    privacyHint:
      "Approved feedback is public. Please don't include personal data such as your email address or phone number.",
    privacyLink: "Privacy policy",
    forgetDevice: "Forget",
    forgetConfirm: "Delete all your posts and reactions and forget this device?",
    forgotten: "Done. Your posts are deleted and this device is forgotten.",
    submit: "Send",
    sending: "Sending …",
    thanksPending: "Thanks! We'll review your feedback and then publish it.",
    thanksApproved: "Thanks! Your feedback is now visible.",
    errorTooShort: "Please write at least {n} characters.",
    errorTooLong: "Please write at most {n} characters.",
    errorTooManyLinks: "Please include at most {n} links.",
    errorNicknameEmail: "Your name is public. Please don't enter an email address.",
    errorNicknamePhone: "Your name is public. Please don't enter a phone number.",
    errorRateLimited: "That was a lot of posts in a short time. Please try again in a minute.",
    errorDailyLimit: "Your connection has sent a lot of posts today. Please try again tomorrow.",
    errorTooManyPending: "Your last posts are still waiting for review. You can post again once we've looked at them.",
    errorAlreadyReacted: "Your connection already sent this reaction today.",
    errorPaused: "Posting is paused here right now. Please try again later.",
    errorGeneric: "Something went wrong. Please try again later.",
    kindLabel: "Type of post",
    kindFeedback: "Feedback",
    kindIdea: "Idea",
    kindBug: "Bug",
    placeholderIdea: "Which feature would you like to see?",
    placeholderBug: "What happened, and what did you expect?",
    replyPlaceholder: "Your reply …",
    thanksReplyPending: "Thanks! We'll review your reply and then publish it.",
    thanksReplyApproved: "Thanks! Your reply is now visible.",
    myPostsLink: "Your posts and replies",
    newPost: "Write a new post",
    filterAll: "All",
    sortLabel: "Sort by",
    sortTop: "Top",
    sortNew: "New",
    statusLabel: "Status",
    statusAll: "Any status",
    statusOpen: "Open",
    statusPlanned: "Planned",
    statusInProgress: "In progress",
    statusDone: "Done",
    statusDeclined: "Declined",
    votesOne: "1 vote",
    votesOther: "{n} votes",
    vote: "Vote for this",
    unvote: "Remove vote",
    repliesOne: "1 reply",
    repliesOther: "{n} replies",
    noReplies: "No replies yet.",
    replyTitle: "Replies",
    replyFormTitle: "Write a reply",
    back: "Back to overview",
    loading: "Loading …",
    loadError: "Loading failed. Please try again later.",
    empty: "No posts yet.",
    team: "Team",
    mine: "Your posts",
    minePending: "Waiting for approval",
    mineApproved: "Published",
    mineRejected: "Not published",
    mineReplyTo: "Reply to",
    newRepliesOne: "1 new reply",
    newRepliesOther: "{n} new replies",
    openThread: "View thread",
    deletePost: "Delete",
    deleteConfirm: "Delete this post permanently?",
    anonymous: "Anonymous",
    thanksCommentPending: "Thanks! Your comment appears once it is approved.",
    thanksCommentApproved: "Thanks! Your comment is published.",
    commentsTitle: "Comments",
    commentFormTitle: "Write a comment",
    commentPlaceholder: "What do you think about this article?",
    commentsEmpty: "No comments yet. Write the first one.",
    commentsOne: "{n} comment",
    commentsOther: "{n} comments",
    reactionsLabel: "How did you like this article?",
    reactionLike: "Like",
    reactionUnicorn: "Unicorn",
    reactionMindblown: "Mind blown",
    reactionClap: "Applause",
    reactionFire: "Fire",
    mineComment: "Comment",
    openArticle: "Open article",
    promptQuestion: "You've been here for a while. Would you tell us how it's going?",
    promptGive: "Give feedback",
    promptLater: "Not now",
  },
  es: {
    buttonLabel: "Comentarios",
    dialogTitle: "Enviar comentarios",
    close: "Cerrar",
    placeholder: "¿Qué podemos mejorar?",
    nicknameLabel: "Nombre (opcional)",
    nicknamePlaceholder: "Anónimo",
    remember: "Recordar este dispositivo para ver las respuestas",
    remembered: "Este dispositivo está recordado.",
    privacyHint:
      "Los comentarios aprobados son públicos. Por favor, no incluyas datos personales como tu correo electrónico o número de teléfono.",
    privacyLink: "Privacidad",
    forgetDevice: "Olvidar",
    forgetConfirm: "¿Borrar todas tus publicaciones y reacciones y olvidar este dispositivo?",
    forgotten: "Listo. Tus publicaciones se han borrado y este dispositivo se ha olvidado.",
    submit: "Enviar",
    sending: "Enviando …",
    thanksPending: "¡Gracias! Revisaremos tu comentario y después lo publicaremos.",
    thanksApproved: "¡Gracias! Tu comentario ya es visible.",
    errorTooShort: "Escribe al menos {n} caracteres.",
    errorTooLong: "Escribe como máximo {n} caracteres.",
    errorTooManyLinks: "Incluye como máximo {n} enlaces.",
    errorNicknameEmail: "Tu nombre es público. No indiques una dirección de correo.",
    errorNicknamePhone: "Tu nombre es público. No indiques un número de teléfono.",
    errorRateLimited: "Demasiadas publicaciones en poco tiempo. Inténtalo de nuevo en un minuto.",
    errorDailyLimit: "Hoy ya llegaron muchas publicaciones desde tu conexión. Inténtalo de nuevo mañana.",
    errorTooManyPending: "Tus últimas publicaciones siguen pendientes de revisión. Podrás publicar de nuevo cuando las hayamos revisado.",
    errorAlreadyReacted: "Hoy ya llegó esta reacción desde tu conexión.",
    errorPaused: "Las publicaciones están en pausa ahora mismo. Inténtalo de nuevo más tarde.",
    errorGeneric: "Algo salió mal. Inténtalo de nuevo más tarde.",
    kindLabel: "Tipo de publicación",
    kindFeedback: "Comentario",
    kindIdea: "Idea",
    kindBug: "Error",
    placeholderIdea: "¿Qué función te gustaría tener?",
    placeholderBug: "¿Qué pasó y qué esperabas?",
    replyPlaceholder: "Tu respuesta …",
    thanksReplyPending: "¡Gracias! Revisaremos tu respuesta y después la publicaremos.",
    thanksReplyApproved: "¡Gracias! Tu respuesta ya es visible.",
    myPostsLink: "Tus publicaciones y respuestas",
    newPost: "Escribir una publicación",
    filterAll: "Todo",
    sortLabel: "Ordenar por",
    sortTop: "Populares",
    sortNew: "Recientes",
    statusLabel: "Estado",
    statusAll: "Cualquier estado",
    statusOpen: "Abierto",
    statusPlanned: "Planificado",
    statusInProgress: "En curso",
    statusDone: "Hecho",
    statusDeclined: "Descartado",
    votesOne: "1 voto",
    votesOther: "{n} votos",
    vote: "Votar",
    unvote: "Quitar voto",
    repliesOne: "1 respuesta",
    repliesOther: "{n} respuestas",
    noReplies: "Todavía no hay respuestas.",
    replyTitle: "Respuestas",
    replyFormTitle: "Escribir una respuesta",
    back: "Volver al resumen",
    loading: "Cargando …",
    loadError: "No se pudo cargar. Inténtalo de nuevo más tarde.",
    empty: "Todavía no hay publicaciones.",
    team: "Equipo",
    mine: "Tus publicaciones",
    minePending: "Pendiente de aprobación",
    mineApproved: "Publicado",
    mineRejected: "No publicado",
    mineReplyTo: "Respuesta a",
    newRepliesOne: "1 respuesta nueva",
    newRepliesOther: "{n} respuestas nuevas",
    openThread: "Ver hilo",
    deletePost: "Eliminar",
    deleteConfirm: "¿Eliminar esta publicación para siempre?",
    anonymous: "Anónimo",
    thanksCommentPending: "¡Gracias! Tu comentario aparecerá cuando se apruebe.",
    thanksCommentApproved: "¡Gracias! Tu comentario está publicado.",
    commentsTitle: "Comentarios",
    commentFormTitle: "Escribe un comentario",
    commentPlaceholder: "¿Qué opinas del artículo?",
    commentsEmpty: "Aún no hay comentarios. Escribe el primero.",
    commentsOne: "{n} comentario",
    commentsOther: "{n} comentarios",
    reactionsLabel: "¿Qué te pareció el artículo?",
    reactionLike: "Me gusta",
    reactionUnicorn: "Unicornio",
    reactionMindblown: "Alucinante",
    reactionClap: "Aplausos",
    reactionFire: "Fuego",
    mineComment: "Comentario",
    openArticle: "Ver artículo",
    promptQuestion: "Llevas un rato por aquí. ¿Nos cuentas qué tal te va?",
    promptGive: "Dar feedback",
    promptLater: "Ahora no",
  },
};

export function resolveStrings(lang: string | undefined, overrides?: Partial<Strings>): Strings {
  const base = strings[(lang?.slice(0, 2) as Lang) ?? "en"] ?? strings.en;
  return { ...base, ...overrides };
}

/** Picks the singular or plural string and fills in {n}. */
export function plural(count: number, one: string, other: string): string {
  return (count === 1 ? one : other).replace("{n}", String(count));
}
