const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
console.log('📝 MONGODB_URI loaded:', MONGODB_URI ? `${MONGODB_URI.substring(0, 20)}...` : 'MISSING');

// Middleware
app.use(cors({
    origin: [
        'https://agrilog-chi.vercel.app', 
        'https://agrilogv2.vercel.app', 
        'http://localhost:5173',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
    next();
});

// Set up MongoDB
const connectWithRetry = () => {
    if (!MONGODB_URI) {
        console.warn('⚠️ MONGODB_URI not found. Please set it in .env file.');
        return;
    }

    console.log('🔄 Connecting to MongoDB...');
    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,  // 30s to find a server
        socketTimeoutMS: 45000,           // 45s for socket operations
        connectTimeoutMS: 30000,          // 30s to establish connection
    })
        .then(() => console.log('✅ Connected to MongoDB'))
        .catch(err => {
            console.error('❌ MongoDB connection error:', err.message);
            console.log('🔁 Retrying connection in 5 seconds...');
            setTimeout(connectWithRetry, 5000);
        });
};

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    setTimeout(connectWithRetry, 5000);
});

// Mongoose configuration
mongoose.set('bufferTimeoutMS', 30000); // Wait up to 30s for connection before timing out queries

connectWithRetry();

// ===== SCHEMAS =====

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const vegetableSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    unitName: { type: String, required: true },
    commissionPerUnit: { type: Number, default: 0 }
}, { timestamps: true });
const Vegetable = mongoose.model('Vegetable', vegetableSchema);

const cropSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    veg: { type: String, required: true },
    name: { type: String, required: true },
    plantedDate: Date,
    status: { type: String, default: 'active' }
}, { timestamps: true });
const Crop = mongoose.model('Crop', cropSchema);

const recordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true },
    veg: String,
    date: { type: Date, required: true },
    boxes: { type: Number, required: true },
    rate: Number,
    commission: Number,
    total: Number,
    type: { type: String, enum: ['market', 'income'], default: 'market' },
    unitName: String,
    isCommissionWholesale: { type: Boolean, default: false },
    lots: [{
        qty: Number,
        rate: Number,
        isWholesale: { type: Boolean, default: false }
    }]
}, { timestamps: true });
const Record = mongoose.model('Record', recordSchema);

const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true },
    date: { type: Date, required: true },
    category: { type: String, required: true },
    details: String,
    amount: { type: Number, required: true }
}, { timestamps: true });
const Expense = mongoose.model('Expense', expenseSchema);

const tractorOwnerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    ploughTypes: [{
        name: String,
        rate: Number,
        icon: String
    }]
}, { timestamps: true });
const TractorOwner = mongoose.model('TractorOwner', tractorOwnerSchema);

const tractorRecordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TractorOwner', required: true },
    farmLocation: String,
    ploughName: String,
    date: { type: Date, required: true },
    timeInHrs: Number,
    betta: Number,
    ratePerHour: Number,
    totalAmount: Number,
    paid: { type: Boolean, default: false },
    type: { type: String, enum: ['plough', 'payment'], default: 'plough' },
    details: String
}, { timestamps: true });
const TractorRecord = mongoose.model('TractorRecord', tractorRecordSchema);

const farmLocationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true }
}, { timestamps: true });
const FarmLocation = mongoose.model('FarmLocation', farmLocationSchema);

// ===== ROOT ROUTE =====
app.get('/', (req, res) => {
    res.json({ message: 'AgriLog Server is running!', status: 'Online' });
});

