export const PORT = 3000;

// How many world-state updates per second get pushed to every client
export const TICK_RATE = 20;

// Rate limit: a client may send a position update at most every MOVE_THROTTLE ms
export const MOVE_THROTTLE = 40;

// Proximity chat radius in world pixels. Players farther apart than this
// cannot hear (receive) each other's messages.
export const CHAT_RADIUS = 320;

// How long a message stays as a speech bubble / in the visible log
export const BUBBLE_MS = 5000;

// Per player message / login limits
export const CHAT_COOLDOWN = 600;      // ms between messages
export const MAX_CHAT_LEN = 220;
export const MAX_NAME_LEN = 16;

// Optional passcode required to enter the house (empty = open house)
export const HOUSE_PASSCODE = 'jayichal';

// Max number of concurrent players
export const MAX_PLAYERS = 60;