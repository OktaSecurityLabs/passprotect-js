import * as sha1 from "js-sha1";
import * as vex from "../vendor/vex.combined.min.js";
import "../vendor/vex.css";
import "../vendor/vex-theme-wireframe.css";
import "./style.css";


/**
 * Settings (for the Vex library)
 */
vex.defaultOptions.className = "vex-theme-wireframe";
vex.defaultOptions.escapeButtonCloses = false;
vex.defaultOptions.overlayClosesOnClick = false;
vex.dialog.buttons.YES.text = "I Understand";


/**
 * Globals
 */
var PASS_PROTECT_EMAIL_CHECK_URI = "https://haveibeenpwned.com/api/v2/breachedaccount/";
var PASS_PROTECT_PASTE_CHECK_URI = "https://haveibeenpwned.com/api/v2/pasteaccountaccount/";
var PASS_PROTECT_PASSWORD_CHECK_URI = "https://api.pwnedpasswords.com/range/";


/**
 * Format numbers in a nice, human-readable fashion =)
 *
 * Stolen from: https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
 */
function numberFormatter(number, fractionDigits = 0, thousandSeperator = ',', fractionSeperator = '.') {
  if (number !==0 && !number || !Number.isFinite(number)) {
    return number;
  }

  const frDigits = Number.isFinite(fractionDigits)? Math.min(Math.max(fractionDigits, 0), 7) : 0;
  const num = number.toFixed(frDigits).toString();

  const parts = num.split('.');
  let digits = parts[0].split('').reverse();
  let sign = '';

  if (num < 0) {
    sign = digits.pop();
  }

  let final = [];
  let pos = 0;

  while (digits.length > 1) {
      final.push(digits.shift());
      pos++;

      if (pos % 3 === 0) {
        final.push(thousandSeperator);
      }
  }

  final.push(digits.shift());
  return `${sign}${final.reverse().join('')}${frDigits > 0 ? fractionSeperator : ''}${frDigits > 0 && parts[1] ? parts[1] : ''}`;
}


/**
 * This function returns true if the data is ignored and should not be used to
 * fire off a notification, false otherwise.
 *
 * @param {string} sensitiveData - The sensitive data to check for in
 *      localStorage / sessionStorage.
 */
function isIgnored(sensitiveData) {
  var data = sessionStorage.getItem(sensitiveData) || localStorage.getItem(sensitiveData);

  return data === "true" ? true : false;
}


/**
 * This function binds our protection to any suitable input elements on the
 * page. This way, we'll fire off the appropriate checks when an input value
 * changes.
 */
function protectInputs() {
  var inputs = document.getElementsByTagName("input");

  for (var i = 0; i < inputs.length; i++) {
    switch (inputs[i].type) {
      case "email":
        inputs[i].addEventListener("change", protectEmailInput);
        break;
      case "password":
        inputs[i].addEventListener("change", protectPasswordInput);
        break;
    }
  }
}


/**
 * Return a unique email hash suitable for caching.
 *
 * @param {string} email - The email address to hash.
 */
function getEmailHash(email) {
  return sha1(email + "-" + getHost());
}


/**
 * Return the top level host name for a domain. EG: Given woot.adobe.com, will
 * return adobe.com.
 */
function getHost() {
  return window.location.host.split('.').slice(-2).join('.');
}


/**
 * Protect email input elements. When a value is entered, we'll check the email
 * address against the haveibeenpwned API, then warn the user if their
 * credentials were compromised on the site they're currently on.
 *
 * @param {object} evt - The DOM event.
 */
