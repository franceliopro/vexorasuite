/* Config do tema + interacoes do site */
var oceanwpLocalize = {
  "isRTL": "",
  "menuSearchStyle": "drop_down",
  "mobileMenuSearchStyle": "disabled",
  "sidrDisplace": "1",
  "sidrSide": "left",
  "sidrDropdownTarget": "link",
  "verticalHeaderTarget": "link",
  "mobileDropdownTarget": "link",
  "semanticMobileHeader": "1",
  "semanticDesktopHeader": "1",
  "customScrollOffset": "0"
};

document.oncontextmenu = function (event) {
  if (event.target.tagName != 'INPUT' && event.target.tagName != 'TEXTAREA') {
    event.preventDefault();
  }
};
document.ondragstart = function () { return false; };

(function () {
  var el = document.getElementById('current-year');
  if (el) { el.textContent = new Date().getFullYear(); }
})();
