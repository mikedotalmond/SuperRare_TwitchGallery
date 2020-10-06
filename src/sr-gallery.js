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
        assetOrder = [], assetIndex = { current: 0, next: 1 },
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

        next = async () => {
            log("next");
            assetIndex.prev = assetIndex.current;
            assetIndex.current = assetIndex.next;
            assetIndex.next = (assetIndex.next + 1) % config.totalUserArtworks;
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
            assetData.next = await srAPI.getUserAssets(config.userAddress, assetOrder[assetIndex.next], 1);

            const currentImageUrl = assetData.current[0].image;

            gsap.set("#srgallery_image_a", { autoAlpha: 0 });

            preloadImg.onload = () => {
                gsap.set("#srgallery_image_a", { autoAlpha: 0, "background-image": `url(${preloadImg.src})` });
                gsap.to("#srgallery_image_a", { autoAlpha: 1 });
                preloadImg.src = "";

                updateTimeout = setTimeout(() => next(), config.duration * 1000);
            };

            preloadImg.src = currentImageUrl;

            log("assetData", assetData);
        },

        randomiseAssetOrder = () => {
            assetOrder = assetOrder.sort((a, b) => Math.round((Math.random() * 0.5) * 2.0));
            assetIndex = { current: 0, next: 1 };
            log("assetOrder", assetOrder);
        };


    gallery.init = init;
    gallery.next = next;
    gallery.prev = prev;
    gallery.show = show;
    gallery.hide = hide;
    gallery.randomiseAssetOrder = randomiseAssetOrder;
    gallery.assetData = assetData;

})(srGallery, srGallery.config, console.log);