const store = require('../store');

module.exports = {
    async create(data) {
        return store.createRFQ(data);
    },
    async find(filter = {}) {
        return store.findRFQs(filter);
    },
    async findById(id) {
        return store.findRFQById(id);
    },
    async countDocuments(filter = {}) {
        return store.countRFQs(filter);
    },
    async findByIdAndUpdate(id, data) {
        return store.updateRFQ(id, data);
    },
};
