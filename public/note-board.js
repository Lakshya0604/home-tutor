// A board summary is a second interpretation. In detailed-note lessons use
// the complete English teaching sentence instead, keeping its qualifications.
// This is display identity, not source-faithfulness or translation validation.
export function noteBoardText(sentence, topicMode = false) {
  return topicMode ? sentence.board : (sentence.board?.trim() ? sentence.text : '');
}
