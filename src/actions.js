(() => {

    const actions = {};

    // =======================================
    // Command: !alert <text>
    // Description: will display whatever text comes after the !alert command
    // =======================================
    actions['!alert'] = {
        security: (context, textContent) => {
            return context.mod || (context["badges-raw"] != null && context["badges-raw"].startsWith("broadcaster"))
        },
        handle: (context, textContent) => {
            console.log(context);
            console.log(textContent);
            overlays.popup.show(textContent);
        }
    };


    // =======================================
    // Command: !delete
    // Description: This delete command resets the whole pop up system
    // =======================================
    actions['!delete'] = {
        security: (context, textContent) => {
            return context.mod || (context["badges-raw"] != null && context["badges-raw"].startsWith("broadcaster"))
        },
        handle: (context, textContent) => {
            overlays.popup.delete();
        }
    };

    actions['!about'] = {
        security: (context, textContent) => {
            return true;
        },
        handle: (context, textContent) => {
            //TODO: send message
        }
    };



    settings.actions = actions;

})();