const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const path = require("path");
const flash = require("connect-flash");
const passport = require("passport");
const User = require("./models/user");
const Vehicle = require("./models/vehicle");
const Service=require("./models/service");
const Fuel=require("./models/fuel");
const Expense=require("./models/expense");
const Maintenance=require("./models/maintenance");
const Document = require("./models/document");
const generateAIResponse = require("./services/gemini");
const validateOdometerRecords = require("./utils/odometerValidator");

const multer = require("multer");
const { storage } = require("./config/cloudinary");


const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // Maximum 5 MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF, JPG, and PNG files are allowed."));
        }
    }
});



const session = require("express-session");


const app = express();


// ================================
// Middleware
// ================================

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: "autocare-secret",
    resave: false,
    saveUninitialized: false
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
});
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
});


// ================================
// Passport Configuration
// ================================

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

passport.use(User.createStrategy());


// ================================
// MongoDB Connection
// ================================

mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((err) => {
        console.log("MongoDB connection error:", err);
    });


// ================================
// View Engine
// ================================

app.set("view engine", "ejs");


// ================================
// Authentication Middleware
// ================================

function isLoggedIn(req, res, next) {

    if (req.isAuthenticated()) {
        return next();
    }

    res.redirect("/login");
}


// ================================
// Home Page
// ================================

app.get("/autocare", (req, res) => {
    res.render("home");
});


