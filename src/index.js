import overlays from "./modules/overlays.js"

import { chatClient } from "./modules/ChatClient.js";
import gallery from "./modules/superrare/gallery.js"

overlays.init();

window.twitchBits = {
    chatClient:chatClient,
    srGallery:gallery,
    overlays:overlays, 
}


