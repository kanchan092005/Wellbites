module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged!");
        return res.redirect("/get_started");
    }
    next();
}

module.exports.saveRedirectUrl = (req, res, next) => {
    // Set res.locals.redirectUrl to req.session.redirectUrl or a default value
    res.locals.redirectUrl = req.session.redirectUrl || '/';  // Default to home page if redirectUrl is missing
    // Clear the redirectUrl from the session after saving it to res.locals
    req.session.redirectUrl = null;
    next();
};
