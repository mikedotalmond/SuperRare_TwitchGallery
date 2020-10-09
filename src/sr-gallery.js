const srGallery = {};

srGallery.config = {
    userAddress: "0x44821f92d83c5b6055044ebf3de64574c894854a",
    totalUserArtworks: 179, // no api for this, so fill manually for now
    randomOrder: true,
    infoText: "!art",
    duration: { total: 30, title: 30, subtitle: 29.8, description: 15 },
    ignoredAssets: [
        /** Ignoring various assets, by their API position
         * Usually because they don't work too well at 1920x1080 (with the current fullpage viewing method) */
        0, 3, 5, 7, 9, 11, 12, 13, 15, 16, 17, 23, 25, 27, 31, 32, 35, 36, 37, 39, 40, 41, 42, 44, 45,
        47, 48, 50, 51, 53, 54, 57, 58, 61, 62, 65, 66, 67, 68, 69,
        70, 71, 81, 88, 105, 112, 129, 130, 134, 140, 141,
        142, 143, 144, 146, 152, 160, 161, 163, 164, 165, 176, 177, 178
    ],
};

((gallery, config, log) => {

    let
        container = null, preloadImg = null, overlay,
        userData = null,
        pendingAsset = null,
        currentAsset = null,
        assetOrder = [],
        // ignoring assets that don't work well at 16:9, and similar/series, and videos,
        // will fix with other display modes at some point
        // also need to handle video assets

        assetIndex = { current: 0, next: 1 },
        updateTimeout = -1;

    const
        imageElementId = "#srgallery_image",

        init = async () => {
            container = document.getElementById("sr-gallery");
            preloadImg = document.getElementById("image-preload");
            overlay = document.getElementById("gallery-overlay");
            videoElement = document.getElementById("sr-gallery-video");
            hide();

            userData = await srAPI.getUserData(config.userAddress);
            log("userData", userData);

            gsap.set(overlay, { autoAlpha: 1, top: 0, height: '1080px' });

            for (let i = 0; i < config.totalUserArtworks; i++) assetOrder[i] = i;
            resetAssetOrder();

            next();

        },

        nextAssetIndex = () => {

            let
                next = (assetIndex.next + 1) % config.totalUserArtworks,
                sanity = assetOrder.length;

            // make sure the next index is not pointing to an ignored asset
            while (config.ignoredAssets.indexOf(assetOrder[next]) > -1 && sanity > 0) {
                next = (next + 1) % assetOrder.length;
                sanity--;
            }

            assetIndex.next = next;
        },

        next = async () => {
            assetIndex.prev = assetIndex.current;
            assetIndex.current = assetIndex.next;
            nextAssetIndex();
            await updateState();
        },

        prev = async () => {
            assetIndex.next = assetIndex.current;
            assetIndex.current = assetIndex.prev;
            if (--assetIndex.prev < 0) assetIndex.prev = config.totalUserArtworks - 1;
            await updateState();
        },

        /**
         * @param index Optional. An asset index to show/start with
         */
        show = async (index) => {
            resetAssetOrder();
            showIdleOverlay();

            if (typeof index !== 'number') index = parseInt(index, 10);
            if (Number.isInteger(index) && assetOrder.indexOf(index) !== -1) {
                assetIndex.current = assetOrder.indexOf(index);
            }
            await updateState();
        },

        hide = () => {
            clearTimeout(updateTimeout);
            gsap.to(imageElementId, { autoAlpha: 0 });
            overlays.hide();
            showIdleOverlay();
        },

        showIdleOverlay = () => {
            gsap.to(overlay, { top: 0, height: '1080px', duration: 0.2, ease: 'expo.In' });
            gsap.set(imageElementId, { autoAlpha: 0, delay: 0.2 });
            overlays.hide();
        },

        updateState = async () => {

            log("updateState - preparing asset", assetOrder[assetIndex.current]);

            clearTimeout(updateTimeout);

            let asset = await srAPI.getUserAssets(config.userAddress, assetOrder[assetIndex.current], 1);
            if (asset == null || asset.length == 0) {
                log("Error loading asset data, aborting. Will try again later.");
                updateTimeout = setTimeout(() => next(), config.duration.total * 1000);
                return;
            }

            // api returns an array of assets, but here it will always be a single item
            asset = asset[0];

            const metadata = await srAPI.getJSONResponse(asset.metadataUri);
            asset.metadata = metadata;

            pendingAsset = asset;

            // got api data about the next asset, so hide current image and overlays before loading it
            showIdleOverlay();

            // check asset type, resolution, etc.
            // is image? is mp4?
            videoElement.src = "";

            const m = asset.media;
            const haveMedia = m != null;

            if (haveMedia) {
                log("have media data", m.dimensions, m.mimeType, m.uri);
            }

            const isVideo = haveMedia && m.mimeType.indexOf("video") > -1;
            asset.isVideo = isVideo;

            log("isVideo", isVideo);

            if (isVideo) {
                if (m.mimeType.indexOf("video") > -1) {
                    videoElement.src = m.uri;
                }
            }

            // start loading the next image asset...
            preloadImg.onload = onImagePreload;
            preloadImg.src = asset.image;

            // 1st time? set asset now 
            if (currentAsset == null) currentAsset = pendingAsset;
        },

        /**
         * Handle image asset (pre)load complete
         */
        onImagePreload = () => {

            currentAsset = pendingAsset;
            pendingAsset = null;

            // set image and show after a little delay
            gsap.set(imageElementId, { autoAlpha: 0, "background-image": `url(${preloadImg.src})` });
            gsap.to(imageElementId, { autoAlpha: 1, delay: 0.3, duration: 0.3, ease: 'quad.In', onComplete: onAssetShown });

            // image was loaded, so empty the 'preload' image
            preloadImg.src = "";
        },


        // asset is ready and being shown - show text informations and set a timer for the next change
        onAssetShown = () => {

            if (currentAsset.isVideo) {
                gsap.set(imageElementId, { autoAlpha: 0, delay: 0.2, duration: 0.3 });

                if (inOBS) videoElement.muted = false; // need to be running in an obs browser source to unmute without user interaction
                videoElement.play();
                // playing video with audio won't usually work without user interaction, but works ok in the headless OBS browser
            }


            // animate the overlay out
            gsap.to(overlay, { top: 0, height: '123px', duration: 0.3, ease: 'expo.Out' });
            gsap.to(overlay, {
                top: '-212px', height: '0px', duration: 0.3, delay: 1.2, ease: 'expo.Out',
                onComplete: () => showAssetInfo(0.4)
            });

            // next
            updateTimeout = setTimeout(() => next(), config.duration.total * 1000);

            // send a chatbot message about the current artwork
            settings.actions['!art'].handle();
        },


        showAssetInfo = (delay) => {
            const asset = currentAsset;
            overlays.info.show(config.infoText, 0, delay, null);
            overlays.title.show(asset.metadata.name, config.duration.title, delay);
            overlays.subtitle.show(`${asset.metadata.createdBy}, ${asset.metadata.yearCreated}`, config.duration.subtitle, delay + 0.1, null);
            if(!asset.isVideo) overlays.desc.show(asset.description, config.duration.description, delay + 0.2, null);
        },


        resetAssetOrder = () => {

            if (!config.randomOrder) assetOrder.sort((a, b) => a - b); //ascending sort
            else assetOrder.sort(utils.randomSort); //random sort

            log("resetAssetOrder", config.randomOrder, assetOrder);

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