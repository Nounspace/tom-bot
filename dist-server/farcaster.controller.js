var __createBinding=this&&this.__createBinding||(Object.create?function(e,t,a,s){void 0===s&&(s=a);var r=Object.getOwnPropertyDescriptor(t,a);r&&("get"in r?t.__esModule:!r.writable&&!r.configurable)||(r={enumerable:!0,get:function(){return t[a]}}),Object.defineProperty(e,s,r)}:function(e,t,a,s){e[s=void 0===s?a:s]=t[a]}),__setModuleDefault=this&&this.__setModuleDefault||(Object.create?function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}:function(e,t){e.default=t}),__importStar=this&&this.__importStar||(()=>{var r=function(e){return(r=Object.getOwnPropertyNames||function(e){var t,a=[];for(t in e)Object.prototype.hasOwnProperty.call(e,t)&&(a[a.length]=t);return a})(e)};return function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var a=r(e),s=0;s<a.length;s++)"default"!==a[s]&&__createBinding(t,e,a[s]);return __setModuleDefault(t,e),t}})(),__importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.Farcaster=void 0;let hub_nodejs_1=require("@farcaster/hub-nodejs"),nodejs_sdk_1=require("@neynar/nodejs-sdk"),neynarClient_1=__importDefault(require("./lib/neynarClient")),neverthrow_1=require("neverthrow"),hub_client_1=require("./lib/hub-client"),event_1=require("./api/event"),botConfig=__importStar(require("./config")),grapheme_splitter_1=__importDefault(require("grapheme-splitter")),FileLogger_1=__importDefault(require("./lib/FileLogger")),urlMatchesTargetChannel=t=>botConfig.TARGET_CHANNELS.some(e=>t.endsWith(e));class Farcaster{constructor(e){this.eventBus=e,this.USERS_FNAME_MAP=new Map,this.TARGET_FNAME_MAP=new Map,this.farcasterLog=new FileLogger_1.default({folder:"./logs-farcaster-out",printconsole:!0}),this.subscriberStream()}bytesToHex(e){return"0x"+Buffer.from(e).toString("hex")}hubProtocolToVerificationProtocol(e){if(e===hub_nodejs_1.Protocol.ETHEREUM)return"ethereum"}protocolBytesToString(e,t){switch(t){case hub_nodejs_1.Protocol.ETHEREUM:case"ethereum":return this.bytesToHex(e);default:throw new Error("Unexpected protocol: "+t)}}farcasterTimeToDate(e){if(void 0!==e){if(null===e)return null;e=(0,hub_nodejs_1.fromFarcasterTime)(e);if(e.isErr())throw e.error;return new Date(e.value)}}async insertMentions(t,a,s){let r=new grapheme_splitter_1.default;var o=r.splitGraphemes(t);s.map(e=>r.splitGraphemes(t.slice(0,e)).length);for(let e=a.length-1;0<=e;e--){var n=a[e],n=await this.handleUserFid(n),i=s[e];o.splice(i,0,"@"+n)}return o.join("")}convertProtobufMessageBodyToJson(e){let t,a,s;switch(null==(t=e.data)?void 0:t.type){case hub_nodejs_1.MessageType.CAST_ADD:if(!e.data.castAddBody)return void console.error("Missing castAddBody");var r,{embeds:o,mentions:n,mentionsPositions:i,text:d,parentCastId:h,parentUrl:_,type:c}=e.data.castAddBody,l=[];for(r of o)void 0!==r.castId?l.push(this.bytesToHex(r.castId.hash)):void 0!==r.url&&l.push(r.url);s={embeds:l,mentions:n,mentionsPositions:i,text:d,type:c,parent:h?{fid:h.fid,hash:this.bytesToHex(h.hash)}:_};break;case hub_nodejs_1.MessageType.CAST_REMOVE:if(!e.data.castRemoveBody)throw new Error("Missing castRemoveBody");o=e.data.castRemoveBody.targetHash;s={targetHash:this.bytesToHex(o)};break;case hub_nodejs_1.MessageType.REACTION_ADD:case hub_nodejs_1.MessageType.REACTION_REMOVE:if(!e.data.reactionBody)throw new Error("Missing reactionBody");if(e.data.reactionBody.targetCastId){var{type:n,targetCastId:{fid:i,hash:d}}=e.data.reactionBody;s={type:n,target:{fid:i,hash:this.bytesToHex(d)}}}else{if(!e.data.reactionBody.targetUrl)throw new Error("Missing targetCastId and targetUrl on reactionBody");var{type:c,targetUrl:h}=e.data.reactionBody;s={type:c,target:h}}break;case hub_nodejs_1.MessageType.LINK_ADD:case hub_nodejs_1.MessageType.LINK_REMOVE:if(!e.data.linkBody)throw new Error("Missing linkBody");if(!e.data.linkBody.targetFid)throw new Error("Missing linkBody target");var{type:_,targetFid:o,displayTimestamp:n}=e.data.linkBody;if(s={type:_,targetFid:o},n){i=(0,hub_nodejs_1.fromFarcasterTime)(n);if(i.isErr())throw i.error;s.displayTimestamp=i.value}break;case hub_nodejs_1.MessageType.LINK_COMPACT_STATE:if(!e.data.linkCompactStateBody)throw new Error("Missing linkCompactStateBody");var{type:d,targetFids:c}=e.data.linkCompactStateBody;s={type:d,targetFids:c};break;case hub_nodejs_1.MessageType.VERIFICATION_ADD_ETH_ADDRESS:if(!e.data.verificationAddAddressBody)throw new Error("Missing verificationAddAddressBody");var{address:h,claimSignature:_,blockHash:o,protocol:n}=e.data.verificationAddAddressBody;s={address:this.protocolBytesToString(h,n),claimSignature:this.protocolBytesToString(_,n),blockHash:this.protocolBytesToString(o,n),protocol:this.hubProtocolToVerificationProtocol(n)};break;case hub_nodejs_1.MessageType.VERIFICATION_REMOVE:if(!e.data.verificationRemoveBody)throw new Error("Missing verificationRemoveBody");var{address:i,protocol:d}=e.data.verificationRemoveBody;s={address:this.protocolBytesToString(i,d),protocol:this.hubProtocolToVerificationProtocol(d)};break;case hub_nodejs_1.MessageType.USER_DATA_ADD:if(!e.data.userDataBody)throw new Error("Missing userDataBody");var{type:c,value:h}=e.data.userDataBody;s={type:c,value:h};break;case hub_nodejs_1.MessageType.USERNAME_PROOF:if(!e.data.usernameProofBody)throw new Error("Missing usernameProofBody");var{timestamp:_,name:o,owner:n,signature:i,fid:d,type:c}=e.data.usernameProofBody;s={timestamp:_,name:this.bytesToHex(o),owner:this.bytesToHex(n),signature:this.bytesToHex(i),fid:d,type:c};break;default:throw new Error("Unknown message type "+(null==(a=e.data)?void 0:a.type))}return s}async subscriberStream(){var e=await hub_client_1.hubClient.subscribe({eventTypes:[hub_nodejs_1.HubEventType.MERGE_MESSAGE,hub_nodejs_1.HubEventType.PRUNE_MESSAGE,hub_nodejs_1.HubEventType.REVOKE_MESSAGE,hub_nodejs_1.HubEventType.MERGE_ON_CHAIN_EVENT]});e.isErr()?console.error(e.error+"\nError starting stream"):e.match(e=>{console.info("Subscribed to Farcaster Stream: HEAD"),e.on("data",async e=>{this.handleEvent(e),(0,event_1.saveLatestEventId)(e.id),this.eventBus.publish("LAST_EVENT_ID",e.id)}),e.on("close",async()=>{console.warn("Hub stream closed")}),e.on("end",async()=>{console.warn("Hub stream ended")})},e=>{console.error(e,"Error streaming data.")})}async handleEvent(e){switch(e.type){case hub_nodejs_1.HubEventType.MERGE_MESSAGE:var t=e.mergeMessageBody.message;switch(t.data.type){case hub_nodejs_1.MessageType.CAST_ADD:this.handleAddCasts([t]);break;case hub_nodejs_1.MessageType.CAST_REMOVE:case hub_nodejs_1.MessageType.VERIFICATION_ADD_ETH_ADDRESS:case hub_nodejs_1.MessageType.VERIFICATION_REMOVE:case hub_nodejs_1.MessageType.USER_DATA_ADD:case hub_nodejs_1.MessageType.REACTION_ADD:case hub_nodejs_1.MessageType.REACTION_REMOVE:case hub_nodejs_1.MessageType.LINK_ADD:case hub_nodejs_1.MessageType.LINK_REMOVE:}break;case hub_nodejs_1.HubEventType.PRUNE_MESSAGE:switch(e.pruneMessageBody.message.data.type){case hub_nodejs_1.MessageType.CAST_ADD:case hub_nodejs_1.MessageType.REACTION_ADD:case hub_nodejs_1.MessageType.LINK_ADD:}break;case hub_nodejs_1.HubEventType.REVOKE_MESSAGE:break;case hub_nodejs_1.HubEventType.MERGE_ON_CHAIN_EVENT:switch(e.mergeOnChainEventBody.onChainEvent.type){case hub_nodejs_1.OnChainEventType.EVENT_TYPE_ID_REGISTER:case hub_nodejs_1.OnChainEventType.EVENT_TYPE_SIGNER:case hub_nodejs_1.OnChainEventType.EVENT_TYPE_STORAGE_RENT:}break;default:console.log("UNHANDLED HUB EVENT",e.id)}}async getTrendingFeed(e=nodejs_sdk_1.FilterType.GlobalTrending){let t="";try{var a,s=await neynarClient_1.default.fetchFeed(nodejs_sdk_1.FeedType.Filter,{filterType:e});for(a of Object.values(s.casts))t+=a.author.display_name+": "+a.text}catch(e){console.error("Error fetching Farcaster Feed",e)}return t}async publishToFarcaster(e,t){var a;botConfig.LOG_MESSAGES&&(this.farcasterLog.log("msg: "+e,a="publishToFarcaster"),this.farcasterLog.log("options:",a),this.farcasterLog.log(t,a)),botConfig.PUBLISH_TO_FARCASTER?neynarClient_1.default.publishCast(botConfig.SIGNER_UUID,e,t).then(e=>{console.warn("Cast published successfully: "+e.hash)}).catch(e=>{(0,nodejs_sdk_1.isApiErrorResponse)(e)?console.error(e.response.data):console.error("Failed to publish cast:",e)}):console.warn("PUBLISH_TO_FARCASTER OFF")}async publishUserReply(e,t){this.publishToFarcaster(e,{parent:t})}async publishNewChannelCast(e){var t={channelId:botConfig.CAST_TO_CHANNEL};this.publishToFarcaster(e,t)}async handleData_new(t){for(let e=0;e<t.length;e++){var a=t[e],s=this.convertProtobufMessageBodyToJson(a);if("text"in s&&"mentions"in s&&"mentionsPositions"in s&&s.mentions instanceof Array&&s.mentionsPositions instanceof Array){let e=s.text;0<s.mentions.length&&(e=await this.insertMentions(s.text,s.mentions,s.mentionsPositions)),s.textWithMentions=e;var r=await this.handleUserFid(a.data.fid);a.data.fid,a.data.type,this.farcasterTimeToDate(a.data.timestamp)}}}async handleAddCasts(t){for(let e=0;e<t.length;e++){var a=t[e].data;if(a.castAddBody){if(botConfig.TARGETS.includes(a.fid))return;if(a.castAddBody.parentCastId&&botConfig.TARGETS.includes(a.castAddBody.parentCastId.fid))return void this.handleReceivedReply(t[e]);var s=a.castAddBody.mentions.find(e=>botConfig.TARGETS.includes(e));if(s)return void this.handleMentioned(t[e],s);if(a.castAddBody.parentUrl&&urlMatchesTargetChannel(a.castAddBody.parentUrl))return void this.handleTargetChannelCast(t[e])}}}async handleUserFid(e){var t;return this.USERS_FNAME_MAP.has(e)||(t=await this.getFnameFromFid(e)).isOk()&&this.USERS_FNAME_MAP.set(e,t.value),this.USERS_FNAME_MAP.size>=botConfig.MAX_USER_CACHE&&this.USERS_FNAME_MAP.delete(this.USERS_FNAME_MAP.keys().next().value),this.USERS_FNAME_MAP.get(e)}async getFnameFromFid(e){var t=await hub_client_1.hubClient.getUserData({fid:e,userDataType:hub_nodejs_1.UserDataType.USERNAME});return(0,neverthrow_1.ok)(t.match(e=>(0,hub_nodejs_1.isUserDataAddMessage)(e)?e.data.userDataBody.value:"",()=>e+"!"))}async handleTargetFid(e){var t;return this.TARGET_FNAME_MAP.has(e)||(t=await this.getFnameFromFid(e)).isOk()&&this.TARGET_FNAME_MAP.set(e,t.value),this.TARGET_FNAME_MAP.get(e)}async handleTargetAddCast(e){this.convertProtobufMessageBodyToJson(e),await this.handleTargetFid(e.data.fid);e.data.castAddBody.parentCastId&&await this.handleUserFid(e.data.castAddBody.parentCastId.fid),e.data.castAddBody.text}async handleReceivedReply(e){await this.handleTargetFid(e.data.castAddBody.parentCastId.fid);e=await this.createCastObj(e);this.eventBus.publish("WAS_REPLIED",e)}async handleMentioned(e,t){await this.handleTargetFid(t);t=await this.createCastObj(e);this.eventBus.publish("WAS_MENTIONED",t)}async handleTargetChannelCast(e){e.data.castAddBody.parentUrl&&(e=await this.createCastObj(e),this.eventBus.publish("CHANNEL_NEW_MESSAGE",e))}async createCastObj(e){var t=this.convertProtobufMessageBodyToJson(e),a=await this.handleUserFid(e.data.fid),s=this.bytesToHex(e.hash);if("text"in t&&"mentions"in t&&"mentionsPositions"in t&&t.mentions instanceof Array&&t.mentionsPositions instanceof Array){let e=t.text;0<t.mentions.length&&(e=await this.insertMentions(t.text,t.mentions,t.mentionsPositions)),t.textWithMentions=e}return{fid:e.data.fid,fName:a,hash:s,type:e.data.type,timestamp:this.farcasterTimeToDate(e.data.timestamp),body:t}}}exports.Farcaster=Farcaster;