const User          = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const Product       = require('../models/Product');
const RFQ           = require('../models/RFQ');
const RFQResponse   = require('../models/RFQResponse');
const Rating        = require('../models/Rating');

// ── Vendor Marketplace ────────────────────────────────────────────────────────
// GET /api/vendors?search=&category=&minRating=&sort=
const getVendors = async (req, res) => {
    try {
        const { search, category, minRating, sort = 'rating' } = req.query;

        const profileFilter = { isActive: true };
        if (category && category !== 'All Categories')
            profileFilter.categories = { $elemMatch: { $regex: new RegExp(category, 'i') } };
        if (minRating)
            profileFilter.avgRating = { $gte: parseFloat(minRating) };

        let profiles = await VendorProfile.find(profileFilter);
        if (!profiles || !profiles.length) return res.json({ vendors: [] });

        // Manually populate userId
        for (const p of profiles) {
            const user = await User.findById(p.userId);
            p.userId = user ? { _id: user._id, name: user.name, email: user.email, createdAt: user.createdAt } : { _id: p.userId, name: '', email: '' };
        }

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            const matchingProducts = await Product.find({
                $or: [
                    { productName: { $regex: q, $options: 'i' } },
                    { category: { $regex: q, $options: 'i' } },
                ],
                isActive: true,
            });
            const matchingVendorIds = [...new Set(matchingProducts.map(p => p.vendorId))];

            profiles = profiles.filter(p =>
                p.userId?.name?.toLowerCase().includes(q) ||
                p.companyName?.toLowerCase().includes(q) ||
                p.categories?.some(c => c.toLowerCase().includes(q)) ||
                matchingVendorIds.some(vid => String(vid) === String(p.userId?._id))
            );
        }

        const vendors = await Promise.all(profiles.map(async (p) => {
            const prods = await Product.find({ vendorId: p.userId._id, isActive: true });
            const productNames = prods.slice(0, 5).map(pr => pr.productName);
            return {
                _id:                 p.userId._id,
                name:                p.companyName || p.userId.name,
                email:               p.userId.email,
                category:            p.categories?.[0] || 'General',
                categories:          p.categories,
                products:            productNames,
                rating:              p.avgRating,
                reviews:             p.totalReviews,
                location:            p.location || 'India',
                responseTime:        p.responseTime || '—',
                deliveryReliability: p.deliveryReliability,
                orderSuccess:        p.orderSuccess,
                satisfaction:        p.satisfaction,
                priceScore:          p.priceScore,
                badge:               p.badge,
                description:         p.description,
                phone:               p.phone,
            };
        }));

        vendors.sort((a, b) => {
            if (sort === 'rating')   return b.rating - a.rating;
            if (sort === 'response') return (parseInt(a.responseTime) || 99) - (parseInt(b.responseTime) || 99);
            if (sort === 'delivery') return b.deliveryReliability - a.deliveryReliability;
            if (sort === 'price')    return b.priceScore - a.priceScore;
            return 0;
        });

        return res.json({ vendors });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// ── Get single vendor profile ─────────────────────────────────────────────────
// GET /api/vendors/:id
const getVendorById = async (req, res) => {
    try {
        const profile = await VendorProfile.findOne({ userId: req.params.id });
        if (!profile)
            return res.status(404).json({ message: 'Vendor not found.' });

        const user = await User.findById(profile.userId);
        profile.userId = user ? { _id: user._id, name: user.name, email: user.email, createdAt: user.createdAt } : { _id: profile.userId, name: '', email: '' };

        const products = await Product.find({ vendorId: req.params.id, isActive: true });
        const productDetails = products.map(p => ({ productName: p.productName, category: p.category, price: p.price, discount: p.discount, deliveryCharges: p.deliveryCharges, stock: p.stock, leadTime: p.leadTime }));

        const ratingsRaw = await Rating.find({ vendorId: req.params.id });
        const ratingsLimited = ratingsRaw.slice(0, 10);
        const ratings = await Promise.all(ratingsLimited.map(async (r) => {
            const client = await User.findById(r.clientId);
            return {
                author:        client?.name || 'Anonymous',
                rating:        r.rating,
                quality:       r.quality,
                delivery:      r.delivery,
                price:         r.price,
                communication: r.communication,
                review:        r.review,
                date:          new Date(r.createdAt).toISOString().split('T')[0],
            };
        }));

        return res.json({
            vendor: {
                _id:                 profile.userId._id,
                name:                profile.companyName || profile.userId.name,
                email:               profile.userId.email,
                categories:          profile.categories,
                products:            productDetails.map(p => p.productName),
                productDetails,
                rating:              profile.avgRating,
                reviews:             profile.totalReviews,
                location:            profile.location,
                phone:               profile.phone,
                responseTime:        profile.responseTime,
                deliveryReliability: profile.deliveryReliability,
                orderSuccess:        profile.orderSuccess,
                satisfaction:        profile.satisfaction,
                priceScore:          profile.priceScore,
                description:         profile.description,
                badge:               profile.badge,
                ratings,
            },
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// ── Client Dashboard ──────────────────────────────────────────────────────────
// GET /api/client/dashboard
const getDashboard = async (req, res) => {
    try {
        const clientId = req.user._id;

        const clientRFQs = await RFQ.find({ clientId });
        const rfqIds = clientRFQs.map(r => r._id);

        const [rfqsSent, quotesReceived, vendorsAvailable] = await Promise.all([
            clientRFQs.length,
            RFQResponse.countDocuments({ rfqId: { $in: rfqIds } }),
            VendorProfile.countDocuments({ isActive: true }),
        ]);

        const recentRFQs = clientRFQs.slice(0, 5);

        const recentActivity = await Promise.all(recentRFQs.map(async rfq => {
            const rc = await RFQResponse.countDocuments({ rfqId: rfq._id });
            return {
                action: rc > 0
                    ? `${rfq.rfqNumber}: ${rc} quote(s) received for ${rfq.productName}`
                    : `${rfq.rfqNumber} sent — awaiting vendor responses`,
                time:   timeAgo(rfq.createdAt),
                type:   rc > 0 ? 'quote' : 'rfq',
            };
        }));

        return res.json({
            rfqsSent,
            quotesReceived,
            vendorsAvailable,
            costSavings: '₹38.4 L',
            recentActivity,
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Yesterday';
    return `${d} days ago`;
}

module.exports = { getVendors, getVendorById, getDashboard };
