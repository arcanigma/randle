var crypto = require('crypto');

const MIN_INT32 = -(2**31),
      MAX_INT32 = (2**31)-1;

module.exports = function(min, max) {
    if (
        !Number.isInteger(min) ||
        !Number.isInteger(max)
    ) throw new TypeError();

    if (
        (min | 0) !== min ||
        (max | 0) !== max
    ) throw new RangeError();

    min |= 0;
    max |= 0;

    if (
        min > max
    ) throw new RangeError();

    if (
        min > 0
        ? max < MIN_INT32 + min
        : max > MAX_INT32 + min
    ) throw new RangeError();

    if (max === min) return min;

    var range = (max - min)|0;

    var bits = 0,
        bytes = 0,
        mask = 0;

    while (range > 0) {
        if (bits % 8 === 0)
            bytes++;
        bits++;
        range >>= 1;
        mask = mask << 1 | 1;
    }

    var attempts = 0, rand = 0;
    do {
        if (attempts > 128) throw new Error();

        var buffer = crypto.randomBytes(bytes);

        rand &= 0;
        for (let i = 0; i < bytes; i++)
            rand |= buffer[i] << (i * 8);
        rand &= mask;
        rand += min;

        attempts++;
    } while ((rand | 0) !== rand || rand > max || rand < min);

    return rand;
}
