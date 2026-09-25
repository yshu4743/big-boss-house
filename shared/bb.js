// ---------------------------------------------------------------------------
// BIGG BOSS BRAIN — server only. This module is NEVER sent to the browser.
// It holds the Bigg Boss persona (announcements, orders, reactions) and the
// Malayalam cinema task bank. Answers stay secret on the server.
//
// The "AI" here is a directive-driven director: it watches housemate count,
// proximity and behaviour, picks the next act (knowledge game or group
// formation order), times them, and reacts with personality. Swapping in a
// real LLM later only requires replacing the text generators below with API
// calls (every decision point already keeps the needed context in `bb`).
// ---------------------------------------------------------------------------

export const MODES = ['trivia', 'picture', 'word'];
export const MODE_LABEL = {
  trivia: 'CINEMA TRIVIA',
  picture: 'PICTURE ROUND',
  word: 'WORD PLAY',
};

export const ACT = {
  WELCOME: 3000,     // ms of welcome preamble
  ANNOUNCE: 3800,    // ms before an act goes live
  GAME_MS: { trivia: 20000, picture: 20000, word: 30000 },
  GAME_REVEAL: 8000,
  ORDER_MS: { pair: 26000, trio: 30000, all: 24000 },
  COOK_MS: 38000,    // cooking act length
  CHORE_MS: 36000,   // cleaning act length
  ACT_SEQ: ['order', 'chore', 'cook', 'game'], // cycles 1..4,4..
};

export const POINTS = {
  correct: 100,      // coins for a right game answer
  fastMax: 60,       // time bonus up to this
  shout: 40,         // answering a word round by shouting in chat
  group: 50,         // each member of a formed group (order success)
  chore: 10,         // per dirt spot cleaned
  choreChamp: 30,    // most spots cleaned in a chore
  attend: 5,         // simply being at the event spot when it opens
  penalty: 10,       // non-completion cost
};

