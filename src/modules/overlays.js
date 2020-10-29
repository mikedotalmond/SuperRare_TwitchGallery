
import { TextPopup } from "./TextPopup"

const

    texts = {
        info: null,
        title: null,
        subtitle: null,
        description: null,
    },

    init = () => {
        texts.info = new TextPopup("#infoText", "#infoBox");
        texts.title = new TextPopup("#titleText", "#titleBox");
        texts.subtitle = new TextPopup("#subtitleText", "#subtitleBox");
        texts.description = new TextPopup("#descText", "#descBox");
    },

    hide = () => {
        texts.title.hide();
        texts.subtitle.hide();
        texts.description.hide();
        texts.info.hide();
    };

export default {
    init, hide, texts
}