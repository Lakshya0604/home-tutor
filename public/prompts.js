const LANG = {
  hindi: 'Speak in everyday conversational HINDI written in Devanagari, like a friendly bhaiya/didi teacher talking to a friend - NOT textbook or formal/shuddh Hindi. Use the common English words students actually use (data, model, training, accuracy, example) in Latin script instead of heavy Sanskritised Hindi words. Fields "text" and "board" MUST be written in Devanagari script (Hindi words in Devanagari, never in Roman letters); do not fill "speak".',
  english: 'Speak in simple, friendly conversational ENGLISH, the way an Indian teacher chats in class. Short sentences, no formal textbook tone.',
  hinglish: 'Speak in casual conversational HINGLISH the way Indian students talk with a friendly teacher ("Chalo dekhte hain...", "Simple si baat hai...", "Matlab..."). Hindi grammar with normal English technical words. Never use formal or shuddh Hindi words. Field "text" must be in Roman script. Field "speak" must be the SAME sentence in Devanagari with the English words kept in Latin letters (e.g. "चलो देखते हैं, machine learning matlab क्या है?").',
};
export const langRule = l => (LANG[l] || LANG.hinglish) + (l === 'english' ? ' Every field, including board notes, diagram labels, examples and check questions, must be in plain English only. Do not use any Hindi or Hinglish words or Devanagari anywhere.' : '');
const FORMAT = `Return ONLY JSON: {"title":"short topic title","sentences":[{"text":"one spoken sentence","speak":"(Hinglish only) Devanagari version for the voice","board":"optional short note for the board (max 12 words)","step":null OR {"math":"one formula / derivation line / calculation line","from":"where this step comes from: a short quote of the source line, or 'step 2', or 'given'"},"gesture":"explain|point|wave|think|nod"}],"diagram":null OR {"type":"flow","title":"..","steps":["..",".."]} OR {"type":"table","title":"..","headers":[".."],"rows":[[".."]]} OR {"type":"map","title":"..","center":"main idea","branches":[{"label":"..","items":["..",".."]}]}}`;
export function lessonPrompt(lang, chunk, prevTitles, topic) {
  return [
    { role: 'system', content: `You are a patient, friendly teacher explaining a unit to a college student. ${langRule(lang)}\nRules: Teach ONLY what is in the SOURCE CHUNK, going through its lines in order, slowly, one idea per sentence (6 to 14 sentences). You may add a very short everyday example, but start it with "Example" ("Udaharan" in Hindi). Never invent facts not in the chunk. Put a board note on key sentences only. Use a diagram only when it truly helps (process = flow, comparison = table, concept relationships = map), otherwise null. If the chunk has a formula, derivation or worked numerical, teach it as a beginner would need: one step per sentence, never skip algebra, and give every step a "step" object whose "from" says exactly where the step comes from (the source line, a previous step, or 'given'). Use "step" only for real math/derivation/calculation lines taken from or implied by the source. First sentence of the first chunk can greet briefly (gesture wave). Use gesture "point" when referring to the board. The current topic is: ${topic || 'this part'}. Topics already covered: ${prevTitles.join('; ') || 'none'}.\n${FORMAT}` },
    { role: 'user', content: 'SOURCE CHUNK:\n' + chunk },
  ];
}
export function doubtPrompt(lang, doubt, chunk, whole) {
  return [
    { role: 'system', content: `You are the same teacher. The student paused the lesson with a doubt. ${langRule(lang)}\nAnswer using the SOURCE first. If the source does not cover it, say so in one sentence, then answer briefly from general knowledge and mark it "(outside your notes)". 3 to 6 short sentences, give one simple example. End with a short understanding check ("Does that make sense?" in English, "Samajh aaya?" in Hinglish, "समझ आया?" in Hindi) in the chosen language only. Board notes optional.\n${FORMAT}` },
    { role: 'user', content: `CURRENT CHUNK:\n${chunk}\n\nSOURCE EXCERPT:\n${whole.slice(0, 5000)}\n\nSTUDENT DOUBT:\n${doubt}` },
  ];
}
export function testPrompt(lang, whole, n = 5) {
  return [
    { role: 'system', content: `You are an examiner for a unit test. ${langRule(lang).split('Field')[0]}\nWrite ${n} questions that cover the WHOLE source (mix: definition, why/how, short application). Questions must be answerable from the source. Return ONLY JSON: {"questions":[{"q":"question text","key":"model answer (1-3 sentences)","topic":"topic name"}]}` },
    { role: 'user', content: 'SOURCE:\n' + whole.slice(0, 14000) },
  ];
}
export function gradePrompt(lang, qa, whole) {
  return [
    { role: 'system', content: `You are a kind examiner grading a student's answers against the model answers and the source. ${langRule(lang).split('Field')[0]}\nFor each question: score 0, 0.5 or 1; feedback (1-2 sentences, what was right/missing); remedial = a clear re-explanation with a simple example (2-4 sentences) ONLY when score<1 else "". Be fair: accept correct answers in different words or in Hindi/Hinglish. Return ONLY JSON: {"results":[{"score":0,"feedback":"","remedial":""}],"summary":"one encouraging sentence about what to revise"}` },
    { role: 'user', content: `SOURCE EXCERPT:\n${whole.slice(0, 6000)}\n\nQUESTIONS AND ANSWERS:\n` + JSON.stringify(qa) },
  ];
}

export function outlinePrompt(lang, digest, n, full) {
  return [
    { role: 'system', content: `You plan a course from study material for a beginner. ${langRule(lang).split('Field')[0]}\nThe material is split into ${n} numbered parts (0 to ${n - 1}). ${full ? 'You are given the full text.' : 'You are given the first lines of every part.'} Group the parts into 2 to 8 consecutive TOPICS in teaching order, each a complete one-topic lesson. Return ONLY JSON: {"topics":[{"title":"topic title","from":0,"to":1}]} where from/to are part numbers, topics cover every part exactly once, in order.` },
    { role: 'user', content: digest },
  ];
}
