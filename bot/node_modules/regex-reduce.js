module.exports = function(text, re, fun) {
    let old;
    do {
        old = text;
        text = text.replace(re, fun);
    } while (text != old);
    return text;
};