// ------------------------------- TRIVIA ------------------------------------
export const TRIVIA = [
  {
    q: 'Which Malayalam film won the first National Award for Best Feature Film?',
    options: ['Chemmeen (1965)', 'Balan (1938)', 'Newspaper Boy (1955)', 'Kireedam (1989)'],
    a: 0,
    fact: 'Chemmeen, directed by Ramu Kariat from Thakazhi Sivasankara Pillai\u2019s novel, put Malayalam cinema on the national map.',
  },
  {
    q: 'Who played Ganga \u2014 the woman who \u201cappears\u201d as Nagavalli \u2014 in Manichitrathazhu?',
    options: ['Shobana', 'Revathi', 'Urvashi', 'Nandita Das'],
    a: 0,
    fact: 'Shobana won a National Award for this path-breaking double role in 1993.',
  },
  {
    q: 'Who directed Kireedam (1989)?',
    options: ['Sibi Malayil', 'Priyadarshan', 'Hariharan', 'Kamal'],
    a: 0,
    fact: 'Sibi Malayil + Lohithadas = the tragic masterpiece that gave Mohanlal\u2019s Sethumadhavan.',
  },
  {
    q: 'Fahadh Faasil plays a loveable gang-leader in which 2024 blockbuster?',
    options: ['Aavesham', 'Romancham', '2018', 'Naradan'],
    a: 0,
    fact: 'Aavesham was one of the biggest hits of 2024 \u2014 and Fahadh plays Ranga in it.',
  },
  {
    q: 'Who directed Drishyam (2013)?',
    options: ['Jeethu Joseph', 'Jibu Jacob', 'Arun Gopy', 'Shaji Kailas'],
    a: 0,
    fact: 'Jeethu Joseph\u2019s Drishyam became a phenomenon, remade in four languages.',
  },
  {
    q: 'Mohanlal won a National Award for Best Actor for which film?',
    options: ['Vanaprastham (1999)', 'Drishyam (2013)', 'Kireedam (1989)', 'Thanmathra (2005)'],
    a: 0,
    fact: 'He played Kunhikuttan, a Kathakali artist, in Shaji N. Karun\u2019s Vanaprastham.',
  },
  {
    q: 'In Ustad Hotel, which dish makes Faizi\u2019s restaurant famous?',
    options: ['Biryani', 'Parotta', 'Appam', 'Puttu'],
    a: 0,
    fact: 'Kabeer\u2019s secret biryani recipe is the soul of the film \u2014 and of the finale.',
  },
  {
    q: 'Who sang the chartbuster \u201cMalare\u201d from Premam?',
    options: ['Vineeth Sreenivasan', 'Shaan Rahman', 'Rajesh Murugesan', 'Hesham Abdul Wahab'],
    a: 0,
    fact: 'Music by Rajesh Murugesan \u2014 but it\u2019s Vineeth\u2019s voice that made Malar\u2019s intro iconic.',
  },
  {
    q: 'The film 2018 recreates which calamity on screen?',
    options: ['The Kerala floods', 'The 2004 tsunami', 'A cyclone', 'A landslide'],
    a: 0,
    fact: 'Jude Anthany Joseph\u2019s 2018 re-enacted the great flood that united Kerala.',
  },
  {
    q: 'Bangalore Days (2014) was directed by whom?',
    options: ['Anjali Menon', 'Aashiq Abu', 'Dileesh Pothan', 'Bejoy Nambiar'],
    a: 0,
    fact: 'Anjali Menon\u2019s road-trip favourite with Dulquer, Fahadh and Nivin.',
  },
  {
    q: 'Who played the wandering artist Charlie (Kuruvi) in the 2015 film?',
    options: ['Dulquer Salmaan', 'Nivin Pauly', 'Fahadh Faasil', 'Unni Mukundan'],
    a: 0,
    fact: 'Dulquer\u2019s Charlie ran over 100 days in Kerala.',
  },
  {
    q: 'Which director made My Dear Kuttichathan (1984) \u2014 the first Malayalam 3D film?',
    options: ['Jijo Punnoose', 'Fazil', 'P. Padmarajan', 'I. V. Sasi'],
    a: 0,
    fact: 'Jijo Punnoose\u2019s child-genie was a landmark in Indian 3D cinema.',
  },
  {
    q: 'Which film marked Prithviraj Sukumaran\u2019s directorial debut?',
    options: ['Lucifer', 'Driving License', 'Ezra', 'Ayyappanum Koshiyum'],
    a: 0,
    fact: 'Lucifer (2019) \u2014 Stephen Nedumpally enters, the box office shudders.',
  },
  {
    q: 'Kumbalangi Nights (2019) was the directorial debut of whom?',
    options: ['Madhu C. Narayanan', 'Lijo Jose Pellissery', 'Dileesh Pothan', 'Basil Joseph'],
    a: 0,
    fact: 'Written by Syam Pushkaran, it made Shammi a pop-culture icon.',
  },
  {
    q: 'Angamaly Diaries is famous for its epic long-take. Who directed it?',
    options: ['Lijo Jose Pellissery', 'Rajeev Ravi', 'Aashiq Abu', 'Sanu John Varghese'],
    a: 0,
    fact: 'The 70-plus-actor single-shot sequence was shot by Girish Gangadharan.',
  },
  {
    q: 'Mammootty won a National Award for Best Actor for which 2010 crime drama?',
    options: ['Paleri Manikyam', 'Pranchiyettan & the Saint', 'Best Actor', 'Kazhcha'],
    a: 0,
    fact: 'Paleri Manikyam: Oru Pathirakolapathakathinte Katha \u2014 Mammootty again, at his best.',
  },
];

