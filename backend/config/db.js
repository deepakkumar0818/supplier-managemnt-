/**
 * No-op — app runs with in-memory store (no MongoDB required).
 */
const connectDB = async () => {
    console.log('✅ Using in-memory store (no MongoDB). Data resets on restart.');
};

module.exports = connectDB;
