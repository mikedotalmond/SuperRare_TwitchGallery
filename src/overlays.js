const overlays = (() => {

    const
        conf_showPopup = { autoAlpha: 1, duration: 0.3, ease: "quad.In" },
        conf_hidePopup = { autoAlpha: 0, duration: 0.2, ease: 'quad.Out' },
        defaultTextStyle = { 'font-size': '46px', 'color': 'white', 'background-color': 'black' },

        setupPopup = (textSelector, containerSelector) => {
            let hideTimer = -1;
        
            /**
            * Display a text popup on screen with the given text.
            * @param message - text message to show
            * @param duration - optional, time in seconds to show the popup for. set null or <0 for indefinite display
            * @param textStyles - optional, css properties to apply to the text prior to showing it
            */
            const
                show = (message, duration, textStyles) => {

                    if(textStyles !== null){
                        if (typeof textStyles === "undefined") textStyles = defaultTextStyle;
                        gsap.set(textSelector, textStyles);
                    }
                   
                    gsap.set(textSelector, { innerHTML: message });

                    gsap.set(containerSelector, { autoAlpha: 0 });
                    gsap.to(containerSelector, conf_showPopup);

                    clearTimeout(hideTimer);
                    if (!isNaN(duration) && duration > 0) {
                        duration = Math.max(0.3, duration);
                        hideTimer = setTimeout(hide, duration * 1000);
                    }
                },

                /**
                 * Remove popup from screen
                 */
                hide = () => { gsap.to(containerSelector, conf_hidePopup); };

            return {
                show: show,
                hide: hide
            };
        };

    return {
        setupPopup: setupPopup
    }
})();

overlays.title = overlays.setupPopup("#titleText", "#titleBox");
overlays.subtitle = overlays.setupPopup("#subtitleText", "#subtitleBox");
overlays.desc = overlays.setupPopup("#descText", "#descBox");
overlays.info = overlays.setupPopup("#infoText", "#infoBox");
