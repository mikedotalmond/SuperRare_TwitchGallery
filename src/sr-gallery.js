const srGallery = {

    config: {
        displaySize: { width: 1920, height: 1080 },
        userAddress: "0x44821f92d83c5b6055044ebf3de64574c894854a",
        totalUserArtworks: 179, // no api for this, so fill manually for now
        randomOrder: true,
        infoText: "!art",
        duration: { total: 40, title: 30, subtitle: 29.8, description: 15 },
        ignoredAssets: [
            /** Ignoring various assets, by their API position
             * Usually because they don't work too well at 1920x1080 (with the current fullpage viewing method) */
            /*0, 3, 5, 7, 9, 11, 12, 13, 15, 16, 17, 23, 25, 27, 31, 32, 35, 36, 37, 39, 40, 41, 42, 44, 45,*/
            47, 48, 50, 51, 53, 54, 57, 58, 61, 62, 65, 66, 67, 68, 69,
            70, 71, 81, 88, 105, 112, 129, 130, 134, 140, 141,
            142, 143, 144, 146, 152, 160, 161, 163, 164, 165, 176, 177, 178
        ],
    }
};


((gallery, config, log) => {

    let
        container = null, preloadImg = null, imageElement,
        overlay, progressBar, loadSpinner,
        videoElement, videoContainer,
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

        init = async () => {
            imageElement = document.getElementById("srgallery_image");
            container = document.getElementById("sr-gallery");
            preloadImg = document.getElementById("image-preload");
            overlay = document.getElementById("gallery-overlay");
            loadSpinner = document.getElementById("loadSpinner");
            videoElement = document.getElementById("sr-gallery-video");
            videoContainer = document.getElementById("video-container");
            progressBar = document.getElementById("progressBox");

            hide();

            userData = await srAPI.getUserData(config.userAddress);
            // log("userData", userData);

            gsap.set(overlay, { autoAlpha: 1, top: 0, height: '100%' });

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

            clearTimeout(updateTimeout);
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
            clearTimeout(updateTimeout);
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
            overlays.hide();
            showIdleOverlay();
        },

        showIdleOverlay = () => {
            gsap.killTweensOf(loadSpinner);
            gsap.set(loadSpinner, { rotation: 0 });
            gsap.to(loadSpinner, { rotation: 360, duration: 1, repeat: -1, ease: 'none' });
            gsap.to(overlay, { top: 0, height: '100%', duration: 0.3, ease: 'expo.In' });
            gsap.to(progressBar, { width: "0.1%", autoAlpha: 0, duration: 0.3, });
            overlays.hide();
        },

        updateState = async () => {

            gsap.killTweensOf(overlay);
            gsap.killTweensOf(imageElement);
            gsap.killTweensOf(videoContainer);
            gsap.killTweensOf(progressBar);

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
            // 1st time? set asset now, otherwise it's set once preload is complete
            if (currentAsset == null) currentAsset = pendingAsset;

            // got api data about the next asset, so hide current image and overlays before loading it
            showIdleOverlay();

            // check asset type, resolution, etc.
            // is image? is mp4?
            videoElement.src = "";

            const m = asset.media;
            const haveMedia = m != null;

            if (haveMedia) {
                // only certain newer SR assets have the media node, so using this to get asset dimensions is not reliable
                // however, all video assets seem to have it (videos are newer to the platform), 
                // so it's a good way of accurately identifying videos
                log("have media data", m.dimensions, m.mimeType, m.uri);
            }

            asset.isVideo = haveMedia && m.mimeType.indexOf("video") > -1;
            // asset.isGif = haveMedia && m.mimeType.indexOf("gif") > -1;

            if (asset.isVideo) {
                // onloadeddata is called after video metadata is readable and the 1st frame is ready
                videoElement.onloadeddata = onVideoDataLoad;
                // load the video...
                videoElement.src = m.uri;
            } else {
                preloadImg.onload = onImagePreload;
                // start loading the next image asset...
                preloadImg.src = asset.image;
            }

            log(asset);
        },


        onVideoDataLoad = () => {

            currentAsset = pendingAsset;
            pendingAsset = null;

            // have metadata and the 1st frame, can show video

            if (videoElement.videoWidth == 0 || videoElement.videoHeight == 0) {
                log("Error accessing video dimensions", videoElement);
                currentAsset.dimensions = null;
            } else {

                currentAsset.dimensions = getAssetDimesions(
                    videoElement.videoWidth, videoElement.videoHeight,
                    config.displaySize.width, config.displaySize.height,
                    true
                );

                log("video dimensions", currentAsset.dimensions);
            }

            // gsap.set(imageElement, { autoAlpha: 0, scale: 1.0 });
            gsap.set(progressBar, { width: "0.1%", autoAlpha: 0 });
            onAssetShown();
        },


        /**
         * 
         */
        getAssetDimesions = (w, h, screenW, screenH, isVideo) => {

            const dimensions = {
                width: w,
                height: h,
                aspect: w / h,
                endScale: 1.0,
            };

            if (w > screenW || h > screenH || isVideo) {
                // native image size is bigger than screen in one or more dimensions
                // images are in the background-image of a 100% div with the size set to 'contain'
                // so it will be fitting, but not necessarily filling, the available space, while maintaining its aspect ratio
                const scale = isVideo
                    ? Math.max(Math.max(w / screenW, h / screenH), Math.max(screenW / w, screenH / h)) // allow upscale on videos
                    : Math.max(w / screenW, h / screenH);

                dimensions.endScale = scale;
            }

            log("dimensions:", dimensions);

            return dimensions;
        },

        /**
         * Handle image asset (pre)load complete
         */
        onImagePreload = () => {

            currentAsset = pendingAsset;
            pendingAsset = null;

            if (preloadImg.naturalWidth == 0 || preloadImg.naturalHeight == 0) {
                log("Error accessing image dimensions", preloadImg);
                currentAsset.dimensions = null;
            } else {
                currentAsset.dimensions = getAssetDimesions(
                    preloadImg.naturalWidth, preloadImg.naturalHeight,
                    config.displaySize.width, config.displaySize.height
                );
            }

            // set image and show after a little delay
            gsap.set(imageElement, { opacity: 1, visibility: 'visible', scale: 1.0, "background-image": `url(${preloadImg.src})` });
            gsap.to(imageElement, { delay: 1.25, duration: 0, ease: 'quad.In', onComplete: onAssetShown });

            gsap.set(progressBar, { width: "0.1%", autoAlpha: 0 });
            // image was loaded, so empty the 'preload' image
            preloadImg.src = "";
        },


        /**
         * asset is ready and being shown -
           show text informations and set a timer for the next change
         */
        onAssetShown = () => {

            gsap.killTweensOf(overlay);
            gsap.killTweensOf(imageElement);
            gsap.killTweensOf(videoContainer);
            gsap.killTweensOf(progressBar);

            var delay = 0.75;

            // animate the overlay up, out of th way
            gsap.to(overlay, {
                top: 0, height: '123px', delay: delay, duration: 0.3, ease: 'expo.Out', onComplete: () => {
                    if (currentAsset.isVideo) {
                        if (inOBS) videoElement.muted = false; // need to be running in an obs browser source (headless) to unmute without user interaction
                        videoElement.play();
                    }
                }
            });

            delay += 1.2;

            // continue to animate it up and off the top of the screen
            gsap.to(overlay, {
                top: '-212px', height: '0px', duration: 0.3, delay: delay, ease: 'expo.Out',
                onComplete: () => {
                    gsap.killTweensOf(loadSpinner);
                    showAssetInfo(0.4);
                },
            });

            gsap.set(progressBar, { width: "0.1%", autoAlpha: 0 });
            gsap.to(progressBar, { autoAlpha: 1, delay: delay, duration: 0.7 });

            if (currentAsset.dimensions.endScale != 1.0) {
                if (currentAsset.isVideo) {
                    gsap.set(videoContainer, { scale: 1.0 });
                    gsap.to(videoContainer, {
                        scale: currentAsset.dimensions.endScale, delay: delay,
                        duration: config.duration.total * 0.8 - delay,
                        ease: 'quad.inOut'
                    });
                } else {
                    gsap.to(imageElement, {
                        scale: currentAsset.dimensions.endScale, delay: delay,
                        duration: config.duration.total * 0.8 - delay,
                        ease: 'quad.inOut'
                    });
                }
            }

            // animate progress box to 100% over time and move onto the next() gallery item once completed
            gsap.to(progressBar, { width: "100%", duration: config.duration.total, ease: 'none', onComplete: () => next() });
        },


        /**
         * Show the title/subtitle/description/info overlay texts
         */
        showAssetInfo = (delay) => {
            const asset = currentAsset;
            overlays.info.show(config.infoText, 0, delay, null);
            overlays.title.show(asset.metadata.name, config.duration.title, delay);
            overlays.subtitle.show(`${asset.metadata.createdBy}, ${asset.metadata.yearCreated}`, config.duration.subtitle, delay + 0.1, null);
            if (!asset.isVideo) overlays.desc.show(asset.description, config.duration.description, delay + 0.2, null);

            // send a chatbot message about the current artwork
            settings.actions['!art'].handle();
        },


        /**
         * 
         */
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