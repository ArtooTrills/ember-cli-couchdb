/* jshint node: true */
'use strict';

module.exports = {
  name: 'ember-cli-couchdb',
  isDevelopingAddon: function() {
    return true;
  },
  
  included: function(app) {
    this._super.included(app);
    
    app.vendorFiles['md5.js'] = 'vendor/md5.js';
    app.legacyFilesToAppend.push('vendor/md5.js');
  }
};
