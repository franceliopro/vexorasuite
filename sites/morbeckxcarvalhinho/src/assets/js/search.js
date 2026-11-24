/* Busca estática: carrega o índice gerado no build e filtra no navegador. */
(function () {
  var form = document.getElementById("site-search-form");
  var input = document.getElementById("site-search-input");
  var results = document.getElementById("site-search-results");
  if (!form || !input || !results) return;

  var index = [];
  var loaded = false;

  function norm(value) {
    return (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function snippet(text, query, size) {
    var pos = norm(text).indexOf(query);
    if (pos < 0) return text.slice(0, size);
    var start = Math.max(0, pos - 50);
    var end = Math.min(text.length, pos + size - 50);
    return (start > 0 ? "… " : "") + text.slice(start, end).trim() + (end < text.length ? " …" : "");
  }

  function render() {
    var query = norm(input.value.trim());
    if (query.length < 2 || !loaded) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }

    var matches = index.filter(function (item) {
      return norm(item.title + " " + item.text).indexOf(query) !== -1;
    }).slice(0, 10);

    if (!matches.length) {
      results.innerHTML = "<p class='search-empty'>Nenhum resultado encontrado.</p>";
      results.hidden = false;
      return;
    }

    results.innerHTML = "<ul class='search-list'>" + matches.map(function (item) {
      return "<li><a href='" + escapeHtml(item.url) + "'>" + escapeHtml(item.title) + "</a>" +
        "<p>" + escapeHtml(snippet(item.text, query, 180)) + "</p></li>";
    }).join("") + "</ul>";
    results.hidden = false;
  }

  fetch("/assets/js/search-index.json")
    .then(function (response) { return response.json(); })
    .then(function (data) {
      index = data || [];
      loaded = true;
      render();
    })
    .catch(function () {
      results.innerHTML = "<p class='search-empty'>Busca indisponível.</p>";
      results.hidden = false;
    });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    render();
  });
  input.addEventListener("input", render);
})();