// ------------------------------- PICTURE -----------------------------------
export const PICTURE = [
  {
    emoji: '\u{1F3E1}\u{1F56F}\u{1F9DD}\u{1F511}',
    q: 'A haunted mansion, a hidden maze, a woman who \u201cappears\u201d. Which film?',
    options: ['Manichitrathazhu', 'Yakshiyum Njanum', 'Akashaganga', 'Novel'],
    a: 0,
    fact: 'The 1993 classic \u2014 India\u2019s most-remade Malayalam film.',
  },
  {
    emoji: '\u{1F35B}\u{1F468}\u{1F474}\u{2B50}',
    q: 'A grandfather, his grandson and a biryani legacy that travels the world. Which film?',
    options: ['Ustad Hotel', 'Spirit', 'Randaamoozham', '1983'],
    a: 0,
    fact: 'Dulquer\u2019s Faizi and Thilakan\u2019s Kabeer \u2014 food as heritage.',
  },
  {
    emoji: '\u{1F3A8}\u{1F98B}\u2708\u{1F319}',
    q: 'A free-spirited artist who draws butterflies \u2014 every girl he loves takes a flight. Which film?',
    options: ['Charlie', 'Thoppil Joppan', 'Aadu', 'Kammatipaadam'],
    a: 0,
    fact: 'Dulquer as Kuruvi in Martin Prakkat\u2019s free-wheeling 2015 hit.',
  },
  {
    emoji: '\u{1F393}\u{1F4DA}\u{1F497}',
    q: 'Campus romance across three stages of life \u2014 the \u201cMalare\u201d era. Which film?',
    options: ['Premam', 'Ohm Shanthi Oshaana', 'Jacobinte Swargarajyam', 'Thatteem Mutteem'],
    a: 0,
    fact: 'Nivin Pauly\u2019s George, one of Malayalam\u2019s most loved romance films.',
  },
  {
    emoji: '\u{1F3A3}\u{1F33E}\u{1F46C}',
    q: 'Four brothers by the covered wells \u2014 haunted by a \u201crole model\u201d named Shammi. Which film?',
    options: ['Kumbalangi Nights', 'Angamaly Diaries', 'Kummatti', 'Thondimuthalum Driksakshiyum'],
    a: 0,
    fact: 'Fahadh\u2019s Shammi \u2014 cinema\u2019s most unforgettable brother-in-law.',
  },
  {
    emoji: '\u{1F30A}\u{1F5F3}\u{1F981}',
    q: 'A casino king steps into politics as Stephen Nedumpally \u2014 the storm that followed. Which film?',
    options: ['Lucifer', 'Bheeshma Parvam', 'Arattu', 'Empuraan'],
    a: 0,
    fact: 'Lucifer \u2014 a new villain for the big screen, and a mega-franchise was born.',
  },
];