// ===== AUTH ROUTES =====

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const exists = await User.findOne({ username });
        if (exists) return res.status(400).json({ message: 'User already exists' });

        const newUser = new User({ username, password });
        await newUser.save();
        res.status(201).json({ username: newUser.username, _id: newUser._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (!user) return res.status(401).json({ message: 'Invalid username or password' });
        res.json({ username: user.username, _id: user._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===== VEGETABLE ROUTES =====

app.get('/api/vegetables', async (req, res) => {
    try {
        const { userId } = req.query;
        const vegetables = await Vegetable.find({ userId }).sort({ name: 1 });
        res.json(vegetables);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/vegetables', async (req, res) => {
    try {
        const newVeg = new Vegetable(req.body);
        await newVeg.save();
        res.status(201).json(newVeg);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/vegetables/:id', async (req, res) => {
    try {
        await Vegetable.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: 'Vegetable updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/vegetables/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const veg = await Vegetable.findById(id);
        if (!veg) return res.status(404).json({ message: 'Vegetable not found' });

        // 1. Find all crops associated with this vegetable for this user
        const crops = await Crop.find({ veg: veg.name, userId: veg.userId });
        const cropIds = crops.map(c => c._id);

        // 2. Delete all records and expenses for those crops
        if (cropIds.length > 0) {
            await Record.deleteMany({ cropId: { $in: cropIds } });
            await Expense.deleteMany({ cropId: { $in: cropIds } });
        }

        // 3. Delete the crops
        await Crop.deleteMany({ _id: { $in: cropIds } });

        // 4. Finally delete the vegetable itself
        await Vegetable.findByIdAndDelete(id);

        res.json({ message: 'Vegetable and all associated data deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===== CROP ROUTES =====

app.get('/api/crops', async (req, res) => {
    try {
        const { veg, userId } = req.query;
        let query = {};
        if (userId) query.userId = userId;
        if (veg) query.veg = veg;

        const crops = await Crop.find(query).sort({ createdAt: -1 });
        res.json(crops);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/crops', async (req, res) => {
    try {
        const { veg, name, plantedDate, userId } = req.body;
        console.log('📝 Creating crop for user:', userId, 'Veg:', veg, 'Name:', name);
        const newCrop = new Crop({ userId, veg, name, plantedDate });
        await newCrop.save();
        res.status(201).json(newCrop);
    } catch (error) {
        console.error('❌ Crop creation failed:', error);
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/crops/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Crop.findByIdAndUpdate(id, req.body);
        res.json({ message: 'Crop updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/crops/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Record.deleteMany({ cropId: id });
        await Expense.deleteMany({ cropId: id });
        await Crop.findByIdAndDelete(id);
        res.json({ message: 'Crop and its records deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===== RECORD ROUTES =====

app.get('/api/records', async (req, res) => {
    try {
        const { veg, cropId, userId } = req.query;
        let query = {};
        if (userId) query.userId = userId;
        if (veg) query.veg = veg;
        if (cropId) query.cropId = cropId;

        const records = await Record.find(query).sort({ date: 1 });
        res.json(records);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/records', async (req, res) => {
    try {
        const newRecord = new Record(req.body);
        await newRecord.save();
        res.status(201).json(newRecord);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Record.findByIdAndUpdate(id, req.body);
        res.json({ message: 'Record updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Record.findByIdAndDelete(id);
        res.json({ message: 'Record deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===== EXPENSE ROUTES =====

app.get('/api/expenses', async (req, res) => {
    try {
        const { cropId, userId } = req.query;
        let query = {};
        if (userId) query.userId = userId;
        if (cropId) query.cropId = cropId;

        const expenses = await Expense.find(query).sort({ date: 1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/expenses', async (req, res) => {
    try {
        const newExpense = new Expense(req.body);
        await newExpense.save();
        res.status(201).json(newExpense);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Expense.findByIdAndUpdate(id, req.body);
        res.json({ message: 'Expense updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Expense.findByIdAndDelete(id);
        res.json({ message: 'Expense deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ===== TRACTOR OWNER ROUTES =====
app.get('/api/tractor-owners', async (req, res) => {
    try {
        const owners = await TractorOwner.find({ userId: req.query.userId }).sort({ name: 1 });
        res.json(owners);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/tractor-owners', async (req, res) => {
    try {
        const owner = new TractorOwner(req.body);
        await owner.save();
        res.status(201).json(owner);
    } catch (error) { res.status(400).json({ message: error.message }); }
});

app.put('/api/tractor-owners/:id', async (req, res) => {
    try {
        await TractorOwner.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: 'Owner updated' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/tractor-owners/:id', async (req, res) => {
    try {
        await TractorRecord.deleteMany({ ownerId: req.params.id });
        await TractorOwner.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ===== TRACTOR RECORD ROUTES =====
app.get('/api/tractor-records/all', async (req, res) => {
    try {
        // Need to fetch all tractor records for a user
        const records = await TractorRecord.find({ userId: req.query.userId }).populate('ownerId', 'name').sort({ date: 1 });
        res.json(records);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/tractor-records', async (req, res) => {
    try {
        const records = await TractorRecord.find({
            userId: req.query.userId,
            ownerId: req.query.ownerId
        }).sort({ date: 1 });
        res.json(records);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/tractor-records', async (req, res) => {
    try {
        const { timeInHrs, ratePerHour, betta, type, amount } = req.body;
        let totalAmount = 0;
        if (type === 'payment') {
            totalAmount = Number(amount) || 0;
        } else {
            totalAmount = (Number(timeInHrs) * Number(ratePerHour || 0)) + Number(betta || 0);
        }
        const rec = new TractorRecord({ ...req.body, totalAmount });
        await rec.save();
        res.status(201).json(rec);
    } catch (error) { res.status(400).json({ message: error.message }); }
});

app.put('/api/tractor-records/:id', async (req, res) => {
    try {
        const { timeInHrs, ratePerHour, betta, type, amount } = req.body;
        let totalAmount = 0;
        if (type === 'payment') {
            totalAmount = Number(amount) || 0;
        } else {
            totalAmount = (Number(timeInHrs) * Number(ratePerHour || 0)) + Number(betta || 0);
        }
        await TractorRecord.findByIdAndUpdate(req.params.id, { ...req.body, totalAmount });
        res.json({ message: 'Record updated' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.patch('/api/tractor-records/:id/paid', async (req, res) => {
    try {
        const rec = await TractorRecord.findById(req.params.id);
        if (!rec) return res.status(404).json({ message: 'Not found' });
        rec.paid = req.body.paid;
        await rec.save();
        res.json({ message: 'Updated', paid: rec.paid });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/tractor-records/:id', async (req, res) => {
    try {
        await TractorRecord.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ===== FARM LOCATION ROUTES =====
app.get('/api/farm-locations', async (req, res) => {
    try {
        const locations = await FarmLocation.find({ userId: req.query.userId }).sort({ name: 1 });
        res.json(locations);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/farm-locations', async (req, res) => {
    try {
        const loc = new FarmLocation({ ...req.body, userId: req.body.userId });
        await loc.save();
        res.status(201).json(loc);
    } catch (error) { res.status(400).json({ message: error.message }); }
});

app.put('/api/farm-locations/:id', async (req, res) => {
    try {
        await FarmLocation.findByIdAndUpdate(req.params.id, { name: req.body.name });
        res.json({ message: 'Updated' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/farm-locations/:id', async (req, res) => {
    try {
        await FarmLocation.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

/*
// ===== SERVE FRONTEND (For Deployment) =====
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('(.*)', (req, res) => {
    // Only serve index.html if it's not an API route
    if (!req.url.startsWith('/api/')) {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    }
});
*/

app.listen(PORT, () => {
    console.log(`✅ AgriLog Server is running on port ${PORT}`);
});
