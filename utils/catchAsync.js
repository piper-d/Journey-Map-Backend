///////////////////////////////////
// Utility function to catch asynchronous errors and forward them to error routes

module.exports = func => {
    return (req, res, next) => {
        func(req, res, next).catch(next)
    }
}