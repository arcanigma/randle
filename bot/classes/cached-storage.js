var NodeCache = require('node-cache'),
    deepEqual = require('deep-equal');

module.exports = class CachedStorage {

    constructor(backing, config) {
        this.backing = backing;
        this.cache = new NodeCache(config);
    }

    get(id, callback) {
        let cache = this.cache,
            backing = this.backing;
        cache.get(id, function(err, cached_obj) {
            if (cached_obj) {
                callback(err, cached_obj);
            }
            else {
                backing.get(id, function(err, fresh_obj) {
                    cache.set(id, fresh_obj);
                    callback(err, fresh_obj);
                });
            }
        });
    }

    set(obj, callback) {
        let cache = this.cache,
            backing = this.backing;

        cache.get(obj.id, function(err, cached_obj) {
            if (!deepEqual(obj, cached_obj)) {
                backing.save(obj, function(err) {
                    cache.set(obj.id, obj);
                    callback(err);
                });
            }
            else {
                callback(err);
            }
        });
    }

};
