const srAPI = {};

(() => {

    // populate/process literal templates
    const
        API_BASE = `https://superrare.co/sr-json/v0`,

        tpl_apiGetUserURI = utility.tpl`/users?user_address=${0}`,
        getUserURI = (userId) => API_BASE + tpl_apiGetUserURI(userId),

        tpl_getUserAssetsURI = utility.tpl`/nfts/assets?creator_addresses=${0}&offset=${1}&limit=${2}`,
        getUserAssetsURI = (userId, offset, limit) => API_BASE + tpl_getUserAssetsURI(userId, offset, limit),


        /**
         * Fetch user data for given SuperRare userId (eg their ETH address)
         * 
         * Example response
         * {
         *   avatar: "https://ipfs.pixura.io/ipfs/QmWZZq1rCMPfLbhCPtnUsnQfXhryMSGWFcWFFGE3KNPMrr"
         *   ethereumAddress: "0x44821f92d83c5b6055044ebf3de64574c894854a"​
         *   superRareUrl: "https://superrare.co/mikedotalmond"
         *   username: "mikedotalmond"
         * }
         */
        getUserData = async (userId) => {
            const response = await fetch(getUserURI(userId));
            const data = await response.json();
            if (data != null && data instanceof Array) return data[0];
            return data;
        },

        /**
         * Fetch asset data for a user
         */
        getUserAssets = async (userId, offset, limit) => {
            const response = await fetch(getUserAssetsURI(userId, offset, limit));
            const data = await response.json();
            return data;
        };

    srAPI.getUserData = getUserData;
    srAPI.getUserAssets = getUserAssets;

})();