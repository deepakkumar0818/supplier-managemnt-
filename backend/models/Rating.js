const store = require('../store');

module.exports = {
    async find(filter) {
        return store.findRatings(filter);
    },
    async findOneAndUpdate(query, update, opts = {}) {
        const { vendorId, clientId } = query;
        if (!vendorId || !clientId) return null;
        return store.upsertRating(vendorId, clientId, update);
    },
};
