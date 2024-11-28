var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.ragSystem=void 0;let hf_transformers_1=require("@langchain/community/embeddings/hf_transformers"),output_parsers_1=require("@langchain/core/output_parsers"),prompts_1=require("@langchain/core/prompts"),langgraph_1=require("@langchain/langgraph"),groq_1=require("@langchain/groq"),notionapi_1=require("@langchain/community/document_loaders/web/notionapi"),config_1=require("./config"),prompts_2=require("@langchain/core/prompts"),config_2=require("./config"),text_splitter_1=require("langchain/text_splitter"),memory_1=require("langchain/vectorstores/memory"),botPrompts_1=require("./botPrompts"),TokenLimiter_1=require("./TokenLimiter"),FileLogger_1=__importDefault(require("./lib/FileLogger"));class RAGSystem{constructor(){this.vectorStore=null,this.graph=null,this.ragApp=null,this.initializeGraph(),this.docsLoaded=!1,this.docsLoading=!1,this.logger=new FileLogger_1.default({folder:"./logs"}),this.vectorStore=new memory_1.MemoryVectorStore(new hf_transformers_1.HuggingFaceTransformersEmbeddings({model:"Xenova/all-MiniLM-L6-v2"})),this.tokenRateLimiter=new TokenLimiter_1.TokenRateLimiter({"llama3-8b-8192":3e4})}initializeGraph(){this.graph=new langgraph_1.StateGraph({channels:{question:null,generatedAnswer:null,documents:{value:(e,r)=>r,default:()=>[]},model:null,jsonResponseModel:null}}).addNode("retrieve_docs",this.retrieveDocs.bind(this)).addNode("create_model",this.createModel.bind(this)).addNode("create_json_response_model",this.createJsonResponseModel.bind(this)).addNode("grade_documents",this.gradeDocuments.bind(this)).addNode("generate_answer",this.generateAnswer.bind(this)).addNode("grade_answer",this.gradeAnswer.bind(this)).addEdge(langgraph_1.START,"retrieve_docs").addEdge("retrieve_docs","create_model").addEdge("create_model","create_json_response_model").addEdge("create_json_response_model","grade_documents").addConditionalEdges("grade_documents",this.hasRelevantDocs.bind(this),{yes:"generate_answer",no:langgraph_1.END}).addEdge("generate_answer","grade_answer").addEdge("grade_answer",langgraph_1.END),this.ragApp=this.graph.compile({checkpointer:new langgraph_1.MemorySaver})}async createModel(e){return{model:new groq_1.ChatGroq({model:config_2.RAGLLMModel,temperature:.1,apiKey:process.env.GROQ_API_KEY})}}async createJsonResponseModel(e){return{jsonResponseModel:new groq_1.ChatGroq({model:config_2.JSONLLMModel,temperature:0,apiKey:process.env.GROQ_API_KEY}).bind({response_format:{type:"json_object"}})}}waitForDocumentsToLoad(){return new Promise(e=>{let r=setInterval(()=>{this.docsLoaded&&(clearInterval(r),e())},100)})}async buildVectorStore(){if(!this.docsLoaded)if(this.docsLoading)await this.waitForDocumentsToLoad();else{this.docsLoading=!0;var e=config_1.NOTION_PAGE_IDS,e=await Promise.all(e.map(e=>{var r=new RegExp(/(?<!=)[0-9a-f]{32}/),e=e.match(r);if(e&&0<e.length)return r=e[0],new notionapi_1.NotionAPILoader({clientOptions:{auth:config_1.NOTION_INTEGRATION_TOKEN},id:r,type:"page"}).load()})),e=await text_splitter_1.RecursiveCharacterTextSplitter.fromLanguage("markdown",{chunkSize:500,chunkOverlap:0}).splitDocuments(e.flat());try{this.vectorStore=await memory_1.MemoryVectorStore.fromDocuments(e,new hf_transformers_1.HuggingFaceTransformersEmbeddings({model:"Xenova/all-MiniLM-L6-v2"})),this.docsLoaded=!0}catch(e){console.error("HuggingFaceTransformersEmbeddings"),console.dir(e),this.docsLoaded=!1}this.docsLoading=!1}return this.vectorStore}async retrieveDocs(e){return{documents:await(await this.buildVectorStore()).asRetriever().invoke(e.question)}}async gradeDocuments(t){var e=t.documents;let o=prompts_1.ChatPromptTemplate.fromTemplate(botPrompts_1.GRADER_TEMPLATE).pipe(t.jsonResponseModel);e=e.map(async e=>{var r=await o.invoke({document:e.pageContent,question:t.question}),r=(console.warn("tokenUsage.totalTokens: "+r.response_metadata.tokenUsage.totalTokens),JSON.parse(r.content));return r.relevant?e:null});return{documents:(await Promise.all(e)).filter(Boolean)}}hasRelevantDocs(e){return 0<e.documents.length?"yes":"no"}async generateAnswer(e){var r=botPrompts_1.TOM_SECRETARY,r=new prompts_2.PromptTemplate({template:r,inputVariables:["question","context"]}).pipe(e.model).pipe(new output_parsers_1.StringOutputParser),t=e.documents.map(e=>e.pageContent).join("\n").replace(/###.*\n/g,"").trim(),r=await r.invoke({context:t,question:e.question});return console.warn(""),console.warn("----- GENERATEANSWER ------"),console.warn("userQuery: "+e.question),console.warn("generatedAnswer: "+r),console.warn("----------------------------"),console.warn(""),{generatedAnswer:r}}async gradeAnswer(e){var r=await prompts_1.ChatPromptTemplate.fromTemplate(botPrompts_1.ANSWER_GRADER_TEMPLATE).pipe(e.jsonResponseModel).invoke({question:e.question,answer:e.generatedAnswer}),r=JSON.parse(r.content);return r.relevant?(console.log("relevant: "+r.relevant),{generatedAnswer:e.generatedAnswer}):(console.log("relevant: "+r.relevant),{generatedAnswer:botPrompts_1.SORRY_UNABLE_HELP})}async preloadDocuments(){return(await this.buildVectorStore()).memoryVectors.length}async invokeRAG(e,r){return this.ragApp?(console.log("----- INVOKERAG ------"),await this.ragApp.invoke({question:r},{configurable:{thread_id:e+"_thread"}})):(console.error("RAG app is not initialized"),"")}}exports.ragSystem=new RAGSystem;