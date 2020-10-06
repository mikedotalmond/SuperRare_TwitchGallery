const overlays = {};

overlays.popup = (() => {

    let hideTimer = -1;

    const
        conf_showPopup = { autoAlpha: 1, duration: 0.3, ease: "quad.In" },
        conf_hidePopup = { autoAlpha: 0, duration: 0.2, ease: 'quad.Out' },
        defaultTextStyle = { 'font-size': '42px', 'color': 'white', 'background-color': 'black' },

         /**
          * Display a text popup on screen with the given text.
          * @param message - text message to show
          * @param duration - optional, time in seconds to show the popup for. set null or <0 for indefinite display
          * @param textStyles - optional, css properties to apply to the text prior to showing it
          */
        show = (message, duration, textStyles) => {

            if (typeof textStyles === "undefined") textStyles = defaultTextStyle;

            gsap.set("#popuptext", textStyles);
            gsap.set("#popuptext", { innerHTML: message });

            gsap.set("#popupbox", { autoAlpha: 0 });
            gsap.to("#popupbox", conf_showPopup);

            clearTimeout(hideTimer);
            if (!isNaN(duration) && duration > 0) {
                duration = Math.max(0.3, duration);
                hideTimer = setTimeout(hide, duration * 1000);
            }
        },

        /**
         * Remove popup from screen
         */
        hide = () => { gsap.to("#popupbox", conf_hidePopup); };


    return {
        show: show,
        hide: hide
    };
})();
