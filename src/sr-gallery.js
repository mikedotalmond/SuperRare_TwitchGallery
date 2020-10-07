const srGallery = {};

srGallery.config = {
    userAddress: "0x44821f92d83c5b6055044ebf3de64574c894854a",
    totalUserArtworks: 179, // no api for this, so fill manually for now
    randomOrder: true,
    duration: 120,
    showInfo: false,
    showInfoDuration: 25,
};

((gallery, config, log) => {

    let
        container = null, preloadImg = null,
        userData = null,
        assetOrder = [],
        ignoredAssets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42],
        assetIndex = { current: 0, next: 1 },
        updateTimeout = -1;

    const
        assetData = {
            last: null,
            current: null,
            next: null,
        },

        init = async () => {
            container = document.getElementById("sr-gallery");
            preloadImg = document.getElementById("image-preload");
            hide();

            userData = await srAPI.getUserData(config.userAddress);
            log("userData", userData);

            for (let i = 0; i < config.totalUserArtworks; i++) assetOrder[i] = i;
            if (config.randomOrder) randomiseAssetOrder();

            show();
        },

        nextAssetIndex = () => {

            let
                next = (assetIndex.next + 1) % config.totalUserArtworks,
                sanity = config.totalUserArtworks;

            while (ignoredAssets.indexOf(assetOrder[next]) > -1 && sanity > 0){
                next = (next + 1) % config.totalUserArtworks;
                sanity--;
                log("next index:", next, assetOrder[next], ignoredAssets.indexOf(assetOrder[next]));
            }

            assetIndex.next = next;
        },

        next = async () => {
            log("next");
            assetIndex.prev = assetIndex.current;
            assetIndex.current = assetIndex.next;
            nextAssetIndex();
            await updateState();
        },

        prev = async () => {
            log("prev");
            assetIndex.next = assetIndex.current;
            assetIndex.current = assetIndex.prev;
            if (--assetIndex.prev < 0) assetIndex.prev = config.totalUserArtworks - 1;
            await updateState();
        },

        show = async () => {
            log("show");
            randomiseAssetOrder();
            await updateState();
        },

        hide = () => {
            log("hide");
            clearTimeout(updateTimeout);
            gsap.to("#srgallery_image_a", { autoAlpha: 0 });
        },

        updateState = async () => {
            log("updateState");

            clearTimeout(updateTimeout);

            assetData.current = await srAPI.getUserAssets(config.userAddress, assetOrder[assetIndex.current], 1);
            const currentAsset = assetData.current[0];
           
            const currentImageUrl = currentAsset.image;

            const metadata = await srAPI.getJSONResponse(currentAsset.metadataUri);

            gsap.set("#srgallery_image_a", { autoAlpha: 0 });

            preloadImg.onload = () => {
                gsap.set("#srgallery_image_a", { autoAlpha: 0, "background-image": `url(${preloadImg.src})` });
                gsap.to("#srgallery_image_a", { autoAlpha: 1 });
                preloadImg.src = "";

                updateTimeout = setTimeout(() => next(), config.duration * 1000);

                overlays.title.show(metadata.name, 120);
                overlays.subtitle.show(`${metadata.createdBy}, ${metadata.yearCreated}`, 120, null);
                overlays.desc.show(currentAsset.description, 60, null);
                overlays.info.show("!info for links", 0, null);
            };

            preloadImg.src = currentImageUrl;

            log("assetData", assetData);
            /*  category: "artwork-v2"
                contractAddress: "0xb932a70a57673d89f4acffbe830e8ed7f75fb9e0"​​​
                creator: Object { address: "0x44821f92d83c5b6055044ebf3de64574c894854a", user: {…} }
                description: "A looping GIF sequence."
                id: 4688
                image: "https://ipfs.pixura.io/ipfs/QmejB4FR2F7TVSYq41U2tGxqa5UZwjxC8zoVKBpAz85Zeu"
                likeCount: 0
                media: null
                metadataUri: "https://ipfs.pixura.io/ipfs/QmYtCcba6gPFUUK8tKn88RiL6ojmX86T42Km8cXjxvSFsT"
                name: " Ordinary Oscillations 5 - Heartbeat"
                owner: Object { address: "0x44821f92d83c5b6055044ebf3de64574c894854a", user: {…} }
                tags: Array(6) [ "gif", "loop", "motion", … ]
                url: "https://SuperRare.co/artwork-v2/-ordinary-oscillations-5---heartbeat-4688"
                viewCount: 0
            */ 
           /** asset objects can have media data...
             * media: {…}
                    dimensions: "8025x5076"      ​​​​
                mimeType: "image/jpeg"                ​​​​
                size: "34972690"                ​​​​
                uri: "https://ipfs.pixura.io/ipf...
             */

            log("metadata", metadata);
            /*	" name  Ordinary Oscillations 5 - Heartbeat"
                createdBy	"Mike Almond"
                yearCreated	"2019"
                description	"A looping GIF sequence."
                image	"https://ipfs.pixura.io/ip...."
                tags	
                0	"gif"
                1	"loop"
                2	"motion"
                3	"oscillate"
                4	"rhythmic"
                5	"pulse"
                */
        },

        randomiseAssetOrder = () => {
            assetOrder = assetOrder.sort((a, b) => Math.round((Math.random() * 0.5) * 2.0));
            assetIndex = { current: -1, next: -1 };
            nextAssetIndex();
            assetIndex.current = assetIndex.next;
        };


    gallery.init = init;
    gallery.next = next;
    gallery.prev = prev;
    gallery.show = show;
    gallery.hide = hide;
    gallery.randomiseAssetOrder = randomiseAssetOrder;
    gallery.assetData = assetData;
    gallery.metadata = metadata;

})(srGallery, srGallery.config, console.log);