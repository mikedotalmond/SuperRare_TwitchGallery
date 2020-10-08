/**
 * Entry point for creating a new tmi.client to listen for Twitch channel and chat events.
 */

const chatbot = { connected: false, client: null };

((config, log) => {

    let client = null;

    const
        actions = config.actions,
        channel = config.channel,
        strings = config.strings,
        sayFromChannel = (message) => client.say(channel, message),
        sayFromChannelPrefixed = (prefix, message) => sayFromChannel(`${prefix}${message}`),
        sayFromChannelBot = (message) => sayFromChannelPrefixed(config.botMessagePrefix, message),

        /**
         * Delete a chat message by id, and respond via the bot in chat if responseKey is set/exists in the strings data.
         */
        deleteMessageAndRespond = (context, responseKey) => {
            client
                .deletemessage(channel, context.id)
                .finally(() => {
                    if (responseKey != null) {
                        let response = utils.randomStringFromSet(responseKey, strings);
                        if (response != null && response != responseKey) sayFromChannelBot(`${context.username} ${response}`);
                    }
                });
        },


        // TODO: implement a more useful message sanitizer/monitor and implement response messaging. 
        // for now it only filters ALL CAPS messages
        sanitiseMessage = message => {
            if (message == null || message.length == 0) return { ok: false, reason: null, message: null };

            const response = { ok: true, reason: null, message: message };

            // check for shouty people
            const allCaps = message.toUpperCase();
            if (message == allCaps) {
                response.ok = false;
                response.reason = "bot_mod_all_caps";
            }
            // TODO: a percentage ALLCAPS check, threshold, etc

            return response;
        },

        /**
         * Takes a command string and processes it. 
         * A command string should start with an "!" and be immediately followed by a command word.
         * 
         * Further message content after the command sequence (separated by a space) will be passed to the associated action handler
         * see handlers.js
         * 
         * Example:
         * `!alert Just a test.`
         * `!delete`
         * 
         */
        processCommand = (context, msg, self) => {

            const spaceIndex = msg.indexOf(" ");

            // grab message/data after the command 
            const parsedMessage = (spaceIndex > -1) ? msg.substring(spaceIndex + 1) : "";

            let command = (spaceIndex > -1) ? msg.substring(0, spaceIndex) : msg;
            const sanitisedCommand = utils.sanitizeCommand(command);
            if (sanitisedCommand == null) return;

            command = `!${sanitisedCommand}`;
            if (actions.hasOwnProperty(command) && actions[command].security(context, command)) {
                actions[command].handle(context, parsedMessage);
            }
        },


        /**
         * handle a 'chat' message type
         */
        processChatMessage = (context, message) => {
            const messageResult = sanitiseMessage(message);

            if (!messageResult.ok) {
                log("Message failed validation. Will delete", messageResult);
                deleteMessageAndRespond(context, messageResult.reason);
                // invalid messages are ignored from further processing.
                return;
            }
            // TODO: any message further processing/analysis
        },


        /**
         * Process regular message text from chat, whisper, ...
         */
        processMessage = (context, message, self) => {
            if (self) return;

            const messageType = context["message-type"];
            if (messageType == "action") return;

            // Handle different message types..
            switch (messageType) {
                case "chat":
                    processChatMessage(context, message);
                    break;
                case "whisper":
                    log(`processMessage - Someone whispered. Message: ${message}`);
                    break;
                default:
                    log(`processMessage - Unknown message type: ${messageType}, message: ${message}`);
                    break;
            }
        },

        
        /**
         * 
         */
        setupClient = () => {
            client = new tmi.client(clientConfig)
                .on('message', onMessage)
                .on('connected', onConnect)
                .on('disconnected', onDisconnect)
                // .on("clearchat", () => overlays.title.hide())
                .on("cheer", (channel, userstate, message) => {
                    log("onCheer", userstate, message);
                })
                .on("notice", (channel, msgid, message) => {
                    log("onNotice", msgid, message);
                })
                .on("raided", (channel, username, viewers) => {
                    log("onRaided", username, viewers);
                })
                .on("subscription", (channel, username, method, message, userstate) => {
                    log("onSubscription", username, method, message, userstate);
                })
                .on("resub", (channel, username, months, message, userstate, methods) => {
                    log("onResub", username, months, message, userstate, methods);
                    let cumulativeMonths = ~~userstate["msg-param-cumulative-months"];
                })
                .on("subgift", (channel, username, streakMonths, recipient, methods, userstate) => {
                    log("onSubgift", username, streakMonths, recipient, methods, userstate);
                    let senderCount = ~~userstate["msg-param-sender-count"];
                });

            client.connect();
        },

        onMessage = (target, context, msg, self) => {
            if(self) return;

            if (config.debug) log("onMessage", target, context, msg, self);

            const message = msg.trim();
            const isCommand = message.charAt(0) === "!";

            if (isCommand) processCommand(context, message, self);
            else processMessage(context, message, self);
        },

        // start-up
        onConnect = (addr, port) => {
            log(`* Connected to ${addr}:${port}`);
            overlays.title.show(`${config.botMessagePrefix} Ready`.toUpperCase(), 5, 0, { 'font-size': '24px', color: 'green' });
            chatbot.connected = true;
            actions.init();
            srGallery.init();
        },

        // shutdown ongoing processes
        onDisconnect = reason => {
            log(`onDisconnect ${reason}`);
            chatbot.connected = false;
            overlays.title.show(`${config.botMessagePrefix} Disconnected!`, 0, 0,{ 'font-size': '24px', color: 'red' });
            actions.stopAutoActions();
        },

        /**
         * populate tmi.client config with data from the `config` object defined settings.js
         */
        clientConfig = {
            options: { debug: config.debug, clientId: config.clientId },
            connection: { reconnect: true, secure: true },
            identity: config.identity,
            channels: [channel]
        };


    // connect to the selected twitch channel and start to listen for events to react to
    setupClient();

    chatbot.client = client;
    chatbot.say = sayFromChannelBot;
    chatbot.deletemessage = deleteMessageAndRespond;

})(settings, console.log);