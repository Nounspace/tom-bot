const Reset = "\x1b[0m",
    Blue = "\x1b[34m",
    Green = "\x1b[32m",
    Red = "\x1b[31m",
    Yellow = "\x1b[33m",
    Magenta = "\x1b[35m",
    Italic = "\x1b[3m",
    Underscore = "\x1b[4m",
    Cyan = "\x1b[36m",
    Gray = "\x1b[90m";

import { randomInt } from 'crypto';


import {
    HubEvent, HubEventType,
    OnChainEventType,
    Message,
    MessageType,
    HubAsyncResult,
    isUserDataAddMessage,
    UserDataType,
    CastType,
    ReactionType,
    UserNameType,
    fromFarcasterTime,
    Protocol,
} from '@farcaster/hub-nodejs'

import { FeedType, FilterType, isApiErrorResponse } from "@neynar/nodejs-sdk";
import neynarClient from "./lib/neynarClient";

import { err, ok, Result } from "neverthrow";
import { hubClient } from './lib/hub-client'
import { EventBus } from './eventBus.interface'

import { saveLatestEventId } from './api/event'
import * as botConfig from "./config";

import GraphemeSplitter from 'grapheme-splitter';
// import { console } from 'inspector';

import FileLogger from './lib/FileLogger'

import { VerificationProtocol, MessageBodyJson, BotCastObj, CastAddBodyJson } from './bot.types';
import { inspect } from 'node:util';

const urlMatchesTargetChannel = (url: string): boolean => botConfig.TARGET_CHANNELS.some(target => url.endsWith(target));

export class Farcaster {
    private eventBus: EventBus;
    private USERS_FNAME_MAP: Map<number, any>;
    private TARGET_FNAME_MAP: Map<number, any>;

    private isConnected: boolean;
    private isReconnecting: boolean;

    // private farcasterLog: FileLogger;

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;

        this.USERS_FNAME_MAP = new Map();
        this.TARGET_FNAME_MAP = new Map();

        this.isConnected = false;
        this.isReconnecting = false;

        // this.farcasterLog = new FileLogger({ folder: './logs-farcaster-out', printconsole: true });

