import Ember from 'ember';
import DataSerializer from './data';

export default DataSerializer.extend({
  isNewSerializerAPI: true,
  normalizeArrayResponse: function(store, primaryType, payload) {
    var that = this;
    var _payload = {};
    var _rootKey = Ember.String.pluralize(primaryType.modelName);
    _payload[_rootKey] = (payload.rows || []).map(function (row) {
      row.id = that._getRowId(row);
      return that.addIds(row);
    });
    if(payload['meta']){
      _payload['meta'] = payload['meta'];
    }
    return this._super(store, primaryType, _payload, true);
  },
  _getRowId: function(row) {
    console.log('BROOOO',btoa(JSON.stringify(row.key)));
    return btoa(JSON.stringify(row.key));
  }
});