// DASHBOARD
app.get("/dashboard", isLoggedIn, async (req, res) => {
    try {
        const vehicles = await Vehicle.find({
            owner: req.user._id
        });

// Remember the selected vehicle in the session
if (req.query.vehicleId) {
    req.session.selectedVehicleId = req.query.vehicleId;
}

const selectedVehicleId =
    req.session.selectedVehicleId || "all";

        let selectedVehicle = null;

        if (selectedVehicleId !== "all") {
            selectedVehicle = vehicles.find(
                vehicle => vehicle._id.toString() === selectedVehicleId
            );

            if (!selectedVehicle) {
                return res.redirect("/dashboard");
            }
        }

        const vehicleIds = selectedVehicle
            ? [selectedVehicle._id]
            : vehicles.map(vehicle => vehicle._id);

// Calculate average mileage for the selected vehicle
let mileage = null;

if (selectedVehicle) {
    const fuels = await Fuel.find({
        vehicle: selectedVehicle._id
    }).sort({ odometer: 1 });

    let totalDistance = 0;
    let totalLitres = 0;
    let startingFullTank = null;
    let litresSinceFullTank = 0;

    for (const fuel of fuels) {
        const litres = Number(fuel.litres || 0);

        // Find the first full-tank entry
        if (startingFullTank === null) {
            if (fuel.fullTank === true) {
                startingFullTank = fuel;
                litresSinceFullTank = 0;
            }
            continue;
        }

        // Include fuel added after the starting full tank
        litresSinceFullTank += litres;

        // Complete the interval when another full tank is recorded
        if (fuel.fullTank === true) {
            const distance =
                Number(fuel.odometer) -
                Number(startingFullTank.odometer);

            if (distance > 0 && litresSinceFullTank > 0) {
                totalDistance += distance;
                totalLitres += litresSinceFullTank;
            }
            // Start the next interval
            startingFullTank = fuel;
            litresSinceFullTank = 0;
        }
    }
    if (totalDistance > 0 && totalLitres > 0) {
        mileage = totalDistance / totalLitres;
    }
}

        const [fuelResult, serviceResult, expenseResult] =
            await Promise.all([
                Fuel.aggregate([
                    { $match: { vehicle: { $in: vehicleIds } } },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ]),
                Service.aggregate([
                    { $match: { vehicle: { $in: vehicleIds } } },
                    { $group: { _id: null, total: { $sum: "$cost" } } }
                ]),
                Expense.aggregate([
                    { $match: { vehicle: { $in: vehicleIds } } },
                    { $group: { _id: null, total: { $sum: "$amount" } } }
                ])
            ]);

        const totalFuelExpense = fuelResult[0]?.total || 0;
        const totalServiceExpense = serviceResult[0]?.total || 0;
        const totalOtherExpense = expenseResult[0]?.total || 0;

        const [monthlyFuel, monthlyServices, monthlyExpenses, maintenanceRecords] =
            await Promise.all([
                Fuel.aggregate([
                    { $match: { vehicle: { $in: vehicleIds } } },
                    {
                        $group: {
                            _id: {
                                year: { $year: "$date" },
                                month: { $month: "$date" }
                            },
                            total: { $sum: "$amount" }
                        }
                    }
                ]),
                Service.aggregate([
                    { $match: { vehicle: { $in: vehicleIds } } },
                    {
                        $group: {
                            _id: {
                                year: { $year: "$date" },
                                month: { $month: "$date" }
                            },
                            total: { $sum: "$cost" }
                        }
                    }
                ]),
                Expense.aggregate([
                    { $match: { vehicle: { $in: vehicleIds } } },
                    {
                        $group: {
                            _id: {
                                year: { $year: "$date" },
                                month: { $month: "$date" }
                            },
                            total: { $sum: "$amount" }
                        }
                    }
                ]),
                Maintenance.find({
                    vehicle: { $in: vehicleIds }
                })
                .populate("vehicle", "brand model")
                .sort({ dueDate: 1 })
            ]);

        res.render("dashboard", {
            vehicles,
            selectedVehicleId,
            selectedVehicle,
            totalVehicles: vehicles.length,
            totalFuelExpense,
            totalServiceExpense,
            totalOtherExpense,
            mileage,
            monthlyFuel,
            monthlyServices,
            monthlyExpenses,
            maintenanceRecords
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Unable to load dashboard.");
    }
});


/* ================================
   AI ASSISTANT ROUTES
================================ */

// Display AI Assistant
app.get("/ai-assistant", isLoggedIn, async (req, res) => {
    try {
        const vehicles = await Vehicle.find({
            owner: req.user._id
        });

        res.render("aiAssistant", {
            vehicles,
            selectedVehicleId: "",
            question: "",
            aiResponse: null,
            error: null
        });
    } catch (error) {
        console.error("AI Assistant page error:", error);
        res.status(500).send("Unable to load AI Assistant.");
    }
});

// Ask AI about a selected vehicle
app.post("/ai-assistant", isLoggedIn, async (req, res) => {
    try {
        const vehicles = await Vehicle.find({
            owner: req.user._id
        });

        const { vehicleId } = req.body;
        const question = String(req.body.question || "").trim();

        let aiResponse = null;
        let error = null;

        const selectedVehicle = vehicles.find(
            vehicle => vehicle._id.toString() === vehicleId
        );

        if (!selectedVehicle) {
            error = "Please select one of your vehicles.";
        } else if (!question || question.length > 1000) {
            error = "Enter a question of up to 1000 characters.";
        } else {
            const [services, fuels, maintenanceRecords, expenses] =
                await Promise.all([
                    Service.find({
                        vehicle: selectedVehicle._id
                    }).sort({ date: -1 }).limit(10),

                    Fuel.find({
                        vehicle: selectedVehicle._id
                    }).sort({ date: -1 }).limit(10),

                    Maintenance.find({
                        vehicle: selectedVehicle._id
                    }).sort({ dueDate: 1 }).limit(10),

                    Expense.find({
                        vehicle: selectedVehicle._id
                    }).sort({ date: -1 }).limit(10)
                ]);
                const odometerIssues = validateOdometerRecords({
                vehicle: selectedVehicle,
                services,
                fuels
            });
            const vehicleData = {
                vehicle: {
                    brand: selectedVehicle.brand,
                    model: selectedVehicle.model,
                    year: selectedVehicle.year,
                    currentOdometer: selectedVehicle.currentOdometer
                },
                 odometerWarnings: odometerIssues,
                recentServices: services.map(service => ({
                    date: service.date,
                    odometer: service.odometer,
                    serviceType: service.serviceType,
                    cost: service.cost,
                    notes: service.notes
                })),
                recentFuelRecords: fuels.map(fuel => ({
                    date: fuel.date,
                    odometer: fuel.odometer,
                    litres: fuel.litres,
                    amount: fuel.amount,
                    fullTank: fuel.fullTank
                })),
                maintenanceReminders: maintenanceRecords.map(record => ({
                    title: record.title,
                    description: record.description,
                    dueDate: record.dueDate,
                    dueOdometer: record.dueOdometer,
                    status: record.status
                })),
                recentExpenses: expenses.map(expense => ({
                    date: expense.date,
                    category: expense.category,
                    amount: expense.amount,
                    description: expense.description
                }))
            };

         

const prompt = `
You are AutoCare AI, a simple vehicle maintenance assistant.

Use the supplied vehicle records to answer the user's question.

Rules:
1. Answer the question directly.
2. Use simple, everyday English.
3. Keep the answer short: maximum 100 words.
4. Give only the most useful recommendation.
5. Use bullet points only when necessary.
6. Do not repeat all vehicle records.
7. Do not add unnecessary headings or introductions.
8. If information is missing, say so in one short sentence.
9. Never invent vehicle data or maintenance requirements.
10. If an odometer warning matters to the question, explain it briefly.
11. Do not recommend changing records without verifying them first.

Never claim that no maintenance is due unless the records establish this.
If there are no pending reminders, say "No other maintenance reminders are recorded."

Vehicle records:
${JSON.stringify(vehicleData, null, 2)}

User question:
${question}
`;


            try {
                aiResponse = await generateAIResponse(prompt);
            } catch (aiError) {
                console.error("Gemini request failed:", aiError);
                error = "The AI service is temporarily unavailable. Please try again.";
            }
        }

        res.render("aiAssistant", {
            vehicles,
            selectedVehicleId: vehicleId || "",
            question,
            aiResponse,
            error
        });
    } catch (routeError) {
        console.error("AI Assistant request error:", routeError);
        res.status(500).send("Unable to process your AI request.");
    }
});



// ================================
// Registration
// ================================

app.get("/register", (req, res) => {
    res.render("registration");
});


app.post("/register", async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        // Check whether the username already exists
        const existingUsername = await User.findOne({
            username: username
        });

        if (existingUsername) {
            req.flash(
                "error",
                "This username is already registered. Please log in or choose another username."
            );
            return res.redirect("/register");
        }

        // Check whether the email already exists
        const existingEmail = await User.findOne({
            email: email
        });

        if (existingEmail) {
            req.flash(
                "error",
                "This email is already registered. Please log in or use another email."
            );
            return res.redirect("/register");
        }
        const newUser = new User({
            username: username,
            email: email
        });

        await User.register(newUser, password);
        req.flash("success", "Registration successful! Please log in.");
        res.redirect("/login");

    } catch (err) {
        next(err);
    }
});

