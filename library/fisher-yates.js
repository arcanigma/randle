module.exports = function (array) {
    for (let i = array.length-1; i >= 1; i--) {
        let j = random_int(0, i);
        [array[i], array[j]] = [array[j], array[i]];
        // let temp = array[i];
        // array[i] = array[j];
        // array[j] = temp;
    }
};
