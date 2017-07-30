const bloomxx = require("bloomxx");
const _ = require("lodash");
const jwt = require("jsonwebtoken");

// validate the function input
var validateCreateOptimal = (count, error, expiresType, expiresDuration) => {
    if (!_.isInteger(count)) throw new Error("count must be integer");
    if (!_.indexOf(["d", "h"], expiresType) == -1)
        throw new Error("do not support type " + expiresType + ", use h or d");
    if (!_.isInteger(expiresDuration))
        throw new Error("duration must be integer");
};

/**
 * create filter with ttl
 * @param {Int} count the number of token arrive in time to live
 * @param {Double} error the error rate 0.001 ~ 0.1 %
 * @param {Enum} expiresType error type 'd' or 'h'
 * @param {Int} expiresDuration time to expires depend on expiresType
 */
var createOptimal = (count, error, expiresType, expiresDuration) => {
    var filter = {};
    filter.data = [];
    var unit = null;

    // validate
    validateCreateOptimal(count, error, expiresType, expiresDuration);

    // the unit in second
    switch (expiresType) {
        case "h":
            unit = 3600;
            break;
        case "d":
            unit = 86400;
            break;
        default:
            throw new Error("do not support " + expiresType + " type");
    }

    // add the filter
    for (var i = 0; i <= expiresDuration; i++) {
        filter.data.push(
            bloomxx.BloomFilter.createOptimal(count / expiresDuration, error)
        );
    }

    // default value
    var first = 0;
    var date = Math.floor(Date.now() / 1000); // now in second

    /**
     * add a key to bloom
     * @param {String} token the jwt token
     */
    filter.add = token => {
        // update first and date
        var now = Math.floor(Date.now() / 1000);
        var distance = now - date;
        while (distance >= unit) {
            filter.data[first].clear();
            first = (first + 1) % (expiresDuration + 1);
            date += unit;
            distance -= unit;
        }

        var decoded = jwt.decode(token);
        var exp = decoded.exp;

        if (_.isUndefined(exp) || _.isNull(exp) || exp <= now) {
            console.log("the expire time is invalid");
            return;
        }

        // choose jwt position in array
        var distance = Math.floor((exp - date) / unit);
        if (distance > expiresDuration) {
            console.log(
                "WARNING! " +
                    token +
                    " has time to live greater than bloom filter size"
            );
            distance = expiresDuration;
        }
        var position = (first + distance) % (expiresDuration + 1);
        filter.data[position].add(token);
    };

    /**
     * check a key in bloom
     * @param {String} key the jwt token
     */
    filter.has = token => {
        for (var i = 0; i < filter.data.length; i++) {
            if (filter.data[i].has(token)) return true;
        }
        return false;
    };

    /**
     * empty the filter
     */
    filter.clear = () => {
        for (var i = 0; i < filter.data.length; i++) {
            filter.data[i].clear();
        }
    };

    return filter;
};

module.exports = { createOptimal };