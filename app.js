require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const Disease = require("./models/disease.js")
const path = require("path");
const ejsMate = require("ejs-mate");
const request = require('request');
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const router = express.Router();
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { isLoggedIn, saveRedirectUrl } = require("./middleware.js");
const Cart = require("./models/cart.js");
const CartItem = require("./models/cartItem.js");
const Order = require("./models/order.js");
const Recommendation = require("./models/recommendation.js");
const MongoStore = require('connect-mongo');



//const MONGO_URL = "mongodb://127.0.0.1:27017/wellbite";
const dbUrl = process.env.ATLASDB_URL;

async function main() {
    await mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true });
}
main()
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch(err => console.log(err));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine('ejs', ejsMate);
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60,
    crypto: { secret: process.env.CRYPTO_SECRET || "cryptosecret" },
});
app.use(
    session({
        store,
        secret: process.env.SESSION_SECRET || "sessionsecret",
        resave: false,
        saveUninitialized: true,
        cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
);

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());



app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// home route
app.get("/", wrapAsync(async (req, res) => {
    try {
        let hasOrders = false;
        let allRecommendations = [];

        // Check if a user is logged in
        if (req.user) {
            // Check if the logged-in user has previous orders
            const userOrders = await Order.find({ user: req.user._id });
            hasOrders = userOrders.length > 0;

            // Fetch recommendations for the logged-in user
            allRecommendations = await Recommendation.find({ user: req.user._id }).populate("item");
        }

        // Fetch all listings
        const allListings = await Listing.find({});

        res.render("listings/index.ejs", { allListings, hasOrders, allRecommendations });
    } catch (error) {
        console.error("Error in fetching listings or recommendations:", error);
        res.status(500).render("error.ejs", { message: "Failed to load listings" });
    }
}));



//about page

app.get("/about", (req, res) => {
    res.render("listings/about.ejs");
})

//help page
app.get("/askMe", (req, res) => {
    res.render("listings/askMe.ejs");
})

//show
app.get("/:id/showListing", wrapAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/show.ejs", { listing });
}));

app.get("/:recipeTitle/showListingPatient", async (req, res) => {
    const recipeTitle = req.params.recipeTitle; // Extract recipe title from URL
    const apiUrl = `https://cosylab.iiitd.edu.in/recipe-search/recipe?pageSize=10&searchText=${encodeURIComponent(
        recipeTitle
    )}`;


    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const apiData = await response.json();
        const recipes = apiData.payload.data || []; // Extract the array of recipe objects
        const recipe = recipes[0]; // Pick the first recipe from the array
        console.log(recipe);

        // Pass only the first recipe
        res.render("listings/showListingPatient", { recipe });
    } catch (error) {
        console.error("Error fetching recipe data:", error.message);
        res.status(500).send("Failed to fetch recipe listings.");
    }
});




// Route to fetch the recipe of the day
app.get("/showROTD", async (req, res) => {
    try {
        const apiUrl = "https://cosylab.iiitd.edu.in/recipe/recipeOftheDay";
        const response = await fetch(apiUrl);

        console.log("Response Status:", response.status);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const apiData = await response.json();
        console.log("API Data:", JSON.stringify(apiData, null, 2)); // Log the data for debugging

        // Extract the payload from the API data
        const recipeOfTheDay = apiData.payload;

        res.render("listings/show_ROTD", { recipeOfTheDay: recipeOfTheDay });
    } catch (error) {
        console.error("Error fetching recipe of the day:", error.message); // Log the error message
        res.status(500).send("Failed to fetch recipe of the day.");
    }
});

//search page
app.get("/search_page", (req, res) => {
    res.render("searched/search_page.ejs");
});

app.get("/search_page_patient", wrapAsync(async (req, res) => {
    const allDisease = await Disease.find({});
    res.render("searched/search_page_patient.ejs", { allDisease });

}));

app.get("/search_page_regular", wrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("searched/search_page_regular.ejs", { allListings });

}));

