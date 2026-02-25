const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
    next();
});

// Set up MongoDB
if (!MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI not found. Please set it in .env file.');
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ Connected to MongoDB Atlas'))
        .catch(err => console.error('❌ MongoDB connection error:', err));
}

// ===== SCHEMAS =====

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

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
    total: Number
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
        const newCrop = new Crop({ userId, veg, name, plantedDate });
        await newCrop.save();
        res.status(201).json(newCrop);
    } catch (error) {
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

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Expense.findByIdAndDelete(id);
        res.json({ message: 'Expense deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/*
// ===== SERVE FRONTEND (For Deployment) =====
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
    // Only serve index.html if it's not an API route
    if (!req.url.startsWith('/api/')) {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    }
});
*/

app.listen(PORT, () => {
    console.log(`✅ AgriLog Server is running on port ${PORT}`);
});
