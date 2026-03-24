/**
 * In-memory store — replaces MongoDB. Data resets on server restart.
 */
const bcrypt = require('bcryptjs');

let idSeq = 1;
const genId = () => `id-${idSeq++}`;

const users = [];
const vendorProfiles = [];
const products = [];
const rfqs = [];
const rfqResponses = [];
const ratings = [];

let rfqCount = 0;

// ── User ─────────────────────────────────────────────────────────────────────
async function createUser(data) {
    const hashed = await bcrypt.hash(data.password, 12);
    const user = {
        _id: genId(),
        name: String(data.name).trim(),
        email: String(data.email).toLowerCase().trim(),
        password: hashed,
        userRole: ['client', 'vendor', 'admin'].includes(data.userRole) ? data.userRole : 'client',
        avatar: data.avatar || '',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    users.push(user);
    return user;
}

function findUserByEmail(email) {
    const u = users.find(x => x.email === String(email).toLowerCase());
    return u ? { ...u, matchPassword: (plain) => bcrypt.compare(plain, u.password) } : null;
}

function findUserById(id) {
    return users.find(x => x._id === id) || null;
}

function findUsersByIds(ids) {
    const set = new Set(ids);
    return users.filter(u => set.has(u._id));
}

// ── VendorProfile ─────────────────────────────────────────────────────────────
function createVendorProfile(data) {
    const profile = {
        _id: genId(),
        userId: data.userId,
        companyName: data.companyName || '',
        description: data.description || '',
        location: data.location || '',
        phone: data.phone || '',
        categories: Array.isArray(data.categories) ? data.categories : [],
        avgRating: 0,
        totalReviews: 0,
        deliveryReliability: 0,
        responseTime: data.responseTime || '',
        orderSuccess: 0,
        satisfaction: 0,
        priceScore: 0,
        badge: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    vendorProfiles.push(profile);
    return profile;
}

function findVendorProfileByUserId(userId) {
    return vendorProfiles.find(p => p.userId === userId) || null;
}

function updateVendorProfile(userId, data) {
    const i = vendorProfiles.findIndex(p => p.userId === userId);
    if (i === -1) return null;
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    vendorProfiles[i] = { ...vendorProfiles[i], ...clean, updatedAt: new Date() };
    return vendorProfiles[i];
}

function upsertVendorProfile(userId, data) {
    let p = findVendorProfileByUserId(userId);
    if (!p) {
        p = createVendorProfile({ userId, ...data });
    } else {
        p = updateVendorProfile(userId, data);
    }
    return p;
}

function findVendorProfiles(filter = {}) {
    let list = [...vendorProfiles];
    if (filter.isActive === true) list = list.filter(p => p.isActive);
    if (filter.categories) {
        const re = filter.categories?.$elemMatch?.$regex || filter.categories;
        const regex = re instanceof RegExp ? re : new RegExp(String(re), 'i');
        list = list.filter(p => p.categories?.some(c => regex.test(String(c))));
    }
    if (filter.avgRating && filter.avgRating.$gte !== undefined)
        list = list.filter(p => p.avgRating >= filter.avgRating.$gte);
    return list;
}

// ── Product ───────────────────────────────────────────────────────────────────
function createProduct(data) {
    const product = {
        _id: genId(),
        vendorId: data.vendorId,
        productName: data.productName,
        category: data.category,
        price: Number(data.price) || 0,
        discount: Number(data.discount) || 0,
        deliveryCharges: Number(data.deliveryCharges) || 0,
        stock: Number(data.stock) || 0,
        leadTime: data.leadTime || '7 days',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        gstPercent: Number(data.gstPercent) || 18,
        unit: data.unit || 'Nos',
        warranty: data.warranty || '',
        isActive: data.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    products.push(product);
    return product;
}

function findProducts(filter) {
    let list = [...products];
    if (filter.vendorId) list = list.filter(p => p.vendorId === filter.vendorId);
    if (filter.isActive !== undefined) list = list.filter(p => p.isActive === filter.isActive);
    if (filter._id) list = list.filter(p => p._id === filter._id);
    if (filter.$or && Array.isArray(filter.$or)) {
        const toRegex = (v) => (v && typeof v === 'object' && v.$regex)
            ? new RegExp(v.$regex, v.$options || '')
            : (v instanceof RegExp ? v : null);
        const match = (p) => filter.$or.some(cond => {
            const r1 = toRegex(cond.productName);
            const r2 = toRegex(cond.category);
            if (r1 && r1.test(p.productName)) return true;
            if (r2 && r2.test(p.category)) return true;
            return false;
        });
        list = list.filter(p => match(p));
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findProductByIdAndVendor(id, vendorId) {
    return products.find(p => p._id === id && p.vendorId === vendorId) || null;
}

function updateProduct(id, vendorId, data) {
    const i = products.findIndex(p => p._id === id && p.vendorId === vendorId);
    if (i === -1) return null;
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    products[i] = { ...products[i], ...clean, updatedAt: new Date() };
    return products[i];
}

function findProductsByVendorIds(vendorIds) {
    const set = new Set(vendorIds);
    return products.filter(p => set.has(p.vendorId) && p.isActive);
}

function findProductsBySearch(q) {
    if (!q) return products.filter(p => p.isActive);
    const re = new RegExp(q, 'i');
    return products.filter(p => p.isActive && (re.test(p.productName) || re.test(p.category)));
}

// ── RFQ ───────────────────────────────────────────────────────────────────────
function createRFQ(data) {
    rfqCount++;
    const rfqNum = `RFQ-${(1000 + rfqCount).toString().padStart(4, '0')}`;
    const rfq = {
        _id: genId(),
        clientId: data.clientId,
        rfqNumber: rfqNum,
        productName: data.productName,
        category: data.category,
        quantity: data.quantity,
        deliveryLocation: data.deliveryLocation,
        deadline: data.deadline ? new Date(data.deadline) : null,
        description: data.description || '',
        status: data.status || 'open',
        notifiedVendors: data.notifiedVendors || [],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    rfqs.push(rfq);
    return rfq;
}

function findRFQs(filter) {
    let list = [...rfqs];
    if (filter.clientId) list = list.filter(r => r.clientId === filter.clientId);
    if (filter.status) list = list.filter(r => r.status === filter.status);
    if (filter.category) {
        const cats = Array.isArray(filter.category.$in)
            ? filter.category.$in.map(c => (c instanceof RegExp ? c : new RegExp(c, 'i')))
            : [new RegExp(filter.category, 'i')];
        list = list.filter(r => cats.some(re => re.test(r.category)));
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findRFQById(id) {
    return rfqs.find(r => r._id === id) || null;
}

function countRFQs(filter = {}) {
    return findRFQs(filter).length;
}

function updateRFQ(id, data) {
    const i = rfqs.findIndex(r => r._id === id);
    if (i === -1) return null;
    rfqs[i] = { ...rfqs[i], ...data, updatedAt: new Date() };
    return rfqs[i];
}

// ── RFQResponse ────────────────────────────────────────────────────────────────
function createRFQResponse(data) {
    const resp = {
        _id: genId(),
        rfqId: data.rfqId,
        vendorId: data.vendorId,
        price: Number(data.price) || 0,
        discount: Number(data.discount) || 0,
        deliveryTime: data.deliveryTime || '',
        deliveryCharges: Number(data.deliveryCharges) || 0,
        message: data.message || '',
        paymentTerms: data.paymentTerms || 'Net 30',
        warranty: data.warranty || '',
        validity: data.validity || '30 days',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    rfqResponses.push(resp);
    return resp;
}

function findRFQResponses(filter) {
    let list = [...rfqResponses];
    if (filter.rfqId) list = list.filter(r => r.rfqId === filter.rfqId);
    if (filter.vendorId) list = list.filter(r => r.vendorId === filter.vendorId);
    if (filter.rfqId && filter.rfqId.$in) {
        const set = new Set(filter.rfqId.$in);
        list = list.filter(r => set.has(r.rfqId));
    }
    return list.sort((a, b) => a.price - b.price);
}

function findRFQResponseByRfqAndVendor(rfqId, vendorId) {
    return rfqResponses.find(r => r.rfqId === rfqId && r.vendorId === vendorId) || null;
}

function countRFQResponses(filter) {
    return findRFQResponses(filter).length;
}

// ── Rating ────────────────────────────────────────────────────────────────────
function findRatings(filter) {
    let list = [...ratings];
    if (filter.vendorId) list = list.filter(r => r.vendorId === filter.vendorId);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findRatingByVendorAndClient(vendorId, clientId) {
    return ratings.find(r => r.vendorId === vendorId && r.clientId === clientId) || null;
}

function upsertRating(vendorId, clientId, data) {
    const i = ratings.findIndex(r => r.vendorId === vendorId && r.clientId === clientId);
    const payload = {
        rating: data.rating,
        quality: data.quality,
        delivery: data.delivery,
        price: data.price,
        communication: data.communication,
        review: data.review || '',
        rfqId: data.rfqId || null,
        updatedAt: new Date(),
    };
    if (i >= 0) {
        ratings[i] = { ...ratings[i], ...payload };
        return ratings[i];
    }
    const rating = {
        _id: genId(),
        vendorId,
        clientId,
        ...payload,
        createdAt: new Date(),
    };
    ratings.push(rating);
    return rating;
}

async function seedDemoData() {
    if (users.length > 0) return; // Already seeded
    const client = await createUser({ name: 'Demo Client', email: 'client@demo.com', password: 'demo123', userRole: 'client' });
    const vendor1 = await createUser({ name: 'Tech Suppliers Ltd', email: 'vendor@demo.com', password: 'demo123', userRole: 'vendor' });
    const vendor2 = await createUser({ name: 'Global Electronics Inc', email: 'vendor2@demo.com', password: 'demo123', userRole: 'vendor' });

    createVendorProfile({ userId: vendor1._id, companyName: 'Tech Suppliers Ltd', description: 'Leading supplier of electronics and IT equipment.', location: 'Mumbai', phone: '+91 98765 43210', categories: ['Electronics', 'Computers', 'Office Supplies'], avgRating: 4.5, totalReviews: 24, deliveryReliability: 92, responseTime: '2 hrs', orderSuccess: 95, satisfaction: 88, priceScore: 85 });
    createVendorProfile({ userId: vendor2._id, companyName: 'Global Electronics Inc', description: 'Wide range of industrial and consumer electronics.', location: 'Bangalore', phone: '+91 91234 56789', categories: ['Electronics', 'Industrial'], avgRating: 4.2, totalReviews: 18, deliveryReliability: 88, responseTime: '4 hrs', orderSuccess: 90, satisfaction: 82, priceScore: 78 });

    createProduct({ vendorId: vendor1._id, productName: 'Laptop - Business Pro', category: 'Electronics', price: 65000, discount: 5, stock: 50, leadTime: '5 days', description: 'High-performance business laptop.' });
    createProduct({ vendorId: vendor1._id, productName: 'Wireless Mouse', category: 'Office Supplies', price: 899, discount: 10, stock: 200, leadTime: '2 days' });
    createProduct({ vendorId: vendor1._id, productName: 'USB-C Hub 7-in-1', category: 'Computers', price: 2499, stock: 100, leadTime: '3 days' });
    createProduct({ vendorId: vendor2._id, productName: 'Industrial LED Panel', category: 'Industrial', price: 3500, discount: 8, stock: 150, leadTime: '7 days' });
    createProduct({ vendorId: vendor2._id, productName: 'Desktop PC - Workstation', category: 'Electronics', price: 95000, stock: 20, leadTime: '10 days' });

    const rfq1 = createRFQ({ clientId: client._id, productName: 'Office Laptops', category: 'Electronics', quantity: '25', deliveryLocation: 'New Delhi', description: 'Bulk order for corporate office.', status: 'open', notifiedVendors: [vendor1._id, vendor2._id] });
    const rfq2 = createRFQ({ clientId: client._id, productName: 'Wireless Peripherals', category: 'Office Supplies', quantity: '100', deliveryLocation: 'Mumbai', description: 'Keyboards and mice for new facility.', status: 'open', notifiedVendors: [vendor1._id] });

    createRFQResponse({ rfqId: rfq1._id, vendorId: vendor1._id, price: 62000, discount: 6, deliveryTime: '7', deliveryCharges: 5000, message: 'Best price for bulk order.', warranty: '2 years' });
    createRFQResponse({ rfqId: rfq1._id, vendorId: vendor2._id, price: 61500, discount: 5, deliveryTime: '10', deliveryCharges: 7500 });
    createRFQResponse({ rfqId: rfq2._id, vendorId: vendor1._id, price: 850, discount: 12, deliveryTime: '3' });

    upsertRating(vendor1._id, client._id, { rating: 5, quality: 5, delivery: 4, price: 5, communication: 5, review: 'Excellent service and quick delivery!' });
    upsertRating(vendor2._id, client._id, { rating: 4, quality: 4, delivery: 4, price: 5, communication: 4, review: 'Good product quality.' });

    console.log('📦 Demo data loaded. Login: client@demo.com / vendor@demo.com — password: demo123');
}

module.exports = {
    seedDemoData,
    createUser,
    findUserByEmail,
    findUserById,
    findUsersByIds,
    createVendorProfile,
    findVendorProfileByUserId,
    updateVendorProfile,
    upsertVendorProfile,
    findVendorProfiles,
    createProduct,
    findProducts,
    findProductByIdAndVendor,
    updateProduct,
    findProductsByVendorIds,
    findProductsBySearch,
    createRFQ,
    findRFQs,
    findRFQById,
    countRFQs,
    updateRFQ,
    createRFQResponse,
    findRFQResponses,
    findRFQResponseByRfqAndVendor,
    countRFQResponses,
    findRatings,
    findRatingByVendorAndClient,
    upsertRating,
};
