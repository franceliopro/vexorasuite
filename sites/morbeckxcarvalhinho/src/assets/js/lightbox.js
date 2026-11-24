(function () {
	'use strict';

	var images = document.querySelectorAll('.entry img:not(.banner-img)');
	if (!images.length) return;

	var overlay = document.createElement('div');
	overlay.id = 'lightbox';
	overlay.className = 'lightbox';
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', 'Imagem ampliada');
	overlay.hidden = true;
	overlay.innerHTML = '<button type="button" class="lightbox-close" aria-label="Fechar imagem">&times;</button>' +
		'<figure class="lightbox-figure"><img class="lightbox-image" alt=""><figcaption class="lightbox-caption"></figcaption></figure>';
	document.body.appendChild(overlay);

	var image = overlay.querySelector('.lightbox-image');
	var caption = overlay.querySelector('.lightbox-caption');
	var closeButton = overlay.querySelector('.lightbox-close');
	var lastFocused = null;

	function isImageUrl(url) {
		return /\.(?:jpe?g|png|gif|webp)(?:\?|$)/i.test(url || '');
	}

	function fullSizeUrl(img, link) {
		if (link && isImageUrl(link.getAttribute('href'))) return link.getAttribute('href');
		var srcset = img.getAttribute('srcset');
		if (!srcset) return img.getAttribute('src');
		var best = { width: 0, url: img.getAttribute('src') };
		srcset.split(',').forEach(function (entry) {
			var parts = entry.trim().split(/\s+/);
			var width = parseInt(parts[1] || '', 10);
			if (parts[0] && !isNaN(width) && width > best.width) {
				best = { width: width, url: parts[0] };
			}
		});
		return best.url;
	}

	function open(img, link) {
		lastFocused = document.activeElement;
		image.src = fullSizeUrl(img, link);
		image.alt = img.getAttribute('alt') || '';
		caption.textContent = img.getAttribute('alt') || '';
		caption.hidden = !caption.textContent;
		overlay.hidden = false;
		document.body.classList.add('lightbox-open');
		closeButton.focus();
	}

	function close() {
		overlay.hidden = true;
		document.body.classList.remove('lightbox-open');
		image.removeAttribute('src');
		if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
	}

	Array.prototype.forEach.call(images, function (img) {
		var link = img.closest('a');
		if (link && !isImageUrl(link.getAttribute('href'))) return;

		img.classList.add('zoomable');
		var target = link || img;
		if (!link) {
			img.setAttribute('tabindex', '0');
			img.setAttribute('role', 'button');
		}
		img.setAttribute('aria-label', 'Ampliar imagem');
		target.addEventListener('click', function (event) {
			event.preventDefault();
			open(img, link);
		});
	});

	closeButton.addEventListener('click', close);
	overlay.addEventListener('click', function (event) {
		if (event.target === overlay || event.target === overlay.querySelector('.lightbox-figure')) close();
	});
	document.addEventListener('keydown', function (event) {
		if (event.key === 'Escape' && !overlay.hidden) close();
	});
})();
