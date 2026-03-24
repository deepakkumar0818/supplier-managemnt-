const store = require('../store');

module.exports = {
    async create(data) {
        return store.createProduct(data);
    },
    async find(filter) {
        return store.findProducts(filter);
    },
    async findOneAndUpdate(query, update, opts = {}) {
        const id = query._id;
        const vendorId = query.vendorId;
        if (!id || !vendorId) return null;
        return store.updateProduct(id, vendorId, { ...update, imageUrl: update.imageUrl ?? store.findProductByIdAndVendor(id, vendorId)?.imageUrl });
    },
    async countDocuments(filter = {}) {
        return store.findProducts(filter).length;
    },
};
