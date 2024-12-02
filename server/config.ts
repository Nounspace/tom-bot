import dotenv from "dotenv";
dotenv.config();

// configs 
export const BotName = "nounspacetom";
export const BotIcon = " ⌐◨-◨  ";
export const TIMEZONE = process.env.TIMEZONE || "America/Chicago";

export const NOTION_PAGE_IDS = [
  "https://nounspace.notion.site/Tom-s-Background-1460572746cd804a8216f6a0a2f34e5c",
  "https://nounspace.notion.site/nounspace-app-info-1460572746cd802fb2dbf6a7ce99eecd",
  "https://nounspace.notion.site/nounspace-DAO-info-1460572746cd8049b9bcf3605c7a2dda",
  "https://nounspace.notion.site/SPACE-token-info-1460572746cd80dbbee1fa3125a5d9bd",
  "https://nounspace.notion.site/nOGs-info-1460572746cd80f2a3b7ef6e52034424",
  "https://nounspace.notion.site/nounspace-Fidgets-1480572746cd80eaae5ae86e630277ab"
]

// interval in minutes bot will cast new messages
export const NEW_CASTS_INTERVAL_MIN = parseInt(process.env.NEW_CASTS_INTERVAL_MIN) || 0;
export const PUBLISH_TO_FARCASTER = process.env.PUBLISH_TO_FARCASTER === 'true';

export const MIN_REPLY_WORD_COUNT = 10;
export const MIN_REPLY_CHAR_COUNT = 10;

// targets
// Maximum farcast fid/fname cache storage
// channel that bot will cast new messages
export const CAST_TO_CHANNEL = "nounspace";
export const MAX_USER_CACHE = 100;
export const TARGETS = [
  527313,            //  nounspacetom
  // 862185,            //  aethernet
  // 874542             //  clanker
  // 382802             //  askgina.eth
  // 364927             //  paybot
  // 20596              //  bountybot
];

// channels bot will listen to new messages
export const TARGET_CHANNELS = [
  "~/channel/nounspace",
  // "~/channel/skateboard",
  // "~/channel/farcaster"
]

// only log AI messages, do not publish
export const LOG_MESSAGES = true;
export const DISPLAY_MEM_USAGE = false;

export const USE_WS = process.env.USE_WS === 'true';
export const WS_PORT = process.env.WS_PORT!;

// in memory messages history size and expiration after X minutes with no interaction
export const MESSAGES_HISTORY_SIZE = parseInt(process.env.MEMORY_EXPIRATION_MIN) || 20;
export const MEMORY_EXPIRATION_MIN = parseInt(process.env.MEMORY_EXPIRATION_MIN) || 30;

// timer to check and clean up old memories
export const MEMORY_CLEANUP_MIN = parseInt(process.env.MEMORY_CLEANUP_MIN) || 60;
export const FARCASTER_TRENDING_MIN = parseInt(process.env.FARCASTER_TRENDING_MIN) || 1440;



// LLM Available Models 
const llama3_8b_8192 = "llama3-8b-8192";
const llama32_90b_textpreview = "llama-3.2-90b-text-preview";
const llama32_3b_preview = "llama-3.2-3b-preview";
const llama3_70b_8192 = "llama3-70b-8192";
const llama32_90b_vision = "llama-3.2-90b-vision-preview";
const llama_32_11b_vision = "llama-3.2-11b-vision-preview";

export const BotLLMModel = llama3_8b_8192;
export const RAGLLMModel = llama3_8b_8192;
export const JSONLLMModel = llama3_8b_8192;
export const AssistentModel = llama3_8b_8192;

export const GROQ_API_KEY = process.env.GROQ_API_KEY!;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID!;
export const NOTION_INTEGRATION_TOKEN = process.env.NOTION_INTEGRATION_TOKEN!;
//export const NOTION_PAGE_IDS = (process.env.NOTION_PAGE_IDS as string).split(",");

export const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
export const HUB_RPC = process.env.HUB_RPC!;
export const HUB_SSL = process.env.HUB_SSL!;
export const SIGNER_UUID = process.env.SIGNER_UUID!;
