const store = require('../store');

module.exports = {
    async create(data) {
        return store.createRFQResponse(data);
    },
    async find(filter) {
        return store.findRFQResponses(filter);
    },
    async findOne(query) {
        if (query.rfqId && query.vendorId)
            return store.findRFQResponseByRfqAndVendor(query.rfqId, query.vendorId);
        return null;
    },
    async countDocuments(filter) {
        return store.countRFQResponses(filter);
    },
};
