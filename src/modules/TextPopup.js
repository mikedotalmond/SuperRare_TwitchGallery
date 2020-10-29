/**
 * 
 */

import { gsap } from "gsap";
import log from './log.js';

const conf_showPopup = { delay: 0, autoAlpha: 1, duration: 0.3, ease: "power4.In" };
const conf_hidePopup = { autoAlpha: 0, duration: 0.2, ease: 'power4.Out' };
const defaultTextStyle = { 'font-size': '46px', 'color': 'white', 'background-color': 'black' };

class TextPopup {

    constructor(textSelector, containerSelector) {
        this.textSelector = textSelector;
        this.containerSelector = containerSelector;
        this.hideTimer = -1;

        gsap.to(this.containerSelector, conf_hidePopup);
    }

    show(message, duration, delay, textStyles) {

        if (isNaN(delay) || delay < 0) delay = 0;
        conf_showPopup.delay = delay;

        if (textStyles !== null) {
            if (typeof textStyles === "undefined") textStyles = defaultTextStyle;
            gsap.set(this.textSelector, textStyles);
        }

        gsap.set(this.textSelector, { innerHTML: message });

        gsap.set(this.containerSelector, { autoAlpha: 0 });
        gsap.to(this.containerSelector, conf_showPopup);

        clearTimeout(this.hideTimer);
        if (!isNaN(duration) && duration > 0) {
            duration = Math.max(0.3, duration);
            this.hideTimer = setTimeout(() => { this.hide(); }, duration * 1000);
        }
    }

    hide() {
        gsap.to(this.containerSelector, conf_hidePopup);
    }

}

export { TextPopup };