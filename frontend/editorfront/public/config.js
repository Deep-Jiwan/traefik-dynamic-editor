// Frontend runtime configuration
// Edit this file to override API base URL for development
(function(){
    // Default: use same origin + /api so it works when served by backend
    var defaultApiBase = window.location.protocol + '//' + window.location.host + '/api';

    // If you want to hardcode a different API base for development, replace the value below.
    window.APP_CONFIG = window.APP_CONFIG || {};
    window.APP_CONFIG.API_BASE = window.APP_CONFIG.API_BASE || defaultApiBase;
})();