app.get("/:id/searchedContentPatient", wrapAsync(async (req, res) => {
    try {
        const disease = await Disease.findById(req.params.id);
        if (!disease) {
            return res.status(404).send("Disease not found");
        }

        console.log("Disease Object:", disease);
        console.log("Good Ingredients:", disease.goodIngredients);

        const ingredientUsed = Array.isArray(disease.goodIngredients)
            ? disease.goodIngredients.join(", ")
            : disease.goodIngredients;

        const options = {
            method: 'POST',
            url: 'https://cosylab.iiitd.edu.in/recipe-search/recipesByIngredient?page=1&pageSize=100',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ingredientUsed: ingredientUsed
            })
        };

        console.log("API Request Options:", options);

        request(options, function (error, response) {
            if (error) {
                console.error("Error fetching recipes:", error);
                return res.status(500).send("Error fetching recipes");
            }

            console.log("API Response:", response);

            try {
                const data = JSON.parse(response.body);
                console.log("Parsed API Response:", data);

                const recipes = data.payload?.data || [];
                console.log("Extracted Recipes:", recipes);

                res.render("searched/searchedContentPatient", {
                    recipes: recipes,
                    disease: disease
                });
            } catch (err) {
                console.error("Error parsing JSON:", err);
                res.status(500).send("Error parsing recipe data");
            }
        });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).send("Server error");
    }
}));




//User routes
app.get("/get_started", (req, res) => {
    res.render("users/getStarted.ejs");
});

app.post("/signup", wrapAsync(async (req, res) => {
    try {
        let { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, (err) => {
            if (err) {
                return next();
            }
            req.flash("success", "Welcome to WellBite!");
            res.redirect("/");
        });

    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/get_started");
    }
}));

app.post("/login", saveRedirectUrl, passport.authenticate("local", { failureRedirect: "/get_started", failureFlash: true }), async (req, res) => {
    try {
        req.flash("success", "Welcome back to WellBite");
        res.redirect(res.locals.redirectUrl);  // Corrected to res.locals
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/get_started");
    }
});


//logout

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "You are logged out!");
        res.redirect("/");
    });
})

//cart

app.get("/cart", isLoggedIn, saveRedirectUrl, wrapAsync(async (req, res, next) => {
    try {

        const user = await User.findById(req.user._id).populate({
            path: 'cart',
            populate: {
                path: 'items',
                populate: {
                    path: 'product'
                }
            }
        });
        const cart = user.cart;
        res.render("./users/cart.ejs", { cart });
    } catch (err) {
        req.flash('error', "Your cart is Empty!");
        res.redirect('/');
    }
}));

app.post("/:id/addToCart", isLoggedIn, saveRedirectUrl, wrapAsync(async (req, res, next) => {
    try {
        const productId = req.params.id;
        const userId = req.user._id;
        const product = await Listing.findById(productId);

        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/');
        }

        let user = await User.findById(userId).populate('cart');

        if (!user.cart) {
            const cart = new Cart({ user: userId });
            await cart.save();
            user.cart = cart._id;
            await user.save();
        }

        let cart = await Cart.findById(user.cart).populate('items');

        let cartItem = cart.items.find(item => item.product.toString() === productId);
        if (cartItem) {
            cartItem.quantity += 1;
        } else {
            cartItem = new CartItem({
                user: userId,
                product: productId,
                quantity: 1,
                price: product.price
            });
            await cartItem.save();
            cart.items.push(cartItem);
        }

        cart.totalPrice += product.price;
        await cart.save();

        req.flash('success', 'Added to Cart');
        res.redirect('/cart');
    } catch (err) {
        next(err);
    }
}));

app.post("/:productId/deleteFromCart", isLoggedIn, saveRedirectUrl, wrapAsync(async (req, res, next) => {
    try {
        const productId = req.params.productId;
        const userId = req.user._id;

        // Find the user's cart
        const user = await User.findById(userId).populate('cart');
        const cart = user.cart;

        // Find the cart item corresponding to the product to be deleted
        const cartItem = await CartItem.findOneAndDelete({ product: productId, user: userId });

        // Remove the cart item reference from the cart
        cart.items.pull(cartItem._id);

        // Update the total price of the cart
        cart.totalPrice = cart.totalPrice - (cartItem.price * cartItem.quantity);

        // Save the changes
        await cart.save();

        req.flash('success', 'Product removed from cart');
        res.redirect('/cart');
    } catch (err) {
        next(err);
    }
}));


// checkout

app.get("/checkOut", isLoggedIn, saveRedirectUrl, async (req, res) => {
    res.render("users/checkOut.ejs");
})



// Helper function to find a recommended item based on shared ingredients
async function findIngredientBasedRecommendation(cartItems) {
    let recommendedItem = null;
    let maxSharedIngredients = 0;

    // Collect all ingredients from the items in the order
    const orderIngredients = new Set();
    const orderedItemIds = new Set(cartItems.map(item => item.product.toString()));

    for (let item of cartItems) {
        const listing = await Listing.findById(item.product);
        listing.ingredients.forEach(ingredient => orderIngredients.add(ingredient));
    }

    // Fetch all listings excluding the items already in the order
    const allListings = await Listing.find({
        _id: { $nin: Array.from(orderedItemIds) }
    });

    // Find the listing with the most shared ingredients
    for (let listing of allListings) {
        const sharedIngredientsCount = listing.ingredients.filter(ingredient => orderIngredients.has(ingredient)).length;

        if (sharedIngredientsCount > maxSharedIngredients) {
            maxSharedIngredients = sharedIngredientsCount;
            recommendedItem = listing;
        }
    }

    return recommendedItem;
}


