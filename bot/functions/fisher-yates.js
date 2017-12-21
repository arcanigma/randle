var randomInt = require('php-random-int');

module.exports = function(array) {
    for (let i = array.length-1; i >= 1; i--) {
        let j = randomInt(0, i);
        [array[i], array[j]] = [array[j], array[i]];
    }
};
