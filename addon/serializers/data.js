import Ember from 'ember';
import DS from 'ember-data';
import {md5} from 'md5';

const {
  get
} = Ember;

const {
  forEach
} = Ember.EnumerableUtils;

var DataSerializer = DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
  primaryKey: "_id",

  normalize: function(typeClass, hash, prop) {
    // var normalizedHash = this._super(type, hash, prop);

    this.normalizeId(hash,typeClass);
    this.normalizeAttributes(typeClass, hash);
    this.normalizeRelationships(typeClass, hash);

    this.normalizeUsingDeclaredMapping(typeClass, hash);

    if (this.normalizeHash && this.normalizeHash[prop]) {
      Ember.deprecate('`RESTSeri  zalizer.normalizeHash` has been deprecated. Please use `serializer.normalize` to modify the payload of single resources.', false, {
        id: 'ds.serializer.normalize-hash-deprecated',
        until: '2.0.0'
      });
      this.normalizeHash[prop](hash);
    }

    this.applyTransforms(typeClass, hash);

    return extractEmbeddedRecords(this, this.store, typeClass, hash);
  },

  hasEmbeddedAlwaysOption: function() {
    return true;
  },
  normalizeId: function(hash,typeClass) {
    Ember.Logger.assert(hash && (hash.id || hash._id), `Received invalid data for type ${Ember.String.dasherize(typeClass.typeKey)})`);
    if (!hash && !(hash.id  || hash._id)) {
      Ember.onerror(`Received invalid data for type ${Ember.String.dasherize(typeClass.typeKey)}`);
    }
    hash.id = hash._id || hash.id;
    delete hash._id;
  },

  extractSingle: function(store, primaryType, rawPayload, recordId) {
    var payload = {};
    var primaryTypeName = primaryType.typeKey;
    payload[primaryTypeName] = this.addIds(rawPayload);

    return this._super(store, primaryType, payload, recordId);
  },

  extractArray: function (store, primaryType, payload) {
    var that = this;
    var _payload = {};
    var _rootKey = Ember.String.pluralize(primaryType.typeKey);
    
    // Check to prevent overriding payload if serializer are extending data serializer.
    if(!payload[_rootKey]){
      _payload[_rootKey] = (payload.rows || []).map(function (row) {
        return that.addIds(row.doc);
      });
    } else {
      _payload = payload;
    }

    return this._super(store, primaryType, _payload);
  },

  addIds: function(payload) {
    var count, id, prop, row, val, _i, _len;
    for (prop in payload) {
      if (prop === "_attachments") {
        continue;
      }
      
      val = payload[prop];
      if (typeof val !== "object" || val === null) {
        continue;
      }
      id = payload.id || payload._id;
      if (val instanceof Array && val.length) {
        count = 1;
        for (_i = 0, _len = val.length; _i < _len; _i++) {
          row = val[_i];
          if (typeof row !== "object" || row === null) {
            continue;
          }
          row.id = md5(id + prop + count);
          this.addIds(row);
          count++;
        }
      } else {
        val.id = md5(id + prop);
        this.addIds(val);
      }
    }
    return payload;
  },

  extractMeta: function(store, type, payload) {
    if (payload) {
      var meta = payload.meta || {};
      if (payload.total_rows) {
        meta.total_rows = payload.total_rows;
      }
      if (payload.offset) {
        meta.offset = payload.offset;
      }
      if(typeof type === 'string'){
        store.setMetadataFor(type, meta);
      }
      else{
        store.setMetadataFor(type.typeKey, meta);
      }
      delete payload.meta;
      delete payload.total_rows;
      delete payload.offset;
    }
  },

  serialize: function(snapshot, options) {
    var json = this._super(snapshot, options);
    // if (json._rev === null) {
    //   delete json._rev;
    // }
    // if (json._attachments === null) {
    //   delete json._attachments;
    // }
    
    for(let key of Object.keys(json)) {
        if (Ember.isNone(json[key])) {
          delete json[key];
        }
    }
    
    return json;
  },

  serializeHasMany: function(snapshot, json, relationship) {
    var key = relationship.key;
    var serializer = this;
    var relationshipType = snapshot.constructor.determineRelationshipType(relationship,serializer.store);  
    if (relationshipType === 'manyToNone' || relationshipType === 'manyToMany') {
      if (snapshot.get(`${key}.length`) > 0) {
        return json[key] = snapshot.get(key).map(function(row) {
          json = serializer.serialize(row, {
            includeId: false
          });
          if (relationship.options.polymorphic) {
            serializer.serializePolymorphicType(row, json, relationship);
          }
          return json;
        });
      } else {
        json[key] = [];
        return json;
      }
    }
  },

  serializeBelongsTo: function(snapshot, json, relationship) {
    var key = relationship.key;
    var belongsTo = snapshot.get(key);
    key = this.keyForRelationship ? this.keyForRelationship(key, "belongsTo") : key;
    if (belongsTo) {
      var data = this.serialize(belongsTo, {
        includeId: false
      });
      if (relationship.options.polymorphic) {
        this.serializePolymorphicType(belongsTo, data, relationship);
      }
      return json[key] = data;
    }
  },

  serializePolymorphicType: function(snapshot, json/*, relationship*/) {
    return json.type = Ember.String.underscore(snapshot.constructor.typeKey);
  }
});

