(function () {
	'use strict';

	var year = document.getElementById('current-year');
	if (year) {
		year.textContent = String(new Date().getFullYear());
	}

	var menuButton = document.querySelector('.mobile-menu-icon .mobile-menu');
	var mobileMenu = document.getElementById('mobile-dropdown');

	function closeMenu() {
		if (!mobileMenu) return;
		mobileMenu.classList.remove('is-open');
		mobileMenu.style.display = 'none';
		if (menuButton) {
			menuButton.classList.remove('opened');
			menuButton.setAttribute('aria-expanded', 'false');
		}
	}

	if (menuButton && mobileMenu) {
		menuButton.addEventListener('click', function (event) {
			event.preventDefault();
			var open = !mobileMenu.classList.contains('is-open');
			mobileMenu.classList.toggle('is-open', open);
			mobileMenu.style.display = open ? 'block' : 'none';
			menuButton.classList.toggle('opened', open);
			menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
		});

		mobileMenu.addEventListener('click', function (event) {
			if (event.target.closest('a')) closeMenu();
		});

		document.addEventListener('keydown', function (event) {
			if (event.key === 'Escape') closeMenu();
		});

		window.addEventListener('resize', function () {
			if (window.innerWidth > 959) closeMenu();
		});
	}

	var scrollTop = document.getElementById('scroll-top');
	if (scrollTop) {
		function updateScrollTop() {
			scrollTop.classList.toggle('is-visible', window.pageYOffset > 300);
		}
		window.addEventListener('scroll', updateScrollTop, { passive: true });
		updateScrollTop();
		scrollTop.addEventListener('click', function (event) {
			event.preventDefault();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	}
})();
