var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.SIGNER_UUID=exports.HUB_SSL=exports.HUB_RPC=exports.NEYNAR_API_KEY=exports.NOTION_INTEGRATION_TOKEN=exports.NOTION_PAGE_ID=exports.OPENAI_API_KEY=exports.GROQ_API_KEY=exports.AssistentModel=exports.JSONLLMModel=exports.RAGLLMModel=exports.BotLLMModel=exports.FARCASTER_TRENDING_MIN=exports.MEMORY_CLEANUP_MIN=exports.MEMORY_EXPIRATION_MIN=exports.MESSAGES_HISTORY_SIZE=exports.WS_PORT=exports.USE_WS=exports.DISPLAY_MEM_USAGE=exports.LOG_MESSAGES=exports.TARGET_CHANNELS=exports.TARGETS=exports.MAX_USER_CACHE=exports.CAST_TO_CHANNEL=exports.MIN_REPLY_WORD_COUNT=exports.PUBLISH_TO_FARCASTER=exports.NEW_CASTS_INTERVAL_MIN=exports.NOTION_PAGE_IDS=exports.TIMEZONE=exports.BotIcon=exports.BotName=void 0;let dotenv_1=__importDefault(require("dotenv")),llama3_8b_8192=(dotenv_1.default.config(),exports.BotName="nounspacetom",exports.BotIcon=" ⌐◨-◨  ",exports.TIMEZONE=process.env.TIMEZONE||"America/Chicago",exports.NOTION_PAGE_IDS=["https://nounspace.notion.site/Tom-s-Background-1460572746cd804a8216f6a0a2f34e5c","https://nounspace.notion.site/nounspace-app-info-1460572746cd802fb2dbf6a7ce99eecd","https://nounspace.notion.site/nounspace-DAO-info-1460572746cd8049b9bcf3605c7a2dda","https://nounspace.notion.site/SPACE-token-info-1460572746cd80dbbee1fa3125a5d9bd","https://nounspace.notion.site/nOGs-info-1460572746cd80f2a3b7ef6e52034424","https://nounspace.notion.site/nounspace-Fidgets-1480572746cd80eaae5ae86e630277ab"],exports.NEW_CASTS_INTERVAL_MIN=parseInt(process.env.NEW_CASTS_INTERVAL_MIN)||0,exports.PUBLISH_TO_FARCASTER="true"===process.env.PUBLISH_TO_FARCASTER,exports.MIN_REPLY_WORD_COUNT=5,exports.CAST_TO_CHANNEL="nounspace",exports.MAX_USER_CACHE=100,exports.TARGETS=[527313],exports.TARGET_CHANNELS=["~/channel/nounspace"],exports.LOG_MESSAGES=!0,exports.DISPLAY_MEM_USAGE=!1,exports.USE_WS="true"===process.env.USE_WS,exports.WS_PORT=process.env.WS_PORT,exports.MESSAGES_HISTORY_SIZE=parseInt(process.env.MEMORY_EXPIRATION_MIN)||20,exports.MEMORY_EXPIRATION_MIN=parseInt(process.env.MEMORY_EXPIRATION_MIN)||30,exports.MEMORY_CLEANUP_MIN=parseInt(process.env.MEMORY_CLEANUP_MIN)||60,exports.FARCASTER_TRENDING_MIN=parseInt(process.env.FARCASTER_TRENDING_MIN)||1440,"llama3-8b-8192"),llama32_90b_textpreview="llama-3.2-90b-text-preview",llama32_3b_preview="llama-3.2-3b-preview",llama3_70b_8192="llama3-70b-8192",llama32_90b_vision="llama-3.2-90b-vision-preview",llama_32_11b_vision="llama-3.2-11b-vision-preview";exports.BotLLMModel=llama3_8b_8192,exports.RAGLLMModel=llama3_8b_8192,exports.JSONLLMModel=llama3_8b_8192,exports.AssistentModel=llama3_8b_8192,exports.GROQ_API_KEY=process.env.GROQ_API_KEY,exports.OPENAI_API_KEY=process.env.OPENAI_API_KEY,exports.NOTION_PAGE_ID=process.env.NOTION_PAGE_ID,exports.NOTION_INTEGRATION_TOKEN=process.env.NOTION_INTEGRATION_TOKEN,exports.NEYNAR_API_KEY=process.env.NEYNAR_API_KEY,exports.HUB_RPC=process.env.HUB_RPC,exports.HUB_SSL=process.env.HUB_SSL,exports.SIGNER_UUID=process.env.SIGNER_UUID;