// -------------------------------- WORD --------------------------------------
export const WORD = [
  {
    kind: 'anagram',
    title: 'MANICHITRATHAZU',
    q: 'Unscramble this Malayalam film title \u2014 the haunted-mansion classic.',
    hint: '1993 \u00b7 Shobana \u00b7 Fazil',
    accepts: ['manichitrathazhu', 'manichithrathazhu', 'manichitrathasu', 'manichithrathasu'],
    answer: 'Manichitrathazhu',
    fact: 'India\u2019s most remade Malayalam film \u2014 a gem of a script.',
  },
  {
    kind: 'anagram',
    title: 'DRISHYAM',
    q: 'Unscramble this movie title \u2014 a 2013 crime thriller built on perception.',
    hint: '2013 \u00b7 Jeethu Joseph \u00b7 Mohanlal',
    accepts: ['drishyam'],
    answer: 'Drishyam',
    fact: '\u201cWhat you see is what they saw.\u201d A global phenomenon.',
  },
  {
    kind: 'anagram',
    title: 'PREMAM',
    q: 'Unscramble \u2014 2015\u2019s campus love saga.',
    hint: '2015 \u00b7 Nivin Pauly \u00b7 Sai Pallavi',
    accepts: ['premam', 'premaam'],
    answer: 'Premam',
    fact: 'Three loves, one heart. \u201cMalare\u201d still plays in every Malayali\u2019s head.',
  },
  {
    kind: 'anagram',
    title: 'USTAD HOTEL',
    q: 'Unscramble \u2014 a 2012 food-and-heritage odyssey.',
    hint: '2012 \u00b7 Dulquer \u00b7 Thilakan',
    accepts: ['ustad hotel', 'ustadh hotel', 'ustadhotel'],
    answer: 'Ustad Hotel',
    fact: 'Biryani upma \u2014 and a lesson that \u201cthe one in front is the teacher\u201d?',
  },
  {
    kind: 'blank',
    pattern: 'P _ E M A M',
    q: 'Fill in the missing letter(s).',
    hint: '2015 \u00b7 Nivin Pauly \u00b7 campus romance',
    accepts: ['premam', 'premaam'],
    answer: 'Premam',
    fact: 'The word that changed Nivin Pauly\u2019s career.',
  },
  {
    kind: 'nick',
    chips: 'L A L E T T A N',
    q: 'His fans call him \u201cLalettan\u201d. Who is he?',
    hint: 'He collaborated with Prithviraj in Lucifer',
    accepts: ['mohanlal', 'mohan lal', 'lalettan', 'lal ettan'],
    answer: 'Mohanlal',
    fact: 'Mohanlal Viswanathan Nair \u2014 the complete actor of Malayalam cinema.',
  },
  {
    kind: 'nick',
    chips: 'M A M M U K A',
    q: '\u201cMammukka\u201d is the fan title of which actor?',
    hint: 'Two-time National Award winner for Best Actor',
    accepts: ['mammootty', 'mammoty', 'mammuka', 'mammookka', 'maukutti'],
    answer: 'Mammootty',
    fact: 'From Thoovanathumbikal to Malappuram Haji \u2014 the king of range.',
  },
  {
    kind: 'initials',
    chips: 'K N',
    q: 'First letters \u201cK N\u201d \u2014 four brothers, 2019, the \u201cwell\u201d of Kerala cinema.',
    hint: 'The film shares its name with a village near Kochi',
    accepts: ['kumbalangi', 'kumbalangi nights'],
    answer: 'Kumbalangi Nights',
    fact: 'Shammi\u2019s \u201cdo not come near my sisters\u201d speech is now lore.',
  },
];

// --------------------------- GROUP ORDERS -----------------------------------
export const GROUP_ORDERS = [
  { kind: 'pair', size: 2, text: 'Hoouse! Split into PAIRS. Two bodies, one mind. Stand close together\u2014now!' },
  { kind: 'pair', size: 2, text: 'Order: stand beside the housemate you\u2019ve supported the most so far. PAIRS. Close!' },
  { kind: 'pair', size: 2, text: 'Hold hands with the person NEAREST to you. Pairs! Move, move!' },
  { kind: 'trio', size: 3, text: 'New task: make TRIO\u2019s \u2014 huddles of three. The slowest stays outside!' },
  { kind: 'trio', size: 3, text: 'Triangles of three! A tight little unity group. Form it!' },
  { kind: 'all', size: 0, all: true, text: 'GRAND TASK: ONE BIG GROUP. Stand as one family under my eye \u2014 hug distance!' },
];

// ----------------------------- PERSONA LINES --------------------------------
export const WELCOMES = [
  '\u{1F440} Bigg Boss. Welcome, housemates. I see you. I hear you. The house is yours\u2026 but the orders are mine.',
  '\u{1F440} Jayichal mathra pora \u2014 remember the slogan. I\u2019m watching. Behave like a family.',
];

export const INTROS = {
  trivia: [
    'Let us test the true Malayali cinephile in you\u2026 CINEMA TRIVIA!',
    'The big screen calls. Answer my cinema questions, house!',
    'How deep is your love for Malayalam cinema? Prove it. TRIVIA!',
  ],
  picture: [
    'Eyes on the picture, house\u2026 name the film from the image!',
    'The picture speaks. You name it. PICTURE ROUND!',
    'Somewhere between these signs lies a film familiar to every Malayali\u2026 go!',
  ],
  word: [
    'Wordplay time. Unscramble the world of Malayalam cinema!',
    'Letters, house! Untangle them before the clock eats you. WORD PLAY!',
  ],
};

export const ORDER_INTROS = [
  'I need ONE BIG PICTURE of unity\u2026',
  'Form-up call, house!',
  'Listen carefully\u2014my order goes out once.',
];