// Function to find the protein-based recommended item
async function findProteinRecommendation(cartItems) {
    let proteinRecommendation = null;
    let closestProteinDifference = Infinity;

    // Calculate average protein in the order
    let totalProtein = 0;
    for (let item of cartItems) {
        const listing = await Listing.findById(item.product);
        if (listing) {
            totalProtein += listing.protein;
        }
    }
    const avgProtein = totalProtein / cartItems.length;

    // Fetch all listings excluding those in the cart
    const allListings = await Listing.find({
        _id: { $nin: cartItems.map(item => item.product) }  // Exclude ordered items
    });

    // Find the listing with the closest protein content
    for (let listing of allListings) {
        const proteinDifference = Math.abs(listing.protein - avgProtein);

        // Recommend the product with the closest protein content to the average
        if (proteinDifference < closestProteinDifference) {
            closestProteinDifference = proteinDifference;
            proteinRecommendation = listing;
        }
    }

    return proteinRecommendation;
}


// Function to find the calorie-based recommended item
async function findCalorieRecommendation(cartItems) {
    let calorieRecommendation = null;
    let closestCalorieDifference = Infinity;

    // Check if there are items in the cart
    if (cartItems.length === 0) {
        return null; // No items in the cart, no recommendations
    }

    // Calculate average calories in the order
    let totalCalories = 0;
    for (let item of cartItems) {
        const listing = await Listing.findById(item.product);
        if (listing && listing.calorie !== undefined) { // Ensure calorie field exists
            totalCalories += listing.calorie; // Use 'calorie' instead of 'calories'
        }
    }

    const avgCalories = totalCalories / cartItems.length;

    // Debugging output
    console.log(`Total Calories: ${totalCalories}`);
    console.log(`Average Calories: ${avgCalories}`);

    // Fetch all listings excluding those in the cart
    const allListings = await Listing.find({
        _id: { $nin: cartItems.map(item => item.product) }  // Exclude ordered items
    });

    // Find the listing with the closest calorie content
    for (let listing of allListings) {
        if (listing.calorie !== undefined) { // Ensure calorie field exists
            const calorieDifference = Math.abs(listing.calorie - avgCalories); // Use 'calorie' instead of 'calories'

            // Recommend the product with the closest calorie content to the average
            if (calorieDifference < closestCalorieDifference) {
                closestCalorieDifference = calorieDifference;
                calorieRecommendation = listing;
            }
        }
    }

    return calorieRecommendation;
}


// Function to find the fat-based recommended item
async function findFatRecommendation(cartItems) {
    let fatRecommendation = null;
    let closestFatDifference = Infinity;

    // Calculate average fat in the order
    let totalFat = 0;
    for (let item of cartItems) {
        const listing = await Listing.findById(item.product);
        if (listing) {
            totalFat += listing.fat; // Assuming 'fat' is a field in your Listing model
        }
    }
    const avgFat = totalFat / cartItems.length;

    // Fetch all listings excluding those in the cart
    const allListings = await Listing.find({
        _id: { $nin: cartItems.map(item => item.product) }  // Exclude ordered items
    });

    // Find the listing with the closest fat content
    for (let listing of allListings) {
        const fatDifference = Math.abs(listing.fat - avgFat);

        // Recommend the product with the closest fat content to the average
        if (fatDifference < closestFatDifference) {
            closestFatDifference = fatDifference;
            fatRecommendation = listing;
        }
    }

    return fatRecommendation;
}

// Function to find items with the same taste profile as the ordered food
async function findTasteProfileBasedRecommendation(cartItems) {
    let recommendedItem = null;

    // Collect the taste profiles of the items in the cart
    const orderTasteProfiles = new Set();
    for (let item of cartItems) {
        const listing = await Listing.findById(item.product);
        if (listing) {
            orderTasteProfiles.add(listing.tasteProfile);
        }
    }

    // Fetch all listings excluding the items in the order
    const allListings = await Listing.find({
        _id: { $nin: cartItems.map(item => item.product) }  // Exclude items already ordered
    });

    // Find listings with matching taste profiles
    for (let listing of allListings) {
        if (orderTasteProfiles.has(listing.tasteProfile)) {
            recommendedItem = listing;
            break; // Recommend the first matching taste profile found
        }
    }

    return recommendedItem;
}


