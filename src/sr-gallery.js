const srGallery = {

    config: {
        displaySize: { width: 1920, height: 1080 },
        userAddress: "0x44821f92d83c5b6055044ebf3de64574c894854a",
        totalUserArtworks: 179, // no api for this, so fill manually for now
        randomOrder: true,
        infoText: "!art",
        duration: { total: 40, title: 30, subtitle: 29.9, description: 15 },
        ignoredAssets: [
            /** Ignoring various assets, by their API position */
            9, 12, 13, 15, 16, 25, 32, 35, 39, 40, 105, 112,
            134, 140, 141,
            142, 143, 144, /*177,polar*/
            112, 150, 160, 161, 163, 164,
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
            log("userData", userData);

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

            if (typeof index !== 'number') index = parseInt(index, 10);
            if (Number.isInteger(index) && assetOrder.indexOf(index) !== -1) {
                assetIndex.current = assetOrder.indexOf(index);
            }

            await updateState();
        },

        hide = () => {
            killSceneTweens();
            showIdleOverlay(0.3);
        },

        showIdleOverlay = (duration) => {
            killSceneTweens();
            gsap.killTweensOf(loadSpinner);
            gsap.set(loadSpinner, { rotation: 0 });
            gsap.to(loadSpinner, { rotation: 360, duration: 1, repeat: -1, ease: 'none' });
            gsap.to(overlay, { top: 0, height: '100%', duration: duration, ease: 'expo.In' });
            gsap.to(progressBar, { width: "0.1%", autoAlpha: 0, duration: duration, });
            gsap.to(imageElement, { autoAlpha: 0, duration: duration, });
            overlays.hide();
        },

        killSceneTweens = () => {
            gsap.killTweensOf(overlay);
            gsap.killTweensOf(imageElement);
            gsap.killTweensOf(videoContainer);
            gsap.killTweensOf(progressBar);
            clearTimeout(updateTimeout);
        },


        updateState = async () => {

            const overlaySlideTime = 0.3;
            const t1 = Date.now();

            showIdleOverlay(overlaySlideTime);
            // takes overlaySlideTime seconds to show, so wait at least that long when setting src of new content below 

            log("updateState - preparing asset", assetOrder[assetIndex.current]);

            const asset = await srAPI.getUserAssets(config.userAddress, assetOrder[assetIndex.current], 1);
            if (asset == null || asset.length == 0) {
                log("Error loading asset data, aborting. Will try again later.");
                updateTimeout = setTimeout(() => next(), config.duration.total * 1000);
                return;
            }
            // api returns an array of assets, but here it will always be a single item
            pendingAsset = asset[0];

            // load asset metadata
            pendingAsset.metadata = await srAPI.getJSONResponse(pendingAsset.metadataUri);

            // subtract api load time from overlaySlideTime and only set the asset src below once the overlaySlideTime has completed
            const apiTime = (Date.now() - t1) * 0.001;
            const loadDelay = Math.max(0, (overlaySlideTime - apiTime));
            // log("apiTime", apiTime);
            // log("loadDelay:", loadDelay);

            const haveMedia = pendingAsset.media != null;
            pendingAsset.isVideo = haveMedia && pendingAsset.media.mimeType.indexOf("video") > -1;

            if (pendingAsset.isVideo) {
                // onloadeddata is called after video metadata is readable and the 1st frame is ready
                videoElement.onloadeddata = onVideoDataLoad;
                // load the video...
                if (loadDelay > 0) {
                    updateTimeout = setTimeout(() => {
                        gsap.set(videoContainer, { autoAlpha: 0 });
                        videoElement.src = pendingAsset.media.uri;
                    }, loadDelay * 1000);
                } else {
                    gsap.set(videoContainer, { autoAlpha: 0 });
                    videoElement.src = pendingAsset.media.uri;
                }

            } else {
                preloadImg.onload = onImagePreload;
                // start loading the next image asset...
                if (loadDelay > 0) {
                    updateTimeout = setTimeout(() => { preloadImg.src = pendingAsset.image; }, loadDelay * 1000);
                } else {
                    preloadImg.src = pendingAsset.image;
                }
            }

            // 1st time? set asset now, otherwise it's set once preload is complete
            if (currentAsset == null) currentAsset = pendingAsset;

            log(pendingAsset);
        },


        onVideoDataLoad = () => {

            log("onVideoDataLoad");

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

            gsap.set(progressBar, { width: "0.1%", autoAlpha: 0 });
            gsap.to(videoContainer, { autoAlpha: 1, delay: 0.3, scale: 1.0, duration: 0 });
            gsap.to(imageElement, { autoAlpha: 0, scale: 1.0, delay: 0.3, duration: 0, onComplete: () => onAssetShown() });
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

            log("onImagePreload");

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
            gsap.set(imageElement, {
                scale: 1.0, opacity: 1, visibility: 'visible',
                "background-image": `url(${preloadImg.src})`,
                'background-position-x': '50%',
            });
            gsap.to(imageElement, { delay: 2, duration: 0, autoAlpha: 1, ease: 'quad.In', onComplete: onAssetShown });

            gsap.set(progressBar, { width: "0.1%", autoAlpha: 0 });
            // image was loaded, so empty the 'preload' image
            preloadImg.src = "";
        },


        /**
         * asset is ready and being shown -
           show text informations and set a timer for the next change
         */
        onAssetShown = () => {
            log("onAssetShown");

            gsap.killTweensOf(overlay);
            gsap.killTweensOf(imageElement);
            gsap.killTweensOf(videoContainer);
            gsap.killTweensOf(progressBar);

            var delay = 0.75;

            if (currentAsset.isVideo) {
                gsap.set(imageElement, { autoAlpha: 0 });
            } else {
                videoElement.src = "";
                gsap.set(imageElement, { autoAlpha: 1 });
            }

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

            const endScale = currentAsset.dimensions.endScale;
            //
            if (endScale != 1.0) {
                if (currentAsset.isVideo) {
                    gsap.set(videoContainer, { scale: 1.0 });
                    gsap.to(videoContainer, {
                        scale: endScale, delay: delay,
                        duration: config.duration.total * 0.8 - delay,
                        ease: 'quad.inOut'
                    });
                } else {
                    const xPct = 50 + 25 * (Math.random() * .5);
                    gsap.to(imageElement, {
                        scale: endScale, delay: delay,
                        duration: config.duration.total * 0.8 - delay,
                        'background-position-x': endScale > 2.0 ? xPct + '%' : '50%',
                        ease: 'quad.inOut'
                    });
                }
            }

            // animate progress box to 100% over time and move onto the next() gallery item once completed

            let duration;
            if (currentAsset.isVideo && videoElement.duration > config.duration.total) {
                // play the entirety of videos that are longer then the configured duration, 
                duration = videoElement.duration;
            } else {
                duration = config.duration.total;
            }

            log("duration", duration);
            gsap.to(progressBar, { width: "100%", duration: duration, ease: 'none', onComplete: () => next() });
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