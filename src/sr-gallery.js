const srGallery = {};

srGallery.config = {
    userAddress: "0x44821f92d83c5b6055044ebf3de64574c894854a",
    totalUserArtworks: 179, // no api for this, so fill manually for now
    randomOrder: true,
    infoText : "!art",
    duration: { total: 180, title: 110, subtitle: 109, description: 60 },
};

((gallery, config, log) => {

    let
        container = null, preloadImg = null, overlay,
        userData = null,
        currentAsset = null,
        assetOrder = [],
        // ignoring assets that don't work well at 16:9, and similar/series, and videos,
        // will fix with other display modes at some point
        // also need to handle video assets
        ignoredAssets = [
            0, 3, 5, 7, 11, 17, 23, 25, 27, 31, 32, 36, 37, 40, 41, 42, 44, 45,
            47, 48, 50, 51, 53, 54, 57, 58, 61, 62, 65, 66, 67, 68, 69,
            70, 71, 81, 105, 134, 136/*video*/, 137, 139, 140, 141,
            142, 143, 144, 146, 160, 161, 163, 164, 165, 176, 177, 178
        ],
        assetIndex = { current: 0, next: 1 },
        updateTimeout = -1;

    const
        imageElementId = "#srgallery_image",

        init = async () => {
            container = document.getElementById("sr-gallery");
            preloadImg = document.getElementById("image-preload");
            overlay = document.getElementById("gallery-overlay");
            hide();

            userData = await srAPI.getUserData(config.userAddress);
            log("userData", userData);

            gsap.set(overlay, {autoAlpha:1, top:0, height:'1080px'});

            for (let i = 0; i < config.totalUserArtworks; i++) assetOrder[i] = i;
            resetAssetOrder();

            next();
        },

        nextAssetIndex = () => {

            let
                next = (assetIndex.next + 1) % config.totalUserArtworks,
                sanity = config.totalUserArtworks;

            while (ignoredAssets.indexOf(assetOrder[next]) > -1 && sanity > 0) {
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
            resetAssetOrder();
            await updateState();
        },

        hide = () => {
            log("hide");
            clearTimeout(updateTimeout);
            gsap.to(imageElementId, { autoAlpha: 0 });

        },

        updateState = async () => {
            log("updateState - preparing asset", assetOrder[assetIndex.current]);

            clearTimeout(updateTimeout);

            let asset = await srAPI.getUserAssets(config.userAddress, assetOrder[assetIndex.current], 1);
            if(asset == null || asset.length==0) {
                log("Error loading asset data, aborting. Will try again later.");
                updateTimeout = setTimeout(() => next(), config.duration.total * 1000);
                return;
            }

            asset = asset[0];

            const metadata = await srAPI.getJSONResponse(asset.metadataUri);
            asset.metadata = metadata;

            preloadImg.onload = () => {

                currentAsset = asset;

                gsap.set(imageElementId, { autoAlpha: 0, "background-image": `url(${preloadImg.src})` });
                gsap.to(imageElementId, { 
                    autoAlpha: 1, delay: 0.25, duration: 0.3, ease: 'quad.In',
                    onComplete:() => {

                        gsap.to(overlay, { top:0, height:'123px', duration:0.3, ease:'expo.Out'});
                        gsap.to(overlay, { top:'-212px', height:'0px', duration:0.3, delay:0.8, ease:'expo.Out'});

                        updateTimeout = setTimeout(() => next(), config.duration.total * 1000);

                        overlays.info.show(config.infoText, 0, 1.2, null);
                        overlays.title.show(metadata.name, config.duration.title, 1.2);
                        overlays.subtitle.show(`${metadata.createdBy}, ${metadata.yearCreated}`, config.duration.subtitle, 1.3, null);
                        overlays.desc.show(currentAsset.description, config.duration.description, 1.4, null);

                        settings.actions['!art'].handle();
                    }
                });
                // image was loaded, so empty the 'preload' image
                preloadImg.src = "";
            };

            // hide current image and, overlays
            // gsap.to(imageElementId, { autoAlpha: 0, duration: 0.2, ease: 'quad.Out' });
            gsap.to(overlay, { top:0, height:'1080px', duration:0.2, ease:'expo.In'});

            overlays.hide();

            // start loading the next image...
            preloadImg.src = asset.image;

            // 1st time? set asset now 
            if(currentAsset == null) currentAsset = asset;

            log("next asset data", asset);
        },

        resetAssetOrder = () => {

            if (!config.randomOrder) assetOrder.sort((a, b) => a - b); //ascending sort
            else assetOrder.sort((a, b) => Math.round((Math.random() * 0.5) * 2.0)); //random sort

            assetIndex = { current: 0, next: 0 };
            nextAssetIndex();
            assetIndex.current = assetIndex.next;
        };


    gallery.init = init;
    gallery.next = next;
    gallery.prev = prev;
    gallery.show = show;
    gallery.hide = hide;
    gallery.resetAssetOrder = resetAssetOrder;
    gallery.getCurrentAsset = () => currentAsset;

})(srGallery, srGallery.config, console.log);