        this.subscriberStream();
    }

    private bytesToHex(value: Uint8Array): `0x${string}` {
        return `0x${Buffer.from(value).toString("hex")}`;
    }

    private hubProtocolToVerificationProtocol(protocol: Protocol): VerificationProtocol {
        switch (protocol) {
            case Protocol.ETHEREUM:
                return "ethereum";
            // case Protocol.SOLANA:
            //     return "solana";
        }
    }

    private protocolBytesToString(bytes: Uint8Array, protocol: Protocol | VerificationProtocol): string {
        switch (protocol) {
            case Protocol.ETHEREUM:
            case "ethereum":
                return this.bytesToHex(bytes);
            // case Protocol.SOLANA:
            //   case "solana":
            // return bytesToBase58(bytes)._unsafeUnwrap();
            default:
                throw new Error(`Unexpected protocol: ${protocol}`);
        }
    }

    private farcasterTimeToDate(time: number): Date;
    private farcasterTimeToDate(time: null): null;
    private farcasterTimeToDate(time: undefined): undefined;
    private farcasterTimeToDate(time: number | null | undefined): Date | null | undefined {
        if (time === undefined) return undefined;
        if (time === null) return null;
        const result = fromFarcasterTime(time);
        if (result.isErr()) throw result.error;
        return new Date(result.value);
    }

    async insertMentions(text: string, mentions: number[], mentionsPositions: number[]): Promise<string> {
        const splitter = new GraphemeSplitter();
        const graphemes = splitter.splitGraphemes(text);

        // Normalize positions by mapping each visual position to grapheme index
        const normalizedPositions = mentionsPositions.map((pos) =>
            splitter.splitGraphemes(text.slice(0, pos)).length
        );

        // Use the correct position from mentionsPositions
        for (let i = mentions.length - 1; i >= 0; i--) {
            const mention = mentions[i];
            const fName = await this.handleUserFid(mention);
            const position = mentionsPositions[i];
            graphemes.splice(position, 0, `@${fName}`);
        }
        return graphemes.join('');
    }

    private convertProtobufMessageBodyToJson(message: Message): MessageBodyJson {
        let body: MessageBodyJson;
        switch (message.data?.type) {
            case MessageType.CAST_ADD: {
                if (!message.data.castAddBody) {
                    console.error("Missing castAddBody");
                    return
                }
                const {
                    embeds: embedsFromCastAddBody,
                    mentions,
                    mentionsPositions,
                    text,
                    parentCastId,
                    parentUrl,
                    type,
                } = message.data.castAddBody;

                const embeds: string[] = [];

                for (const embed of embedsFromCastAddBody) {
                    if (typeof embed.castId !== "undefined") {
                        embeds.push(this.bytesToHex(embed.castId.hash));
                    }
                    // We are going "one of" approach on the embed Cast Id and URL.
                    // If both are set its likely a client attributing itself with the same
                    // cast information. If it is a different URL representing a different cast
                    // that would be inaccurate way to push data to the protocol anyway.
                    // Eventually we may want to attribute which client quoted cast was shared
                    // from - but that will require a data model change on how messages are stored.
                    else if (typeof embed.url !== "undefined") {
                        embeds.push(embed.url);
                    }
                }

                body = {
                    embeds: embeds,
                    mentions,
                    mentionsPositions,
                    text,
                    type,
                    parent: parentCastId ? { fid: parentCastId.fid, hash: this.bytesToHex(parentCastId.hash) } : parentUrl,
                };
                break;
            }
            case MessageType.CAST_REMOVE: {
                if (!message.data.castRemoveBody) throw new Error("Missing castRemoveBody");
                const { targetHash } = message.data.castRemoveBody;
                body = { targetHash: this.bytesToHex(targetHash) };
                break;
            }
            case MessageType.REACTION_ADD:
            case MessageType.REACTION_REMOVE: {
                if (!message.data.reactionBody) throw new Error("Missing reactionBody");
                if (message.data.reactionBody.targetCastId) {
                    const {
                        type,
                        targetCastId: { fid, hash },
                    } = message.data.reactionBody;
                    body = { type, target: { fid, hash: this.bytesToHex(hash) } };
                } else if (message.data.reactionBody.targetUrl) {
                    const { type, targetUrl } = message.data.reactionBody;
                    body = { type, target: targetUrl };
                } else {
                    throw new Error("Missing targetCastId and targetUrl on reactionBody");
                }
                break;
            }
            case MessageType.LINK_ADD:
            case MessageType.LINK_REMOVE: {
                if (!message.data.linkBody) throw new Error("Missing linkBody");
                const target = message.data.linkBody.targetFid;
                if (!target) throw new Error("Missing linkBody target");
                const { type, targetFid, displayTimestamp } = message.data.linkBody;
                body = { type, targetFid };
                if (displayTimestamp) {
                    const displayTimestampUnixResult = fromFarcasterTime(displayTimestamp);
                    if (displayTimestampUnixResult.isErr()) throw displayTimestampUnixResult.error;
                    body.displayTimestamp = displayTimestampUnixResult.value;
                }
                break;
            }
            case MessageType.LINK_COMPACT_STATE: {
                if (!message.data.linkCompactStateBody) throw new Error("Missing linkCompactStateBody");
                const { type, targetFids } = message.data.linkCompactStateBody;
                body = { type, targetFids };
                break;
            }
            case MessageType.VERIFICATION_ADD_ETH_ADDRESS: {
                if (!message.data.verificationAddAddressBody) {
                    throw new Error("Missing verificationAddAddressBody");
                }
                const { address, claimSignature, blockHash, protocol } = message.data.verificationAddAddressBody;
                body = {
                    address: this.protocolBytesToString(address, protocol),
                    claimSignature: this.protocolBytesToString(claimSignature, protocol),
                    blockHash: this.protocolBytesToString(blockHash, protocol),
                    protocol: this.hubProtocolToVerificationProtocol(protocol),
                };
                break;
            }
            case MessageType.VERIFICATION_REMOVE: {
                if (!message.data.verificationRemoveBody) throw new Error("Missing verificationRemoveBody");
                const { address, protocol } = message.data.verificationRemoveBody;
                body = {
                    address: this.protocolBytesToString(address, protocol),
                    protocol: this.hubProtocolToVerificationProtocol(protocol),
                };
                break;
            }
            case MessageType.USER_DATA_ADD: {
                if (!message.data.userDataBody) throw new Error("Missing userDataBody");
                const { type, value } = message.data.userDataBody;
                body = { type, value };
                break;
            }
            case MessageType.USERNAME_PROOF: {
                if (!message.data.usernameProofBody) throw new Error("Missing usernameProofBody");
                const { timestamp, name, owner, signature, fid, type } = message.data.usernameProofBody;
                body = {
                    timestamp,
                    name: this.bytesToHex(name),
                    owner: this.bytesToHex(owner),
                    signature: this.bytesToHex(signature),
                    fid,
                    type,
                };
                break;
            }
            default:
                // TODO: Once we update types in upstream @farcaster/hub-nodejs, switch to this
                // assertUnreachable(message.data.type);
                throw new Error(`Unknown message type ${message.data?.type}`);
        }

        return body;
    }

    private async subscriberStream() {
        const result = await hubClient.subscribe({
            eventTypes: [
                HubEventType.MERGE_MESSAGE, HubEventType.PRUNE_MESSAGE,
                HubEventType.REVOKE_MESSAGE, HubEventType.MERGE_ON_CHAIN_EVENT,
            ], // fromId: fromEventId,       // the last event we processed
        })


        if (result.isErr()) {
            console.error(result.error + '\nError starting stream');
            this.reconnect();
            return
        }

        this.isConnected = true;
        this.isReconnecting = false;


        result.match(
            (stream) => {
                // `Subscribed to stream from ${fromEventId ? `event ${fromEventId}` : 'head'}`
                console.info(`Subscribed to Farcaster Stream: HEAD`)         //current event

                // Manually trigger the 'close' event for testing // Simulate close after 3 seconds
                // setTimeout(() => { console.log("Simulating stream end..."); stream.emit('end'); }, 10000);
                // setTimeout(() => { console.log("Simulating stream close..."); stream.emit('close'); stream.emit('close'); }, 10000);

                stream.on('data', async (e: HubEvent) => {
                    this.handleEvent(e)
                    saveLatestEventId(e.id)
                    this.eventBus.publish("LAST_EVENT_ID", e.id);
                })

                stream.on('end', async () => {
                    console.warn(`Hub stream ended`)
                    // console.log(`Stream object details on END:`);
                    // this.logRelevantStreamDetails(stream);
                    // this.isConnected = false;
                })

                stream.on('close', async () => {
                    console.warn(`Hub stream closed`)
                    // console.log(`Stream object details on CLOSE:`);
                    // this.logRelevantStreamDetails(stream);
                    this.isConnected = false;
                    this.reconnect();
                })
            }, (e) => { console.error(e, 'Error streaming data.') })
    }


    private reconnect() {
        console.log(`Reconnect!`);
        if (!this.isConnected && !this.isReconnecting) {
            console.log(`Reconnecting in 1 second...`);
            this.isReconnecting = true;

            setTimeout(() => {
                if (!this.isConnected)
                    this.subscriberStream();
            }, 2777); // 1-second delay
        }
    }


    private logRelevantStreamDetails(stream: any) {
        const keysOfInterest = ['error', 'statusCode', 'closed', 'destroyed', '_readableState', 'call'];
        const filteredDetails: Record<string, any> = {};

        keysOfInterest.forEach((key) => {
            if (key in stream) {
                filteredDetails[key] = stream[key];
            }
        });

        console.log(
            `Filtered stream details:`,
            inspect(filteredDetails, { depth: 2, colors: true })
        );
    }

    private async handleEvent(event: HubEvent) {
        switch (event.type) {
            case HubEventType.MERGE_MESSAGE: {
                const msg = event.mergeMessageBody!.message!
                const msgType = msg.data!.type

                switch (msgType) {
                    case MessageType.CAST_ADD: {
                        this.handleAddCasts([msg]);
                        break
                    }
                    case MessageType.CAST_REMOVE: {
                        // this.deleteCasts([msg]);
                        break
                    }
                    case MessageType.VERIFICATION_ADD_ETH_ADDRESS: {
                        // this.insertVerifications([msg]);
                        break
                    }
                    case MessageType.VERIFICATION_REMOVE: {
                        // this.deleteVerifications([msg]);
                        break
                    }
                    case MessageType.USER_DATA_ADD: {
                        // this.insertUserDatas([msg]);
                        break
                    }
                    case MessageType.REACTION_ADD: {
                        // await insertReactions([msg])
                        // this.insertReactions([msg]);
                        break
                    }
                    case MessageType.REACTION_REMOVE: {
                        // await deleteReactions([msg])
                        // this.deleteReactions([msg]);
                        break
                    }
                    case MessageType.LINK_ADD: {
                        // await insertLinks([msg])
                        // this.insertLinks([msg]);
                        break
                    }
                    case MessageType.LINK_REMOVE: {
                        // await deleteLinks([msg])
                        // this.deleteLinks([msg]);
                        break
                    }
                    default: {
                        // log.debug('UNHANDLED MERGE_MESSAGE EVENT', event.id)
                        // console.debug('UNHANDLED MERGE_MESSAGE EVENT', event.id)
                        // this.eventBus.publish("LOG", 'UNHANDLED MERGE_MESSAGE EVENT: ' + event.id);
                    }
                }

                break
            }
            case HubEventType.PRUNE_MESSAGE: {
                const msg = event.pruneMessageBody!.message!
                const msgType = msg.data!.type

                switch (msgType) {
                    case MessageType.CAST_ADD: {
                        // await pruneCasts([msg])
                        // this.handleData_new([msg]);
                        break
                    }
                    case MessageType.REACTION_ADD: {
                        // await pruneReactions([msg])
                        // this.handleData_new([msg]);
                        break
                    }
                    case MessageType.LINK_ADD: {
                        // await pruneLinks([msg])
                        // this.handleData_new([msg]);
                        break
                    }
                    default: {
                        // log.debug(msg.data, 'UNHANDLED PRUNE_MESSAGE EVENT')
                        // console.log(msg.data, 'UNHANDLED PRUNE_MESSAGE EVENT')
                        // this.eventBus.publish("LOG", 'UNHANDLED PRUNE_MESSAGE EVENT ' + msg.data);
                    }
                }

                break
            }
            case HubEventType.REVOKE_MESSAGE: {
                // Events are emitted when a signer that was used to create a message is removed
                // TODO: handle revoking messages
                break
            }
            case HubEventType.MERGE_ON_CHAIN_EVENT: {
                const onChainEvent = event.mergeOnChainEventBody!.onChainEvent!

                switch (onChainEvent.type) {
                    case OnChainEventType.EVENT_TYPE_ID_REGISTER: {
                        // await insertRegistrations([onChainEvent])
                        break
                    }
                    case OnChainEventType.EVENT_TYPE_SIGNER: {
                        // await insertSigners([onChainEvent])
                        break
                    }
                    case OnChainEventType.EVENT_TYPE_STORAGE_RENT: {
                        // await insertStorage([onChainEvent])
                        break
                    }
                }

                break
            }
            default: {
                // log.debug('UNHANDLED HUB EVENT', event.id)
                console.log('UNHANDLED HUB EVENT', event.id)
                // this.eventBus.publish("LOG", 'UNHANDLED HUB EVENT ' + event.id);
                break
            }
        }
        // await job.updateProgress(100)
    }

    public async getTrendingFeed(filter = FilterType.GlobalTrending) {
        let trendingFeed = "";
        try {
            const feed = await neynarClient.fetchFeed(
                FeedType.Filter,
                { filterType: filter, }
            );
            for (const cast of Object.values(feed.casts))
                trendingFeed += `${cast.author.display_name}: ${cast.text}`;
        } catch (err) {
            console.error("Error fetching Farcaster Feed", err);
        }
        return trendingFeed;
    }

    private async fetchUserData(fid: number): Promise<any> {
        try {
            const data = await neynarClient.fetchBulkUsers([fid]);
            let result: any;
            if(data.users.length > 0) {
                result = {
                    username: data.users[0].username,
                    display_name: data.users[0].display_name,
                    // verified_accounts is not being returned here
                };

                if(data.users[0].experimental) {
                    if(data.users[0].experimental.neynar_user_score){
                    result.neynar_user_score = data.users[0].experimental.neynar_user_score;
                    }
                }
            } else {
                // handle the case where data.users.length is 0
            }
        } catch (error) {
            // handle the error
            console.log(error)
        }
    }

    // private async getUserData(fid: number) {
    //     neynarClient.fetchBulkUsers([fid])
    //         .then((data) => {
    //             // console.log(response);

    //             const result = {};

    //             if(data.users.length>0) {
    //              result.username = data.users[0].username);
    //              result.display_name = data.users[0].display_name)

    //             if(data.users[0].experimental)
    //                 result.neynar_user_score = data.users[0].experimental.neynar_user_score)

    //             if (data.users[0].verified_accounts.length > 0) {
    //                 const verified_accounts_platform = data.users[0].verified_accounts[0].platform)
    //                 const verified_accounts_username = data.users[0].verified_accounts[0].username)
    //             }
    //         }

                // botConfig.TARGETS[0]

                // {
                //     "users": [
                //       {
                //         "object": "user",
                //         "fid": 3,
                //         "username": "string",
                //         "display_name": "string",
                //         "custody_address": "string",
                //         "pfp_url": "string",
                //         "profile": {
                //           "bio": {
                //             "text": "string",
                //             "mentioned_profiles": [
                //               "string"
                //             ]
                //           },
                //           "location": {
                //             "latitude": 0,
                //             "longitude": 0,
                //             "address": {
                //               "city": "string",
                //               "state": "string",
                //               "state_code": "string",
                //               "country": "string",
                //               "country_code": "string"
                //             }
                //           }
                //         },
                //         "follower_count": 0,
                //         "following_count": 0,
                //         "verifications": [
                //           "string"
                //         ],
                //         "verified_addresses": {
                //           "eth_addresses": [
                //             "string"
                //           ],
                //           "sol_addresses": [
                //             "string"
                //           ]
                //         },
                //         "verified_accounts": [
                //           {
                //             "platform": "x",
                //             "username": "string"
                //           }
                //         ],
                //         "power_badge": true,
                //         "experimental": {
                //           "neynar_user_score": 0
                //         },
                //         "viewer_context": {
                //           "following": true,
                //           "followed_by": true,
                //           "blocking": true,
                //           "blocked_by": true
                //         }
                //       }
                //     ]
                //   }
    //         })
    //         .catch(error => {
    //             console.log(error);
    //         })
    // }

    /**
     * Function to publish a message (cast) using neynarClient.
     * @param msg - The message to be published.
     * @returns A promise that resolves when the operation completes.
     * Example of `response_data`:
        {
            hash: '0xbb89163dc43e88f05ff2e1fb0dbb8b781ddf547c',
            author: {
                object: 'user',
                fid: 527313,
                username: 'nounspacetom',
                display_name: 'nounspaceTom.eth',
                pfp_url: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/46134281-9cbd-431e-01cc-d128c7695700/original',
                custody_address: '0xaa3ea790b0d714dcab0bdb7a02a336393dd2e2d9',
                profile: { bio: [Object] },
                follower_count: 8377,
                following_count: 1258,
                verifications: [ '0x06ae622bf2029db79bdebd38f723f1f33f95f6c5' ],
                verified_addresses: { eth_addresses: [Array], sol_addresses: [] },
                verified_accounts: null,
                power_badge: true
            },
            text: "Here's to new beginnings! I'm thrilled to join this vibrant community, eager to learn..."
        }
     */
    private async publishToFarcaster(msg: string, options: any) {
        if (botConfig.LOG_MESSAGES) {
            let logid = "publishToFarcaster";
            // this.farcasterLog.log(`msg: ${msg}`, logid);
            // this.farcasterLog.log(`options:`, logid);
            // this.farcasterLog.log(options, logid);
        }

        if (!botConfig.PUBLISH_TO_FARCASTER) {
            console.log(Yellow + "PUBLISH_TO_FARCASTER OFF" + Reset);
            return
        }

        neynarClient
            .publishCast(botConfig.SIGNER_UUID, msg, options)
            .then(response_data => {
                console.log(Yellow + "Cast published successfully: " + response_data.hash + Reset);
            })
            .catch(error => {
                if (isApiErrorResponse(error)) {
                    console.error(Red + error.response.data + Reset);
                } else {
                    console.error(Red + "Failed to publish cast: " + error + + Reset);
                }
            });


        try {
            if ((options.replyTo) && (options.parent_author_fid)) {
                neynarClient.publishReactionToCast(
                    botConfig.SIGNER_UUID,
                    'like',
                    options.replyTo,
                    options.parent_author_fid
                ).then(response => {
                    // console.log('Publish Reaction Operation Status:', response); // Outputs the status of the reaction post
                }).catch(error => {
                    if (isApiErrorResponse(error)) {
                        console.error(Red + error.response.data + Reset);
                    } else {
                        console.error(Red + "Failed to publish Reaction: " + error + + Reset);
                    }
                });
            }
        } catch (error) {
            console.error(Red + "Failed to publish Reaction: " + error + + Reset);
        }
    }

    // public async publishUserReply(msg: string, parentHash: string, parentAuthorFid: number) {
    //     // Using the neynarClient to publish the cast.
    //     const options = {
    //         replyTo: parentHash,
    //         parent_author_fid: parentAuthorFid,
    //     }
    //     this.publishToFarcaster(msg, options);
    // }
    public async publishUserReply(msg: string, parentHash: string, parentAuthorFid: number) {
        //experimental
        // const userdata = await this.fetchUserData(parentAuthorFid);
        // console.dir(userdata);

        // Using the neynarClient to publish the cast.
        const options = {
            replyTo: parentHash,
            parent_author_fid: parentAuthorFid,
        }

        // Wait for a random time between 5 and 10 minutes before publishing
        const delayInMinutes = randomInt(5, 10);
        setTimeout(() => {
            this.publishToFarcaster(msg, options);
        }, delayInMinutes * 60 * 1000); // convert minutes to milliseconds
        console.log(`Scheduling msg to fid '${parentAuthorFid}' in ${delayInMinutes} minutes`);
    }

    public async publishNewChannelCast(msg: string) {
        // Using the neynarClient to publish the cast.
        const options = {
            channelId: botConfig.CAST_TO_CHANNEL
        }

        this.publishToFarcaster(msg, options);
    };

    private async handleData_new(msgs: Message[]): Promise<void> {
        for (let m = 0; m < msgs.length; m++) {
            const message = msgs[m];
            const body = this.convertProtobufMessageBodyToJson(message);
            // console.dir(body);

            if ('text' in body && 'mentions' in body && 'mentionsPositions' in body) {
                if (body.mentions instanceof Array && body.mentionsPositions instanceof Array) {
                    let textContent = body.text;
                    if (body.mentions.length > 0)
                        textContent = await this.insertMentions(body.text, body.mentions, body.mentionsPositions);
                    body.textWithMentions = textContent;
                    const fName = await this.handleUserFid(message.data.fid);
                    const castObj = {
                        fid: message.data.fid,
                        fName,
                        type: message.data.type,
                        timestamp: this.farcasterTimeToDate(message.data.timestamp),
                        // hashScheme: message.hashScheme,
                        // signatureScheme: message.signatureScheme,
                        // hash: message.hash,
                        // signer: message.signer,
                        // raw: Message.encode(message).finish(),
                        body
                    }
                }
            }
        }
    }


    private async handleAddCasts(msgs: Message[]): Promise<void> {
        for (let m = 0; m < msgs.length; m++) {
            const data = msgs[m].data;
            if (data.castAddBody) {

                if (botConfig.TARGETS.includes(data.fid)) {
                    // Target Add New Cast

                    //TODO: retro alimentar issue

                    // this.handleTargetAddCast(msgs[m])
                    return;
                }

                if (data.castAddBody.parentCastId && botConfig.TARGETS.includes(data.castAddBody.parentCastId.fid)) {
                    // Target found on parentCastId (Reply)
                    this.handleReceivedReply(msgs[m]);
                    return;
                }

                const foundMention = data.castAddBody.mentions.find(mention => botConfig.TARGETS.includes(mention));
                if (foundMention) {
                    // Target found on Mention
                    this.handleMentioned(msgs[m], foundMention);
                    return;
                }

                if (data.castAddBody.parentUrl && urlMatchesTargetChannel(data.castAddBody.parentUrl)) {
                    // parentUrl Matches Channel
                    this.handleTargetChannelCast(msgs[m]);
                    return;
                }

                // DEBUG (optional logging block)
                //if (data.castAddBody.parentUrl) {
                //    console.log("New Cast to " + data.castAddBody.parentUrl);
                //    console.log(formatCasts(msgs));
                //}

            }
        }
    }


    private async handleUserFid(fid: number): Promise<string> {
        // check if fid is on the users fname cache
        if (!this.USERS_FNAME_MAP.has(fid)) {
            const result = await this.getFnameFromFid(fid);
            if (result.isOk()) {
                this.USERS_FNAME_MAP.set(fid, result.value);
            }
        }

        // trim max user fname cache
        if (this.USERS_FNAME_MAP.size >= botConfig.MAX_USER_CACHE) {
            this.USERS_FNAME_MAP.delete(this.USERS_FNAME_MAP.keys().next().value as number);
        }

        return this.USERS_FNAME_MAP.get(fid)!;
    }

    private async getFnameFromFid(fid: number): HubAsyncResult<string> {
        const result = await hubClient.getUserData({ fid: fid, userDataType: UserDataType.USERNAME });
        return ok(
            result.match(
                (message) => {
                    if (isUserDataAddMessage(message)) {
                        return message.data.userDataBody.value;
                    } else {
                        return "";
                    }
                },
                () => `${fid}!`, // fallback to FID if no username is set
            ),
        );
    };

    private async handleTargetFid(fid: number): Promise<string> {
        if (!this.TARGET_FNAME_MAP.has(fid)) {
            const result = await this.getFnameFromFid(fid);
            if (result.isOk()) {
                this.TARGET_FNAME_MAP.set(fid, result.value);
            }
        }

        return this.TARGET_FNAME_MAP.get(fid)!;
    }


    private async handleTargetAddCast(message: Message) {
        const body = this.convertProtobufMessageBodyToJson(message);
        const tName = await this.handleTargetFid(message.data.fid);  // target Name

        // if has parentCastId, its a new reply message
        if (message.data.castAddBody.parentCastId) {
            const fName = await this.handleUserFid(message.data.castAddBody.parentCastId.fid); // farcaster (User)Name 
            // console.log(tName + " Replying to " + fName);
            const chatmessage = {
                name: tName,
                message: " Reply to " + fName + ": " + message.data.castAddBody.text
            }
            // this.eventBus.publish("CAST_ADD", chatmessage);
        } else {
            // console.log(tName + " Add New Cast ");
            const chatmessage = {
                name: tName,
                message: message.data.castAddBody.text
            }
            // this.eventBus.publish("CAST_ADD", chatmessage);
        }
    }

    private async handleReceivedReply(message: Message): Promise<void> {
        const tName = await this.handleTargetFid(message.data.castAddBody.parentCastId.fid);  // farcaster (User)Name 
        const castObj = await this.createCastObj(message);
        // console.dir(castObj);
        this.eventBus.publish("WAS_REPLIED", castObj);
    }

    private async handleMentioned(message: Message, foundMention: number): Promise<void> {
        const tName = await this.handleTargetFid(foundMention);  // target Name
        const castObj = await this.createCastObj(message);
        // console.log(tName + " was mentioned by " + castObj.fName);
        // console.dir(castObj);
        this.eventBus.publish("WAS_MENTIONED", castObj);
    }


    private async handleTargetChannelCast(message: Message) {
        if (message.data.castAddBody.parentUrl) {
            // console.warn("New Message at Channel: " + message.data.castAddBody.parentUrl);
            const castObj = await this.createCastObj(message);
            // console.dir(castObj);
            // generateTomReplyMemory(data.fid, data.castAddBody.text);
            this.eventBus.publish("CHANNEL_NEW_MESSAGE", castObj);
        }
    }


    private async createCastObj(message: Message): Promise<BotCastObj> {
        const body = this.convertProtobufMessageBodyToJson(message) as CastAddBodyJson;
        const fName = await this.handleUserFid(message.data.fid);        // farcast (User)Name 
        const hash = this.bytesToHex(message.hash);

        if ('text' in body && 'mentions' in body && 'mentionsPositions' in body) {
            if (body.mentions instanceof Array && body.mentionsPositions instanceof Array) {

                let textContent = body.text;
                if (body.mentions.length > 0)
                    textContent = await this.insertMentions(body.text, body.mentions, body.mentionsPositions);
                body.textWithMentions = textContent;
            }
        }

        return {
            fid: message.data.fid,
            fName,
            hash,
            type: message.data.type,
            timestamp: this.farcasterTimeToDate(message.data.timestamp),
            body
        }
    }

}
