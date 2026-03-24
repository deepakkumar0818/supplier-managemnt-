const store = require('../store');

module.exports = {
    async create(data) {
        return store.createUser(data);
    },
    async findOne(query) {
        if (query && query.email) return store.findUserByEmail(query.email);
        return null;
    },
    async findById(id) {
        const user = store.findUserById(id);
        if (!user) return null;
        const { password, ...safe } = user;
        return safe;
    },
    async find(query) {
        if (query?._id?.$in) return store.findUsersByIds(query._id.$in);
        return [];
    },
};