// chooses a relationship kind to branch which function is used to update payload
// does not change payload if attr is not embedded
function extractEmbeddedRecords(serializer, store, typeClass, partial) {

  typeClass.eachRelationship(function(key, relationship) {
    if (serializer.hasDeserializeRecordsOption(key)) {
      var embeddedType = store.modelFor(relationship.type);
      if (relationship.kind === "hasMany") {
        if (relationship.options.polymorphic) {
          extractEmbeddedHasManyPolymorphic(serializer,store, key, partial);
        } else {
          extractEmbeddedHasMany(serializer, store, key, embeddedType, partial);
        }
      }
      if (relationship.kind === "belongsTo") {
        if (relationship.options.polymorphic) {
          extractEmbeddedBelongsToPolymorphic(serializer, store, key, partial);
        } else {
          extractEmbeddedBelongsTo(serializer, store, key, embeddedType, partial);  
        }
        
      }
    }
  });

  return partial;
}

// handles embedding for `hasMany` relationship
function extractEmbeddedHasMany(serializer, store, key, embeddedType, hash) {
  if (!hash[key]) {
    return hash;
  }

  var ids = [];

  // var embeddedSerializer = store.serializerFor(embeddedType.typeKey);
  forEach(hash[key], function(data) {
    // var embeddedRecord = embeddedSerializer.normalize(embeddedType, data, null);
    var embeddedRecord = serializer.normalize(embeddedType, data, null);
    try {
      store.push(embeddedType.typeKey, embeddedRecord);
    } catch (e) {
      throw new TypeError(`Invalid data received for type: ${embeddedType.typeKey}`);
    }
    ids.push(embeddedRecord.id);
  });

  hash[key] = ids;
  return hash;
}

function extractEmbeddedHasManyPolymorphic(serializer,store, key, hash) {
  if (!hash[key]) {
    return hash;
  }

  var ids = [];

  forEach(hash[key], function(data) {
    var typeKey = data.type;
    var embeddedSerializer = store.serializerFor(typeKey);
    var embeddedType = store.modelFor(typeKey);
    var primaryKey = get(embeddedSerializer, 'primaryKey');
    
    // var embeddedRecord = embeddedSerializer.normalize(embeddedType, data, null);
    var embeddedRecord = serializer.normalize(embeddedType, data, null);
    try {
      store.push(embeddedType.typeKey, embeddedRecord);
    } catch (e) {
      throw new TypeError(`Invalid data received for type: ${embeddedType.typeKey}`);
    }
    ids.push({ id: embeddedRecord[primaryKey], type: typeKey });
  });

  hash[key] = ids;
  return hash;
}

function extractEmbeddedBelongsTo(serializer, store, key, embeddedType, hash) {
  if (!hash[key]) {
    return hash;
  }

  // var embeddedSerializer = store.serializerFor(embeddedType.typeKey);
  var embeddedSerializer = serializer;
  var embeddedRecord = embeddedSerializer.normalize(embeddedType, hash[key], null);
  
  try {
    store.push(embeddedType.typeKey, embeddedRecord);
  } catch (e) {
    throw new TypeError(`Invalid data received for type: ${embeddedType.typeKey}`);
  }
  
  hash[key] = embeddedRecord.id;
  //TODO Need to add a reference to the parent later so relationship works between both `belongsTo` records
  return hash;
}

function extractEmbeddedBelongsToPolymorphic(serializer, store, key, hash) {
  if (!hash[key]) {
    return hash;
  }

  var data = hash[key];
  var typeKey = data.type;
  // var embeddedSerializer = store.serializerFor(typeKey);
  var embeddedSerializer = serializer;
  var embeddedType = store.modelFor(typeKey);
  var primaryKey = get(embeddedSerializer, 'primaryKey');

  var embeddedRecord = embeddedSerializer.normalize(embeddedType, data, null);
  try {
    store.push(embeddedType.typeKey, embeddedRecord);
  } catch (e) {
    throw new TypeError(`Invalid data received for type: ${embeddedType.typeKey}`);
  }

  hash[key] = embeddedRecord[primaryKey];
  hash['type'] = typeKey;
  return hash;
}

export default DataSerializer;
