
import { gsap } from "gsap";

import log from '../log.js';
import actions from "../actions.js"
import overlays from "../overlays.js"
import utils from "../utils.js"

// SR gallery
import config from "./config.js";
import api from "./api.js"


let
    container = null, preloadImg = null, imageElement, imageElementNoGC,
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
        container = document.getElementById("sr-gallery");

        overlay = document.getElementById("gallery-overlay");
        loadSpinner = document.getElementById("loadSpinner");

        preloadImg = document.getElementById("image-preload");
        imageElement = document.getElementById("srgallery_image");
        imageElementNoGC = document.getElementById("srgallery_image_prevent-gc");

        videoElement = document.getElementById("sr-gallery-video");
        videoContainer = document.getElementById("video-container");

        progressBar = document.getElementById("progressBox");

        hide();

        userData = await api.getUserData(config.userAddress);
        log("userData", userData);

        gsap.set(overlay, { autoAlpha: 1, top: 0, height: '100%' });

        for (let i = 0; i < config.totalUserArtworks; i++) assetOrder[i] = i;
        resetAssetOrder();

        window.addEventListener("keydown", handleKey);

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

        gsap.set(loadSpinner, { autoAlpha: 0, rotation: 0, top: 'calc(50% - 58px)' });
        gsap.to(loadSpinner, { rotation: 360, duration: 1, repeat: -1, ease: 'none' });
        gsap.to(loadSpinner, { duration: duration, ease: 'expo.In', autoAlpha: 1 });

        gsap.to(overlay, { top: 0, height: '100%', duration: duration, ease: 'expo.In' });
        gsap.to(progressBar, { width: "0.1%", autoAlpha: 0, duration: duration, });
        gsap.to(imageElement, { autoAlpha: 0, duration: duration, });
        gsap.to(videoContainer, { autoAlpha: 0, duration: duration, });

        videoElement.muted = true;
        videoElement.pause();

        gsap.to("#gallery-overlay-title", { bottom: '142px', duration: duration, ease: 'expo.Out' });
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

        const asset = await api.getUserAssets(config.userAddress, assetOrder[assetIndex.current], 1);
        if (asset == null || asset.length == 0) {
            log("Error loading asset data, aborting. Will try again later.");
            updateTimeout = setTimeout(() => next(), config.duration.total * 1000);
            return;
        }
        // api returns an array of assets, but here it will always be a single item
        pendingAsset = asset[0];

        // load asset metadata
        pendingAsset.metadata = await api.getJSONResponse(pendingAsset.metadataUri);

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

            const maxScale = 4.0;
            dimensions.endScale = Math.min(scale, maxScale);
        }

        log("dimensions:", dimensions);

        return dimensions;
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
        gsap.to(imageElement, { autoAlpha: 0, scale: 1.0, delay: 0.3, duration: 0, onComplete: () => onAssetReady() });
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

        if (currentAsset.dimensions != null && currentAsset.dimensions.endScale > 2.0) {
            // Big image? Add it to the prevent-gc div and set size to endScale.
            // This is to (try to) ensure the whole thing is kept in memory
            // to try to prevent GC stuttering when scaling up from smaller scales to 1:1 
            gsap.set(imageElementNoGC, {
                "background-image": `url(${preloadImg.src})`,
                'background-position': '50% 0px',
                visibility: 'visible',
                scale: currentAsset.dimensions.endScale,
            });
        } else {
            gsap.set(imageElementNoGC, {
                "background-image": null, scale: 1.0,
                'background-position': '50% 50%', visibility: 'hidden'
            });
        }

        gsap.to(imageElement, { delay: 2, duration: 0, autoAlpha: 1, onComplete: onAssetReady });

        gsap.set(progressBar, { width: "0.1%", autoAlpha: 0 });
        // image was loaded, so empty the 'preload' image
        preloadImg.src = "";
    },


    /**
     * asset is ready and being shown -
       show text informations and set a timer for the next change
     */
    onAssetReady = () => {
        log("onAssetShown");

        gsap.killTweensOf(overlay);
        gsap.killTweensOf(imageElement);
        gsap.killTweensOf(videoContainer);
        gsap.killTweensOf(progressBar);

        if (currentAsset.isVideo) {
            gsap.set(imageElement, { autoAlpha: 0 });
            gsap.set(imageElementNoGC, { "background-image": null, scale: 1.0, visibility: 'hidden' });
        } else {
            videoElement.src = "";
            gsap.set(imageElement, { autoAlpha: 1 });
        }


        let delay = 1.5;

        // animate the overlay up, out of the way
        gsap.to(overlay, {
            top: 0, height: '96px', delay: delay, duration: 0.3, ease: 'expo.Out', onComplete: () => {
                if (currentAsset.isVideo) {
                    if (utils.inOBS()) videoElement.muted = false; // need to be running in an obs browser source (headless) to unmute without user interaction
                    videoElement.play();
                }
            }
        });
        gsap.to("#gallery-overlay-title", {
            bottom: '46px',/*103px*/
            delay: delay, duration: 0.333, ease: 'expo.In',
        });
        gsap.to(loadSpinner, {
            top: 'calc(50% - 8px)',
            delay: delay, duration: 0.333, ease: 'expo.In',
            autoAlpha: 0
        });

        delay += 2.25;

        // continue to animate it up and off the top of the screen
        gsap.to(overlay, {
            top: '-212px', height: '0px', duration: 0.3, delay: delay, ease: 'expo.Out',
            onComplete: () => {
                gsap.killTweensOf(loadSpinner);
                showAssetInfo(0.7);
            },
        });

        gsap.set(progressBar, { width: "0.1%", autoAlpha: 0 });
        gsap.to(progressBar, { autoAlpha: 1, delay: delay, duration: 0.7 });

        const endScale = currentAsset.dimensions.endScale;
        const animateVideoScale = true; // needed? config?
        //
        if (endScale != 1.0) {
            if (currentAsset.isVideo && animateVideoScale) {
                gsap.set(videoContainer, { scale: 1.0 });
                gsap.to(videoContainer, {
                    scale: endScale >= 2.0 ? endScale : 1.0, delay: delay,
                    duration: config.duration.total * 0.95 - delay,
                    ease: 'power3.inOut'
                });
            } else {
                const aspect = currentAsset.dimensions.aspect;
                const xPct = 50 + 25 * (Math.random() - 0.5) * aspect;
                const yPct = (Math.random() - .5) * .1 * currentAsset.dimensions.height * (1.0 / aspect);
                const bgPosition = (endScale > 2.0 ? xPct + '%' : '50%') + ' ' + (endScale > 2.0 ? yPct + 'px' : '0.0px');
                log(xPct, yPct);
                gsap.set(imageElement, {
                    'image-rendering': 'auto',
                    'background-position': '50% 0.0px',
                });
                // update the position of the gc workaround
                gsap.set(imageElementNoGC, {
                    'image-rendering': 'auto',
                    'background-position': bgPosition,
                });
                gsap.to(imageElement, {
                    scale: endScale, delay: delay,
                    duration: config.duration.total * 0.95 - delay,
                    'background-position': bgPosition,
                    ease: 'power3.inOut'
                });
            }
        } else {
            if (!currentAsset.isVideo) {
                // use nearest neighbour for images at or below the screen size
                gsap.set(imageElement, {
                    'image-rendering': 'pixelated',
                    'background-position': '50% 50%',
                    scale: 1
                });
                gsap.set(imageElementNoGC, {
                    'image-rendering': 'pixelated',
                    'background-position': '50% 50%',
                    scale: 1
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
        overlays.texts.info.show(config.infoText, 0, delay, null);
        overlays.texts.title.show(asset.metadata.name, config.duration.title, delay + 0.1);
        overlays.texts.subtitle.show(`${asset.metadata.createdBy}, ${asset.metadata.yearCreated}`, config.duration.subtitle, delay, null);
        if (!asset.isVideo) overlays.texts.description.show(asset.description, config.duration.description, delay + 2.2, null);

        // send a chatbot message about the current artwork
        actions['!art'].handle();
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
    },

    // useful for testing
    handleKey = (keyEvent) => {
        log(keyEvent.keyCode);
        switch (keyEvent.keyCode) {
            case 38: // up
                show(); break;
            case 40: // down
                hide(); break;
            case 39: // rightarrow 
                next(); break;
            case 37: // leftarrow
                prev(); break;
            case 32: // space
                if (gsap.globalTimeline.paused()) {
                    gsap.globalTimeline.resume();
                } else {
                    gsap.globalTimeline.pause();
                }
        }
    },

    getCurrentAsset = () => currentAsset;

export default {
    init,
    next,
    prev,
    show,
    hide,
    resetAssetOrder,
    getCurrentAsset
}