export const PRAISE = [
  'Splendid! The house is united. +50 to each of you.',
  'Now THIS is how you play the game. Points to all who grouped!',
  'The eye approves. A well-oiled family machine!',
];

export const SCOLD = [
  'Tch tch. Houses that ignore orders\u2026 invite trouble. -15 each.',
  'Slow, scattered, chaotic. That is NOT my house. -15.',
  'You treat my orders like suggestions?! Penalty! -15.',
];

export const GAME_FLASH_GENERIC = [
  'Six seconds left\u2026 the clock enemies\u2026',
];

export const GAME_CORRECT = [
  'Correct!',
  'Boom. That is cinema knowledge!',
  'The eye liked that answer!',
];

export const REVEAL_FAIL_USERS = (u) => `Not even ${u} got it?! Open your eyes, house!`;

// --------------------------- COOKING (kitchen task) --------------------------
// Random ingredient pool each round; only the dish's true ingredients work.
export const COOK_ITEMS = {
  flour:    { e: '\u{1F953}', name: 'Maavu' },
  coconut:  { e: '\u{1F965}', name: 'Thenga' },
  jaggery:  { e: '\u{1F36F}', name: 'Sharkkara' },
  banana:   { e: '\u{1F34C}', name: 'Pazham' },
  rice:     { e: '\u{1F33E}', name: 'Ari' },
  egg:      { e: '\u{1F95A}', name: 'Mutte' },
  milk:     { e: '\u{1F95B}', name: 'Paal' },
  leaf:     { e: '\u{1F33F}', name: 'Kariveppila' },
  chilli:   { e: '\u{1F336}', name: 'Mulaku' },
  turmeric: { e: '\u{1F7E1}', name: 'Manjal' },
  fish:     { e: '\u{1F41F}', name: 'Meen' },
  prawn:    { e: '\u{1F990}', name: 'Konju' },
  onion:    { e: '\u{1F9C5}', name: 'Ulli' },
  tomato:   { e: '\u{1F345}', name: 'Thakkali' },
  garlic:   { e: '\u{1F9C4}', name: 'Veluthulli' },
  ginger:   { e: '\u{1F331}', name: 'Inji' },
  beans:    { e: '\u{1FAD8}', name: 'Payar' },
};

export const DISHES = [
  { id: 'puttu',  name: 'Puttu',        emoji: '\u{1F35A}', req: ['rice', 'coconut', 'jaggery'] },
  { id: 'puttukadala', name: 'Puttu Kadala', emoji: '\u{1FAD8}', req: ['flour', 'coconut', 'beans'] },
  { id: 'appam',  name: 'Vela Appam',   emoji: '\u{1F95E}', req: ['rice', 'coconut', 'egg'] },
  { id: 'idiyappam', name: 'Idiyappam', emoji: '\u{1F965}', req: ['flour', 'coconut', 'milk'] },
  { id: 'avial',  name: 'Avial',        emoji: '\u{1F372}', req: ['beans', 'coconut', 'turmeric', 'leaf'] },
  { id: 'meen',   name: 'Meen Mulakittathu', emoji: '\u{1F41F}', req: ['fish', 'chilli', 'coconut'] },
  { id: 'konju',  name: 'Konju Thoran', emoji: '\u{1F990}', req: ['prawn', 'coconut', 'leaf', 'chilli'] },
];

// Where ingredient pots can appear (all inside the kitchen, next to walkable tile)
export const COOK_STATIONS = [
  [500, 1278], [530, 1278], [590, 1278], [650, 1278], [710, 1278], [770, 1278],
  [500, 1300], [560, 1300], [620, 1300], [680, 1300], [760, 1300],
  [280, 1355], [330, 1360], [700, 1360], [760, 1355],
];

export const COOK_SPOT = { x: 560, y: 1220, r: 70 };   // the stove / prep point

