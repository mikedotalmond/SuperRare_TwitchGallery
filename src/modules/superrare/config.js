const config = {
    displaySize: { width: 1920, height: 1080 },
    userAddress: "0x44821f92d83c5b6055044ebf3de64574c894854a",
    totalUserArtworks: 180, // no api for this, so fill manually for now
    randomOrder: true,
    infoText: "!art",
    duration: { total: 40, title: 30, subtitle: 29.9, description: 15 },
    ignoredAssets: [
        /** Ignoring various assets, by their API position */
        9, 12, 13, 15, 16, 21, 25, 32, 35, 39, 40, 71, 105, 110, 112,
        134, 138,
        140, 141, 142, 143, 144, /*177,polar*/
        112, 146, 150, 160, 161, 163, 164,
    ],
};

export default config;