// Place order route with recommendation feature
app.get("/placeOrder", isLoggedIn, saveRedirectUrl, async (req, res) => {
    try {
        const userOrders = await Order.find({ user: req.user._id });
        const hasOrders = userOrders.length > 0;

        // Fetch user's cart
        const cart = await Cart.findOne({ user: req.user._id }).populate("items");

        if (cart && cart.items.length > 0) {
            const order = new Order({
                user: req.user._id,
                items: cart.items.map((item) => ({
                    product: item.product,
                    quantity: item.quantity,
                    price: item.price,
                })),
                totalAmount: cart.totalPrice,
                orderDate: new Date(),
            });

            await order.save();

            // Find a recommended item based on shared ingredients
            const ingredientRecommendation = await findIngredientBasedRecommendation(cart.items);

            // Save ingredient-based recommendation if it's not already recommended
            if (ingredientRecommendation) {
                const existingIngredientRecommendation = await Recommendation.findOne({
                    user: req.user._id,
                    item: ingredientRecommendation._id
                });

                if (!existingIngredientRecommendation) {
                    const recommendation = new Recommendation({
                        user: req.user._id,
                        item: ingredientRecommendation._id,
                        recommendationType: "ingredient-based",
                    });
                    

                    await recommendation.save();
                }
            }

            // Find a recommended item based on protein content
            const proteinRecommendation = await findProteinRecommendation(cart.items);

            // Save protein-based recommendation if it's not already recommended
            if (proteinRecommendation) {
                const existingProteinRecommendation = await Recommendation.findOne({
                    user: req.user._id,
                    item: proteinRecommendation._id
                });

                if (!existingProteinRecommendation) {
                    const recommendation = new Recommendation({
                        user: req.user._id,
                        item: proteinRecommendation._id,
                        recommendationType: "protein-based",
                    });
                    

                    await recommendation.save();
                }
            }

            // Find a recommended item based on calorie content
            const calorieRecommendation = await findCalorieRecommendation(cart.items);

            // Save calorie-based recommendation if it's not already recommended
            if (calorieRecommendation) {
                const existingCalorieRecommendation = await Recommendation.findOne({
                    user: req.user._id,
                    item: calorieRecommendation._id
                });

                if (!existingCalorieRecommendation) {
                    const recommendation = new Recommendation({
                        user: req.user._id,
                        item: calorieRecommendation._id,
                        recommendationType: "calorie-based",
                    });
                    

                    await recommendation.save();
                }
            }

            // Find a recommended item based on fat content
            const fatRecommendation = await findFatRecommendation(cart.items);

            // Save fat-based recommendation if it's not already recommended
            if (fatRecommendation) {
                const existingFatRecommendation = await Recommendation.findOne({
                    user: req.user._id,
                    item: fatRecommendation._id
                });

                if (!existingFatRecommendation) {
                    const recommendation = new Recommendation({
                        user: req.user._id,
                        item: fatRecommendation._id,
                        recommendationType: "fat-based",
                    });
                    

                    await recommendation.save();
                }
            }

            // Find a recommended item based on taste profile
            const tasteProfileRecommendation = await findTasteProfileBasedRecommendation(cart.items);

            // If a recommended item is found, check if it's already recommended
            if (tasteProfileRecommendation) {
                const existingRecommendation = await Recommendation.findOne({
                    user: req.user._id,
                    item: tasteProfileRecommendation._id
                });

                // Save the recommendation only if it hasn't been recommended before
                if (!existingRecommendation) {
                    const recommendation = new Recommendation({
                        user: req.user._id,
                        item: tasteProfileRecommendation._id,
                        recommendationType: "taste-based",

                    });
                    

                    await recommendation.save();
                }
            }

            // Clear cart after placing the order
            cart.items = [];
            cart.totalPrice = 0;
            await cart.save();
        }

        res.render("users/placeOrder.ejs", {
            success: "Order placed successfully",
            hasOrders,
        });
    } catch (error) {
        console.error(error);
        res.status(500).render("users/placeOrder.ejs", { error: "Failed to place order" });
    }
});






/* app.get("/testListing", async (req, res) => {
    let sampleListing = new Listing({
        title: "Dal Makhni",
        price: 120,
        calorie: 350,
        fat: 20,
        protien: 25,
    })

    await sampleListing.save();
    console.log("sample was saved");
    res.send("successful testing");
}); */

app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"));
})

app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something Went Wrong!" } = err;
    res.render("error.ejs", { message });
    //res.status(statusCode).send(message);
});

app.listen(8080, () => {
    console.log("Server is listening on port 8080");
});
