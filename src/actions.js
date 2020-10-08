/**
 * Trigger things and respond to your Twitch chat messages using !commands
 * 
 * Give you and your mods control over overlay elements, messages, popups.
 * Respond to chat commands like !help !what and more.
 * 
 * The message strings referenced here can all be found in strings.js
 */
((log) => {

    let
        autoActionTimeout = -1,
        autoActionIndex = 0;

    const
        actions = {},

        // action ids for periodic auto-bot messaging
        autoActions = ["!help", "!superrare"],
        autoActionsOrder = utils.randomIndexArray(autoActions.length),
        autoActionTimes = { min: 5 * 60, max: 10 * 60 },

        /**
         * is the user the current broadcaster?
         */
        isBroadcaster = context => context["badges-raw"] != null && context["badges-raw"].startsWith("broadcaster"),

        /**
         * check user is a mod or the broadcaster for private/restricted command use
         */
        privateSecurityCheck = (context, textContent) => context.mod || isBroadcaster(context),

        /**
         * setup a named text query action.
         * 
         * Example: Passing an actionName of "!help" will set up the action command "!help" 
         * When users enter that in the chat the bot will respond to the chat using the `bot_!help` string field (see strings.js)
         */
        registerSimpleTextQueryChatAction = (actionName, textGenerator) => {
           
            actions[actionName] = {
                security: (_, __) => true, // all users are allowed
                handle: (_, __) => {
                    if (!chatbot.connected) return;

                    let txt;

                    if(typeof textGenerator === 'function') {
                        txt = textGenerator();
                        if(txt == null) return;
                    } else {
                        txt = utils.randomStringFromSet(`bot_${actionName}`, settings.strings);
                    }
                    
                    chatbot.say(txt);
                }
            }
        },

        /*
          * Public / General commands - typically just things for the chatbot to respond to.
          * Add/Remove/Edit entries here as needed, updating the associated content in strings.js as you go.
          * 
          * Commands: Various, see below.
          * Description: General info, see strings.js for all the definitions
          * Security: Anyone in the chat can use these commands
          */
        initPublicChatActions = () => {
            registerSimpleTextQueryChatAction("!help");
            registerSimpleTextQueryChatAction("!superrare");

            registerSimpleTextQueryChatAction("!art", () => { // custom textGenerator
                const asset = srGallery.getCurrentAsset();
                if (asset === null) return null;

                const a = settings.strings['bot_!art'][0];
                const b = settings.strings['bot_!art'][1];
                const message = `${a} ${asset.name} ${b} ${encodeURI(asset.url)}`;

                return message;

            });
        },

        /**
         * Private: Mod/Broadcaster commands to control on-screen overlays/popups/tasks, etc.
         */
        initPrivateChatActions = () => {
            /**
             * Command: !autoChat_start / !autoChat_stop
             * Description: start or stop the periodic autobot chats from happening
             * Security: broadcaster or mod
            */
            actions['!autoChat_start'] = {
                security: privateSecurityCheck,
                handle: (context, textContent) => { startAutoActions(); }
            };
            actions['!autoChat_stop'] = {
                security: privateSecurityCheck,
                handle: (context, textContent) => { stopAutoActions(); }
            };
        },


        /**
         * Start periodically chatting via the bot using the messages referenced in autoActions
         */
        startAutoActions = () => {

            stopAutoActions();

            // log("actions::startAutoActions");
            // log("actions are:", autoActions);
            // log("action order:", autoActionsOrder);

            const time = autoActionTimes.min + Math.random() * (autoActionTimes.max - autoActionTimes.min);
            log(`next auto chat action in ${time} seconds`);

            autoActionTimeout = setTimeout(() => {
                const act = autoActions[autoActionsOrder[autoActionIndex]];

                // log("actions - triggering autoAction", act);
                actions[act].handle();
                autoActionIndex++;

                if (autoActionIndex >= autoActionsOrder.length) {
                    // log("autoActions complete, reshuffling and starting again.");
                    autoActionsOrder.sort(utils.randomSort);
                    autoActionIndex = 0;
                }

                startAutoActions();

            }, time * 1000);
        },

        /**
         * Stop auto chat stuff
         */
        stopAutoActions = () => {
            clearTimeout(autoActionTimeout);
            autoActionTimeout = -1;
        },


        /** init all actions, start auto-chat */
        init = () => {
            log("actions::init");
            initPublicChatActions();
            // initPrivateChatActions();
            // startAutoActions();

            // send initial 'what the channel is' message on startup...
            actions["!help"].handle();
            actions["!superrare"].handle();
        };

    // 
    actions.init = init;
    actions.startAutoActions = startAutoActions;
    actions.stopAutoActions = stopAutoActions;

    //
    // store
    settings.actions = actions;

    //
    // start
    // init();

})(console.log);