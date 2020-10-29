/**
 * Trigger things and respond to your Twitch chat messages using !commands
 * 
 * Give you and your mods control over overlay elements, messages, popups.
 * Respond to chat commands like !help !what and more.
 * 
 * The message strings referenced here can all be found in strings.js
 */


import log from './log.js'
import utils from "./utils.js"
import strings from "./strings.js"

import gallery from "./superrare/gallery.js"

import { chatClient as chat } from "./ChatClient.js";


let
    autoActionTimeout = -1,
    autoActionIndex = 0;

const
    actions = {},

    // action ids for periodic auto-bot messaging
    autoActions = ["!help", "!superrare"],
    autoActionsOrder = utils.randomIndexArray(autoActions.length),
    autoActionTimes = { min: 10 * 60, max: 15 * 60 },

    /**
     * is the context user the current broadcaster?
     */
    isBroadcaster = context => context["badges-raw"] != null && context["badges-raw"].startsWith("broadcaster"),

    isMod = context => context.mod,
    isSub = context => context.subscriber,
    canUsePublicAction = ctx => isSub(ctx) || isMod(ctx) || isBroadcaster(ctx),

    /**
     * setup a named text query action.
     * 
     * Example: Passing an actionName of "!help" will set up the action command "!help" 
     * When users enter that in the chat the bot will respond to the chat using the `bot_!help` string field (see strings.js)
     */
    registerTextQueryAction = (actionName, security, textGenerator) => {
        registerAction(actionName, security, (_, __) => {
            chat.sayFromChannel(
                (typeof textGenerator === 'function')
                    ? textGenerator()
                    : utils.randomStringFromSet(`bot_${actionName}`, strings)
            );
        });
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
        registerTextQueryAction("!help", canUsePublicAction);
        registerTextQueryAction("!superrare", canUsePublicAction);

        registerTextQueryAction("!art", canUsePublicAction, () => {
            // a custom textGenerator, called when the action is triggered
            const asset = gallery.getCurrentAsset();
            if (asset === null) return null;

            const a = strings['bot_!art'][0];
            const b = strings['bot_!art'][1];
            // [`Viewing - // `, ` // - Find it on SuperRare `]
            const message = `${a} ${asset.name} ${b} ${encodeURI(asset.url)}`;

            return message;
        });
    },

    registerAction = (command, security, handle) => actions[command] = { security: security, handle: handle },


    /**
     * Private: Mod/Broadcaster commands to control on-screen overlays/popups/tasks, etc.
     */
    initPrivateChatActions = () => {

        const security = (context, _) => isMod(context) || isBroadcaster(context);

        /**
         * Command: !autoChat_start / !autoChat_stop
         * Description: start or stop the periodic autobot chats from happening
         * Security: broadcaster or mod
        */
        registerAction('!autoChat_start', security, startAutoActions);
        registerAction('!autoChat_stop', security, stopAutoActions);

        registerAction('!chatbot_disable', security, () => chatbot.disabled = true);
        registerAction('!chatbot_enable', security, () => {
            chatbot.disabled = false;
            actions["!help"].handle();
        });

        /**
         * 
         */
        registerAction('!gallery_show', security, (_, txt) => gallery.show(txt));
        registerAction('!gallery_hide', security, (_, __) => gallery.hide());
        registerAction('!gallery_next', security, (_, __) => gallery.next());
        registerAction('!gallery_prev', security, (_, __) => gallery.prev());
    },


    /**
     * Start periodically chatting via the bot using the messages referenced in autoActions
     */
    startAutoActions = () => {

        stopAutoActions();

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
        initPrivateChatActions();
        startAutoActions();

        // send initial 'what the channel is' message on start-up...
        actions["!help"].handle();
        actions["!superrare"].handle();
    };

// 
actions.init = init;
actions.startAutoActions = startAutoActions;
actions.stopAutoActions = stopAutoActions;

export default actions;


