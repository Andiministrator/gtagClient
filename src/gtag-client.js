/*** GTAG Client | BOF ***/

/**
 * Global implementation script for delivering a GTAG.
 * @version 1.1
 * @lastupdate 11.09.2025 by Andi Petzoldt <andi@petzoldt.net>
 * @repository https://github.com/Andiministrator/gtagClient/
 * @author Andi Petzoldt <andi@petzoldt.net>
 * @documentation see README.md or https://github.com/Andiministrator/gtagClient/
 * @sGTMdocumentation https://developers.google.com/tag-platform/tag-manager/server-side/api?hl=de
 */

// Initialization
const claimRequest = require('claimRequest');
const getGoogleScript = require('getGoogleScript');
const getRequestPath = require('getRequestPath');
const getRequestQueryParameter = require('getRequestQueryParameter');
const setResponseBody = require('setResponseBody');
const setResponseHeader = require('setResponseHeader');
const setResponseStatus = require('setResponseStatus');
const returnResponse = require('returnResponse');
const toBase64 = require('toBase64');
const makeNumber = require('makeNumber');
const createRegex = require('createRegex');
const logToConsole = require('logToConsole');

// Config
var CONFIG = {
  debug: typeof data.debug=='boolean' ? data.debug : false,
  timeout: makeNumber(data.timeout ? data.timeout : 5000),
  nonDirectInject: typeof data.nonDirectInject=='boolean' ? data.nonDirectInject : false,
  addJSbeforeGTM: typeof data.addJSbeforeGTM=='string' ? data.addJSbeforeGTM : '',
  addJSafterGTM: typeof data.addJSafterGTM=='string' ? data.addJSafterGTM : '',
  fireDLevent: typeof data.fireDLevent=='boolean' ? data.fireDLevent : false,
  timeDLevent: typeof data.timeDLevent=='string' ? data.timeDLevent : '',
  oneTag: typeof data.oneTag=='boolean' ? data.oneTag : false,
  stAttributes: data.scriptAttributes || [],
  allowedIDs: data.allowedIDs || []
};

// Get data
var debugMode = getRequestQueryParameter('debug') === 'true' || CONFIG.debug;
var requestedId = getRequestQueryParameter('id');

// Check if Request is to claim
if (getRequestPath() !== '/gtag/js' || !requestedId) return;
var allowed = false;
if (CONFIG.allowedIDs && CONFIG.allowedIDs.length>0) {
  for (var j=0; j<CONFIG.allowedIDs.length; j++) {
    if (requestedId==CONFIG.allowedIDs[j].id) allowed = true;
  }
} else { allowed = true; }
if (!allowed) return;
claimRequest();

// Some Debug info
if (CONFIG.debug) {
  logToConsole('info', '=== GTAG Client ===', CONFIG.nonDirectInject ? '(own script tag)' : '(direct)');
  logToConsole('info', 'Requested ID:', requestedId);
  logToConsole('info', 'Debug Mode:', debugMode);
}

// Help Functions

// Get GTAG script for first ID
const rgx = createRegex('\\[id\\]', 'i');
var fireScript = function(src) {
  if (typeof src!='string') src = '';
  src += ';\n';
  // Set additional dataLayer event
  if (CONFIG.fireDLevent) {
    var dl_ev_src = '\nwindow.dataLayer=window.dataLayer||[];\n' + 'window.dataLayer.push({ event:"gtag_loaded", gtag:"'+requestedId+'" });\n';
    if (CONFIG.timeDLevent == 'fireDLbefore') { src = dl_ev_src + src; } else { src += dl_ev_src; }
  }
  src = CONFIG.addJSbeforeGTM + src + CONFIG.addJSafterGTM;
  if (!CONFIG.nonDirectInject) return src;
  var ret = '(function(){\n';
  if (CONFIG.oneTag) ret+= 'var exists=document.querySelector(\'script[data-src-flag="gt"]\');if(!exists){\n';
  ret += 'var s=document.createElement("script");s.type="text/javascript";s.setAttribute("data-src-flag","gt");';
  for (var i=0; i<CONFIG.stAttributes.length; i++) {
    var nam = CONFIG.stAttributes[i].stName;
    var val = CONFIG.stAttributes[i].stValue;
    if (val.indexOf('id')!==-1) val = val.replace(rgx, requestedId);
    ret += nam=='id' ? 's["'+nam+'"]="'+val+'";'
                     : 's.setAttribute("'+nam+'","'+val+'");';
  }
  ret += 's.text=atob("' + toBase64(src) + '");document.head.appendChild(s);\n';
  if (CONFIG.oneTag) ret += '}\n';
  ret += '})();\n';
  return ret;
};

// Set Header
var setHeader = function(headers) {
  if (typeof headers!='object' || !headers) headers = {};
  setResponseHeader('Content-Type', headers['content-type'] || 'application/javascript; charset=utf-8');
  setResponseHeader('Cache-Control', headers['cache-control'] || 'public, max-age=3600');
  setResponseHeader('Access-Control-Allow-Origin', '*');
  setResponseHeader('Access-Control-Allow-Methods', 'GET');
  if (headers.expires) setResponseHeader('Expires', headers.expires);
  if (headers['last-modified']) setResponseHeader('Last-Modified', headers['last-modified']);
};

// Send Error
var sendError = function(errmsg, obj) {
  if (CONFIG.debug) logToConsole('warn', '✗ '+errmsg, obj);
  setHeader(null);
  setResponseStatus(500);
  setResponseBody('/* ' + errmsg + '*/');
  returnResponse();
};

// Send Response
var sendResponse = function(header,src) {
  if (typeof src!='string' || !src) {
    sendError('No GTAG available', typeof src);
    return;
  }
  setHeader(header);
  setResponseStatus(200);
  setResponseBody(src);
  returnResponse();
};

// Main Logic
getGoogleScript('GTAG', {
  id: requestedId,
  debug: debugMode,
  timeout: CONFIG.timeout
}).then(function(result) {
  if (CONFIG.debug) logToConsole('info', '✓ GTAG Script geladen:', requestedId);
  sendResponse(result.header, fireScript(result.script));
}).catch(function(error) {
  sendError('Error by loading GTAG script (ID: '+requestedId+')', error);
});

/*** GTAG Client | EOF ***/