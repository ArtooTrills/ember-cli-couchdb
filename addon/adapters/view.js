import Ember from "ember";
import DataAdapter from './data';

var ViewDataAdapter = DataAdapter.extend({
  defaultSerializer: "view",
  
  createRecord: function() {
    return Ember.assert('Can\'t call createRecord on ViewDataAdapter\'s model');
  },
  updateRecord: function() {
    return Ember.assert('Can\'t call updateRecord on ViewDataAdapter\'s model');
  },
  deleteRecord: function() {
    return Ember.assert('Can\'t call deleteRecord on ViewDataAdapter\'s model');
  }
});

export default ViewDataAdapter;