// ================================
// Login
// ================================

// GET Login Route
app.get("/login", (req, res) => {
    res.render("login");
});

// POST Login Route
app.post(
    "/login",
    (req, res, next) => {
        passport.authenticate("local", {
            failureFlash: true,
            failureRedirect: "/login"
        })(req, res, next);
    },
    (req, res) => {
        req.flash("success", "Login successful! Welcome back.");
        res.redirect("/dashboard");
    }
);


// ================================
// Logout
// ================================

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }

        res.redirect("/autocare");
    });
});




// ================================
// Adding New Vehicle
// ================================

app.get("/newVehicle", isLoggedIn, (req, res) => {
    res.render("newVehicle");
});

app.post("/vehicles", isLoggedIn, async (req, res) => {
    const vehicleData = req.body;
    const newVehicle = new Vehicle(vehicleData);
    newVehicle.owner = req.user._id;
    await newVehicle.save();

    res.redirect("/vehicles");
});


// Viewing vehicles

app.get("/vehicles", isLoggedIn, async (req, res) => {
    const vehicles = await Vehicle.find({
        owner: req.user._id
    });
    res.render("vehicles", { vehicles: vehicles });

});

// Viewing one vehicle

app.get("/vehicles/:id", isLoggedIn, async (req, res) => {
    const vehicle = await Vehicle.findOne({
        _id: req.params.id,
        owner: req.user._id
    });
    res.render("vehicleDetails", { vehicle: vehicle });
});

