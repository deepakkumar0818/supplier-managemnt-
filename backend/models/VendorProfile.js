const store = require('../store');

module.exports = {
    async create(data) {
        return store.createVendorProfile(data);
    },
    async findOne(query) {
        if (query && query.userId) return store.findVendorProfileByUserId(query.userId);
        return null;
    },
    async findOneAndUpdate(query, update, opts = {}) {
        const profile = store.findVendorProfileByUserId(query.userId);
        if (!profile && opts.upsert) {
            return store.createVendorProfile({ userId: query.userId, ...update });
        }
        if (!profile) return null;
        return store.updateVendorProfile(query.userId, update);
    },
    async find(filter = {}) {
        return store.findVendorProfiles(filter);
    },
    async countDocuments(filter = {}) {
        return store.findVendorProfiles(filter).length;
    },
};