function protectEmailInput(evt) {
  var host = getHost();
  var xmlHttp = new XMLHttpRequest();
  var inputValue = evt.srcElement.value;

  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
      var breaches = JSON.parse(xmlHttp.responseText);

      for (var i = 0; i < breaches.length; i++) {
        if (breaches[i].Domain === host && breaches[i].IsVerified) {
          var message = [
            '<p>' + breaches[i].Description + '</p>',
            '<p>The email you entered was one of the <b>' + numberFormatter(breaches[i].PwnCount) + "</b> that were compromised. If you haven't done so already, you should change your password.</p>"
          ].join('');

          vex.dialog.alert({
            message: "Breach detected!",
            input: message,
            callback: function() {
              // Cache this email once the user clicks the "I Understand" button
              // so we don't continuously annoy the user with the same warnings.
              localStorage.setItem(getEmailHash(inputValue), "true");
            }
          });
        }
      }
    };
  };

  // If this email is cached, we shouldn't do anything.
  if (isIgnored(getEmailHash(inputValue))) {
    return;
  }

  xmlHttp.open("GET", PASS_PROTECT_EMAIL_CHECK_URI + encodeURIComponent(inputValue), true);
  xmlHttp.send(null);
}


/**
 * Generate a unique hash which we can store locally to remember a password.
 * Now, it would obviously be unsafe to store a password hash in sessionStorage
 * (because if an XSS occurs it could be bad).
 *
 * BUT, what we can do to reduce risk and still maintain SOME sort of knowledge
 * (albeit, with a fairly high collision risk), we can essentially compute the
 * password hash, grab just the first 5 chars of it, then tack on our host info,
 * then hash the resulting string.
 *
 * This way we can reassemble a tiny bit of what we've got without potentially
 * leaking sensitive information.
 *
 * @param {string} password - The password to hash.
 */
function getPasswordHash(password) {
  return sha1(sha1(password).slice(0, 5) + "-" + getHost());
}


/**
 * This function runs whenever a password input's value changes. It protects
 * checks the password against the haveibeenpwned API and alerts the user if the
 * password they've entered has been breached.
 *
 * @param {object} evt - The DOM event object.
 */
function protectPasswordInput(evt) {
  var inputValue = evt.srcElement.value;
  var hash = sha1(inputValue).toUpperCase();
  var hashPrefix = hash.slice(0, 5);
  var shortHash = hash.slice(5);
  var xmlHttp = new XMLHttpRequest();

  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
      var resp = xmlHttp.responseText.split("\n");

      for (var i = 0; i < resp.length; i++) {
        var data = resp[i].split(":");

        if (data[0].indexOf(shortHash) === 0) {
          var message = [
            '<p>The password you just entered has been found in <b>' + numberFormatter(parseInt(data[1])) + '</b> data breaches. <b>This password is not safe to use</b>.</p>',
            '<p>This means attackers can easily find this password online and will often try to access accounts with it.</p>',
            '<p>If you are currently using this password, please change it immediately to protect yourself. For more information, visit <a href="https://haveibeenpwned.com/" title="haveibeenpwned">Have I Been Pwned?</a>',
            '<p>This notice will not show again for the duration of this session to give you time to update this password.</p>'
          ].join('');

          vex.dialog.alert({
            message: "Unsafe password detected!",
            input: message,
            callback: function() {
              // Cache this password once the user clicks the "I Understand" button
              // so we don't continuously annoy the user with the same warnings.
              //
              // NOTE: We're using sessionStorage here (not localStorage) as we
              // only want to not annoy the user for the duration of this
              // session. Once they've come back to the site at a later time, we
              // should bug them if they try to use the same password >:D
              sessionStorage.setItem(getPasswordHash(inputValue), "true");
            }
          });
        }
      }
    }
  };

  // If this hash is cached, we shouldn't do anything.
  if (isIgnored(getPasswordHash(inputValue))) {
    return;
  }

  // We're using the API with k-Anonymity searches to protect privacy.
  // You can read more about this here: https://haveibeenpwned.com/API/v2#SearchingPwnedPasswordsByRange
  xmlHttp.open("GET", PASS_PROTECT_PASSWORD_CHECK_URI + hashPrefix, true);
  xmlHttp.send(null);
}


// Bootstrap our passProtect functionality after the page has fully loaded.
if (window.attachEvent) {
  window.attachEvent("onload", protectInputs);
} else {
  if (window.onload) {
    var currentOnLoad = window.onload;
    var newOnLoad = function(evt) {
      currentOnLoad(evt);
      protectInputs(evt);
    };

    window.onload = newOnLoad;
  } else {
    window.onload = protectInputs;
  }
}