export const COOK_INTROS = [
  'Hunger games, house! Someone light the stove\u2026 KITCHEN TASK!',
  'The kitchen is your stage now. Cook me some Kerala love!',
  'I can smell a cooking task brewing\u2026 GO!',
];

export const COOK_PRAISE = [
  'Mmmm\u2026 that smells like victory. Points for the cook!',
  'A true Malayali chef. You have fed my eye!',
  'Delicious teamwork. The kitchen honours you!',
];

export const COOK_SCOLD = [
  'Raw ingredients, burnt dreams. No one cooked this round. -10 each.',
  'The stove is cold. Shame on the house. -10.',
];

export const COOK_GUIDE = 'Walk to a pot and press E to grab. Carry the right items to the stove and press E to cook!';

// ------------------------- CLEANING (chore events) --------------------------
// Spaces the house must keep tidy to win coins.
export const CHORES = [
  { id: 'house',       room: 'kitchen',    name: 'House Cleaning',      text: 'Scrub the KITCHEN \u2014 every corner! My eye is on the grease.', n: 6 },
  { id: 'bathroom',    room: 'bath',       name: 'Bathroom Cleaning',   text: 'The bathroom stinks, house! Wash it shiny \u2014 tiles and all!', n: 6 },
  { id: 'dressing',    room: 'powder',     name: 'Dressing Room Clean', text: 'Mirrors, make-up, dust \u2014 tidy the POWDER room before the big night.', n: 5 },
  { id: 'living',      room: 'living',     name: 'Living Room Clean',   text: 'The living room is a mess. Fold, sweep \u2014 impress me.', n: 6 },
  { id: 'bedroom',     room: 'bedroom',    name: 'Dorm Tidy-Up',        text: 'Floors, nytts, blankets \u2014 the BEDROOM needs care.', n: 7 },
  { id: 'garden',      room: 'courtyard',  name: 'Garden Sweep',        text: 'Leaves everywhere under my trees! SWEEP the garden.', n: 8 },
  { id: 'dining',      room: 'dining',     name: 'Dining Wash',         text: 'The raised dining area \u2014 wipe it till it gleams.', n: 5 },
];

export const CHORE_INTROS = [
  'This house does not clean itself! CHORE TIME!',
  'Work is worship, housemates. The house needs hands\u2026 CHORE!',
  'Brooms out! My eyes see dirt. You will clean it!',
];

export const CHORE_GUIDE = 'Find the grime spots, stand near one and press E to clean. Every blur cleaned = coins!';

export const CHORE_PRAISE = [
  'A spotless house, a happy eye. Excellent work!',
  'That gleam is the beauty of effort. Well cleaned!',
  'The house sparkles \u2014 you have earned rest\u2026 for now.',
];

export const CHORE_SCOLD = [
  'Dirt invited, house ignored. Disappointing. -10 each.',
  'You call that clean?! The grime laughs at you. -10.',
];

export const CHORE_CHAMP = (u) => `\u{1F451} Cleanliness champion: ${u} \u2014 bonus coins!`;

// ------------------------------- HELPERS ------------------------------------
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/'/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

export function checkWord(input, accepts) {
  const n = normalize(input);
  if (!n || n.length < 2) return false;
  for (const acc of accepts) {
    const a = normalize(acc);
    if (n === a) return true;
  }
  for (const acc of accepts) {
    const a = normalize(acc);
    const tol = n.length >= 6 ? 2 : 1;
    if (levenshtein(n, a) <= tol) return true;
  }
  return false;
}

export function scrambleWord(word) {
  const clean = word.replace(/[\s']/g, '');
  const letters = clean.split('');
  let candidate = null;
  for (let attempt = 0; attempt < 120 && !candidate; attempt++) {
    for (let j = letters.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [letters[j], letters[k]] = [letters[k], letters[j]];
    }
    const s = letters.join('');
    if (s !== clean && /[AEIOU].*[AEIOU]/.test(s)) candidate = s;
  }
  if (!candidate) candidate = letters.join('') || clean;
  // chunk into nice letter groups for display
  const spaced = candidate.split('').join(' ');
  return { display: spaced, len: clean.length };
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}