// Editing vehicle - show edit form
app.get("/vehicles/:id/edit", isLoggedIn, async (req, res) => {
    const vehicle = await Vehicle.findOne({
        _id: req.params.id,
        owner: req.user._id
    });
    res.render("editVehicle", { vehicle: vehicle });
});

// Updating vehicle
app.post("/vehicles/:id/edit", isLoggedIn, async (req, res) => {
    const updatedVehicle = await Vehicle.findOneAndUpdate(
        {
            _id: req.params.id,
            owner: req.user._id
        },
        req.body,
        { new: true }
    );
    res.redirect(`/vehicles/${updatedVehicle._id}`);
});


// Deleting vehicle
app.post("/vehicles/:id/delete", isLoggedIn, async (req, res) => {
    await Vehicle.findOneAndDelete({
        _id: req.params.id,
        owner: req.user._id
    });
    res.redirect("/vehicles");
});


// ================================
// SERVICE ROUTES - SECURED
// ================================

// Display Service Form
app.get("/services", isLoggedIn, async (req, res) => {
    const vehicles = await Vehicle.find({
        owner: req.user._id
    });

    res.render("newService", { vehicles });
});


// Adding Service
app.post("/services", isLoggedIn, async (req, res) => {
    const {
        vehicleId,
        date,
        odometer,
        serviceType,
        garage,
        cost,
        parts,
        notes,
        invoice
    } = req.body;

    // Verify that the vehicle belongs to the logged-in user
    const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }

    // Create service only for the verified vehicle
    const newService = new Service({
        vehicle: vehicle._id,
        date,
        odometer,
        serviceType,
        garage,
        cost,
        parts,
        notes,
        invoice
    });

    await newService.save();

    res.redirect(`/services/history/${vehicle._id}`);
});


// Display Service History
app.get("/services/history/:vehicleId", isLoggedIn, async (req, res) => {
    const vehicle = await Vehicle.findOne({
        _id: req.params.vehicleId,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }

    const services = await Service.find({
        vehicle: vehicle._id
    }).sort({ date: -1 });

    res.render("services", {
        vehicle,
        services
    });
});


// Display Edit Service Form
app.get("/services/:id/edit", isLoggedIn, async (req, res) => {
    const service = await Service.findById(req.params.id);

    if (!service) {
        return res.status(404).send("Service not found.");
    }

    // Verify ownership of the vehicle linked to this service
    const vehicle = await Vehicle.findOne({
        _id: service.vehicle,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Service not found.");
    }

    res.render("editService", { service });
});


// Update Service
app.post("/services/:id/edit", isLoggedIn, async (req, res) => {
    const service = await Service.findById(req.params.id);

    if (!service) {
        return res.status(404).send("Service not found.");
    }

    // Verify ownership before updating
    const vehicle = await Vehicle.findOne({
        _id: service.vehicle,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Service not found.");
    }

    // Update only the permitted fields
    const {
        date,
        odometer,
        serviceType,
        garage,
        cost,
        parts,
        notes,
        invoice
    } = req.body;

    service.date = date;
    service.odometer = odometer;
    service.serviceType = serviceType;
    service.garage = garage;
    service.cost = cost;
    service.parts = parts;
    service.notes = notes;
    service.invoice = invoice;

    await service.save();

    res.redirect(`/services/history/${vehicle._id}`);
});


// Delete Service
app.post("/services/:id/delete", isLoggedIn, async (req, res) => {
    const service = await Service.findById(req.params.id);

    if (!service) {
        return res.status(404).send("Service not found.");
    }

    // Verify ownership before deleting
    const vehicle = await Vehicle.findOne({
        _id: service.vehicle,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Service not found.");
    }

    await Service.findByIdAndDelete(service._id);

    res.redirect(`/services/history/${vehicle._id}`);
});


// Display Fuel Form
app.get("/fuel", isLoggedIn, async (req, res) => {
    const vehicles = await Vehicle.find({
        owner: req.user._id
    });
    res.render("newFuel", { vehicles });
});


 // Add Fuel Record
app.post("/fuel", isLoggedIn, async (req, res, next) => {
    try {
        const {
            vehicleId,
            date,
            odometer,
            litres,
            amount,
            station,
            fullTank
        } = req.body;

        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            owner: req.user._id
        });

        if (!vehicle) {
            return res.status(404).send("Vehicle not found.");
        }

        const newOdometer = Number(odometer);

        // Validate odometer value
        if (!Number.isFinite(newOdometer) || newOdometer < 0) {
            req.flash("error", "Please enter a valid odometer reading.");
            return res.redirect("/fuel");
        }

        // Check against the vehicle's current odometer
        if (newOdometer < Number(vehicle.currentOdometer || 0)) {
            req.flash(
                "error",
                `Odometer reading cannot be lower than the vehicle's current odometer (${vehicle.currentOdometer} km).`
            );
            return res.redirect("/fuel");
        }

        // Check against the latest fuel entry
        const latestFuel = await Fuel.findOne({
            vehicle: vehicle._id
        }).sort({ odometer: -1, date: -1 });

        if (latestFuel && newOdometer < Number(latestFuel.odometer)) {
            req.flash(
                "error",
                `Odometer reading cannot be lower than the previous fuel reading (${latestFuel.odometer} km).`
            );
            return res.redirect(`/fuel/history/${vehicle._id}`);
        }

        // Check against the latest service entry
        const latestService = await Service.findOne({
            vehicle: vehicle._id
        }).sort({ odometer: -1, date: -1 });

        if (latestService && newOdometer < Number(latestService.odometer)) {
            req.flash(
                "error",
                `Odometer reading cannot be lower than the latest service reading (${latestService.odometer} km).`
            );
            return res.redirect("/fuel");
        }

        const newFuel = new Fuel({
            date,
            odometer: newOdometer,
            litres,
            amount,
            station,
            fullTank: fullTank === "true",
            vehicle: vehicle._id
        });

        await newFuel.save();

        // Update vehicle odometer if the new reading is higher
        if (newOdometer > Number(vehicle.currentOdometer || 0)) {
            vehicle.currentOdometer = newOdometer;
            await vehicle.save();
        }

        req.flash("success", "Fuel record added successfully!");
        res.redirect(`/fuel/history/${vehicle._id}`);
    } catch (err) {
        next(err);
    }
});



// Display Fuel History
app.get("/fuel/history/:vehicleId", isLoggedIn, async (req, res) => {

    const vehicle = await Vehicle.findOne({
        _id: req.params.vehicleId,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }
    const fuels = await Fuel.find({
        vehicle: vehicle._id
    }).sort({ odometer: 1 });

    // Total fuel spending
    const totalFuelExpense = fuels.reduce((total, fuel) => {
        return total + Number(fuel.amount || 0);
    }, 0);

    // Fuel cost per km (existing calculation)
    let fuelCostPerKm = null;

    if (fuels.length >= 2) {
        const distance =
            Number(fuels[fuels.length - 1].odometer) -
            Number(fuels[0].odometer);

        if (distance > 0) {
            fuelCostPerKm = totalFuelExpense / distance;
        }
    }

    // Calculate mileage using full-tank-to-full-tank intervals
    let totalDistance = 0;
    let totalLitres = 0;
    let startingFullTank = null;
    let litresSinceFullTank = 0;

    for (const fuel of fuels) {
        const litres = Number(fuel.litres || 0);

        if (startingFullTank === null) {
            if (fuel.fullTank === true) {
                startingFullTank = fuel;
                litresSinceFullTank = 0;
            }
            continue;
        }
        // Count fuel added after the starting full tank
        litresSinceFullTank += litres;

        // A new full tank completes the interval
        if (fuel.fullTank === true) {
            const distance =
                Number(fuel.odometer) -
                Number(startingFullTank.odometer);

            if (distance > 0 && litresSinceFullTank > 0) {
                totalDistance += distance;
                totalLitres += litresSinceFullTank;
            }

            // This full tank becomes the next starting point
            startingFullTank = fuel;
            litresSinceFullTank = 0;
        }
    }

    let mileage = null;
    if (totalDistance > 0 && totalLitres > 0) {
        mileage = totalDistance / totalLitres;
    }
    const totalFuelCost = fuels.reduce(
        (total, fuel) => total + Number(fuel.amount || 0),
        0
    );
    res.render("fuelHistory", {
        vehicle,
        fuels,
        totalFuelCost,
        fuelCostPerKm,
        mileage
    });
});


// ================================
// EXPENSE ROUTES - SECURED
// ================================

// Display Expense Form
app.get("/expenses", isLoggedIn, async (req, res) => {
    const vehicles = await Vehicle.find({
        owner: req.user._id
    });

    res.render("newExpense", { vehicles });
});

// Add Expense
app.post("/expenses", isLoggedIn, async (req, res) => {
    const {
        vehicleId,
        date,
        category,
        amount,
        description
    } = req.body;

    // Verify that the vehicle belongs to the logged-in user
    const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }
    // Create expense for the verified vehicle only
    const newExpense = new Expense({
        vehicle: vehicle._id,
        date,
        category,
        amount,
        description
    });
    await newExpense.save();
    res.redirect(`/expenses/history/${vehicle._id}`);
});

// Display Expense History
app.get("/expenses/history/:vehicleId", isLoggedIn, async (req, res) => {
    const vehicle = await Vehicle.findOne({
        _id: req.params.vehicleId,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }

    const expenses = await Expense.find({
        vehicle: vehicle._id
    }).sort({ date: -1 });
    const totalExpense = expenses.reduce((total, expense) => {
        return total + Number(expense.amount || 0);
    }, 0);
    res.render("expenseHistory", {
        vehicle,
        expenses,
        totalExpense
    });
});

// Update Expense
app.post("/expenses/:id/edit", isLoggedIn, async (req, res) => {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
        return res.status(404).send("Expense not found.");
    }

    // Verify ownership before updating
    const vehicle = await Vehicle.findOne({
        _id: expense.vehicle,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Expense not found.");
    }
    // Update only permitted expense fields
    const {
        date,
        category,
        amount,
        description
    } = req.body;

    expense.date = date;
    expense.category = category;
    expense.amount = amount;
    expense.description = description;

    await expense.save();

    res.redirect(`/expenses/history/${vehicle._id}`);
});

// Delete Expense
app.post("/expenses/:id/delete", isLoggedIn, async (req, res) => {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
        return res.status(404).send("Expense not found.");
    }
    // Verify ownership before deleting
    const vehicle = await Vehicle.findOne({
        _id: expense.vehicle,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Expense not found.");
    }
    await Expense.findByIdAndDelete(expense._id);
    res.redirect(`/expenses/history/${vehicle._id}`);
});


//MAINTENENCE
app.get("/maintenance",isLoggedIn,async (req,res)=>{
    const vehicles=await Vehicle.find({
        owner:req.user._id
    });
    res.render("newMaintenance",{vehicles});
});


app.post("/maintenance", isLoggedIn, async (req, res) => {
    const {
        vehicleId,
        title,
        description,
        maintenanceType,
        dueDate,
        dueOdometer
    } = req.body;

    // Verify that the selected vehicle belongs to this user
    const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }

    const newMaintenance = new Maintenance({
        vehicle: vehicle._id,
        title,
        description,
        maintenanceType,
        dueDate: dueDate || undefined,
        dueOdometer: dueOdometer || undefined
    });
    await newMaintenance.save();

    req.flash("success", "Maintenance reminder added successfully!");
    res.redirect(`/maintenance/history/${vehicle._id}`);
    });



app.get("/maintenance/history/:vehicleId", isLoggedIn, async (req, res) => {
    const vehicle = await Vehicle.findOne({
        _id: req.params.vehicleId,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }

    const maintenances = await Maintenance.find({
        vehicle: vehicle._id
    }).sort({ dueDate: 1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const maintenance of maintenances) {
        if (maintenance.status === "Completed") {
            continue;
        }

        let isOverdue = false;
        let isDueSoon = false;

        if (maintenance.dueDate) {
            const dueDate = new Date(maintenance.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const daysLeft = Math.ceil(
                (dueDate - today) / (1000 * 60 * 60 * 24)
            );

            if (daysLeft < 0) {
                isOverdue = true;
            } else if (daysLeft <= 7) {
                isDueSoon = true;
            }
        }

        if (maintenance.dueOdometer != null) {
            const kmLeft =
                maintenance.dueOdometer - vehicle.currentOdometer;

            if (kmLeft <= 0) {
                isOverdue = true;
            } else if (kmLeft <= 500) {
                isDueSoon = true;
            }
        }

        if (isOverdue) {
            maintenance.status = "Overdue";
        } else if (isDueSoon) {
            maintenance.status = "Due Soon";
        } else {
            maintenance.status = "Upcoming";
        }

        await maintenance.save();
    }

    res.render("maintenanceHistory", {
        vehicle,
        maintenances
    });
});


app.get("/maintenance/:id/edit", isLoggedIn, async (req, res) => {
    const maintenance = await Maintenance.findById(req.params.id);

    if (!maintenance) {
        return res.status(404).send("Maintenance reminder not found.");
    }

    const vehicle = await Vehicle.findOne({
        _id: maintenance.vehicle,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }

    res.render("editMaintenance", { maintenance });
});


app.post("/maintenance/:id/edit", isLoggedIn, async (req, res) => {
    const maintenance = await Maintenance.findById(req.params.id);
    if (!maintenance) {
        return res.status(404).send("Maintenance reminder not found.");
    }
    const vehicle = await Vehicle.findOne({
        _id: maintenance.vehicle,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }
    await Maintenance.findByIdAndUpdate(
        req.params.id,
        {
            title: req.body.title,
            description: req.body.description,
            maintenanceType: req.body.maintenanceType,
            dueDate: req.body.dueDate || null,
            dueOdometer: req.body.dueOdometer || null,
            status: "Upcoming"
        },
        { runValidators: true }
    );
    res.redirect(`/maintenance/history/${vehicle._id}`);
});


app.post("/maintenance/:id/delete", isLoggedIn, async (req, res) => {
    const maintenance = await Maintenance.findById(req.params.id);
    if (!maintenance) {
        return res.status(404).send("Maintenance reminder not found.");
    }
    const vehicle = await Vehicle.findOne({
        _id: maintenance.vehicle,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }
    await Maintenance.findByIdAndDelete(req.params.id);
    res.redirect(`/maintenance/history/${vehicle._id}`);
});



app.get("/documents", isLoggedIn, async (req, res) => {
    const vehicles = await Vehicle.find({
        owner: req.user._id
    });

    res.render("newDocument", { vehicles });
});


app.post(
    "/documents",
    isLoggedIn,
    upload.single("documentFile"),
    async (req, res) => {
        const {
            vehicleId,
            title,
            documentType,
            issueDate,
            expiryDate,
            notes
        } = req.body;
        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            owner: req.user._id
        });
        if (!vehicle) {
            return res.status(404).send("Vehicle not found.");
        }
        const newDocument = new Document({
            vehicle: vehicle._id,
            title,
            documentType,
            issueDate: issueDate || undefined,
            expiryDate: expiryDate || undefined,
            notes,
            fileUrl: req.file ? req.file.path : undefined
        });

        await newDocument.save();
        res.redirect(`/documents/history/${vehicle._id}`);
    }
);



app.get("/documents/history/:vehicleId", isLoggedIn, async (req, res) => {
    const vehicle = await Vehicle.findOne({
        _id: req.params.vehicleId,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Vehicle not found.");
    }
    const documents = await Document.find({
        vehicle: vehicle._id
    }).sort({ expiryDate: 1 });
    res.render("documentHistory", {
        vehicle,
        documents
    });
});



 // GET: Display the edit document form
app.get("/documents/:documentId/edit", isLoggedIn, async (req, res) => {
    const document = await Document.findById(req.params.documentId);

    if (!document) {
        return res.status(404).send("Document not found.");
    }

    const vehicle = await Vehicle.findOne({
        _id: document.vehicle,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Document not found.");
    }

    res.render("editDocument", {
        document,
        vehicle
    });
});


// POST: Update document details
app.post("/documents/:documentId/edit", isLoggedIn, async (req, res) => {
    const document = await Document.findById(req.params.documentId);

    if (!document) {
        return res.status(404).send("Document not found.");
    }

    const vehicle = await Vehicle.findOne({
        _id: document.vehicle,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Document not found.");
    }
    const {
        title,
        documentType,
        issueDate,
        expiryDate,
        notes
    } = req.body;

    document.title = title;
    document.documentType = documentType;
    document.issueDate = issueDate || undefined;
    document.expiryDate = expiryDate || undefined;
    document.notes = notes;

    await document.save();
    res.redirect(`/documents/history/${vehicle._id}`);
});


app.post("/documents/:documentId/delete", isLoggedIn, async (req, res) => {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
        return res.status(404).send("Document not found.");
    }
    const vehicle = await Vehicle.findOne({
        _id: document.vehicle,
        owner: req.user._id
    });
    if (!vehicle) {
        return res.status(404).send("Document not found.");
    }
    // Delete the uploaded file from Cloudinary
    if (document.fileUrl) {
        const { cloudinary } = require("./config/cloudinary");
        const urlParts = document.fileUrl.split("/");
        const uploadIndex = urlParts.indexOf("upload");

        if (uploadIndex !== -1) {
            let publicId = urlParts.slice(uploadIndex + 2).join("/");

            // Remove the version number, if present
            publicId = publicId.replace(/^v\d+\//, "");

            // Remove the file extension
            publicId = publicId.replace(/\.[^/.]+$/, "");

            await cloudinary.uploader.destroy(publicId, {
                resource_type: "image"
            });
        }
    }

    await Document.findByIdAndDelete(document._id);

    res.redirect(`/documents/history/${vehicle._id}`);
});



app.post("/maintenance/:maintenanceId/complete", isLoggedIn, async (req, res) => {
    const maintenance = await Maintenance.findById(
        req.params.maintenanceId
    );

    if (!maintenance) {
        return res.status(404).send("Maintenance reminder not found.");
    }

    const vehicle = await Vehicle.findOne({
        _id: maintenance.vehicle,
        owner: req.user._id
    });

    if (!vehicle) {
        return res.status(404).send("Maintenance reminder not found.");
    }

    maintenance.status = "Completed";
    await maintenance.save();

    res.redirect(`/maintenance/history/${vehicle._id}`);
});


// ================================
// Start Server
// ================================


const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Autocare server is running on port ${PORT}`);
});
