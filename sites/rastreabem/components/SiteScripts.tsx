"use client";

import { useEffect } from "react";

/**
 * Comportamentos do site original (home.js e services.js) preservados sem
 * alterar o HTML dos arquivos MDX: carrossel, galeria de veículos e
 * reprodução das demonstrações em vídeo.
 */
export function SiteScripts() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    const carousel = document.querySelector<HTMLElement>(".carousel");
    if (carousel) {
      const slides = Array.from(carousel.querySelectorAll<HTMLElement>(".slide"));
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let current = 0;
      let timer: ReturnType<typeof setInterval> | undefined;

      const show = (index: number) => {
        if (!slides.length) return;
        slides[current].hidden = true;
        current = (index + slides.length) % slides.length;
        slides[current].hidden = false;
      };
      const pause = () => {
        if (timer) clearInterval(timer);
        timer = undefined;
      };
      const resume = () => {
        pause();
        if (document.hidden || motion.matches || carousel.matches(":hover") || carousel.contains(document.activeElement)) return;
        timer = setInterval(() => show(current + 1), 6000);
      };

      const previous = carousel.querySelector<HTMLButtonElement>(".previous");
      const next = carousel.querySelector<HTMLButtonElement>(".next");
      previous?.addEventListener("click", () => show(current - 1));
      next?.addEventListener("click", () => show(current + 1));
      carousel.addEventListener("pointerenter", pause);
      carousel.addEventListener("pointerleave", resume);
      carousel.addEventListener("focusin", pause);
      carousel.addEventListener("focusout", () => requestAnimationFrame(resume));
      document.addEventListener("visibilitychange", resume);
      motion.addEventListener("change", resume);
      resume();

      cleanups.push(() => {
        pause();
        previous?.removeEventListener("click", () => show(current - 1));
        next?.removeEventListener("click", () => show(current + 1));
        carousel.removeEventListener("pointerenter", pause);
        carousel.removeEventListener("pointerleave", resume);
        carousel.removeEventListener("focusin", pause);
        document.removeEventListener("visibilitychange", resume);
        motion.removeEventListener("change", resume);
      });
    }

    const gallery = document.querySelector<HTMLElement>(".vehicle-gallery");
    if (gallery) {
      const images = Array.from(gallery.querySelectorAll<HTMLImageElement>(".vehicle-images > img"));
      const dots = Array.from(gallery.querySelectorAll<HTMLButtonElement>(".gallery-dots button"));
      let current = 0;
      const show = (index: number) => {
        if (!images.length) return;
        current = (index + images.length) % images.length;
        images.forEach((image, position) => {
          image.hidden = position !== current;
          dots[position]?.setAttribute("aria-pressed", String(position === current));
        });
      };
      const previous = gallery.querySelector<HTMLButtonElement>(".previous");
      const next = gallery.querySelector<HTMLButtonElement>(".next");
      previous?.addEventListener("click", () => show(current - 1));
      next?.addEventListener("click", () => show(current + 1));
      dots.forEach((dot, index) => dot.addEventListener("click", () => show(index)));
      cleanups.push(() => {
        previous?.removeEventListener("click", () => show(current - 1));
        next?.removeEventListener("click", () => show(current + 1));
        dots.forEach((dot, index) => dot.removeEventListener("click", () => show(index)));
      });
    }

    const toggle = document.querySelector<HTMLButtonElement>(".demo-toggle");
    if (toggle) {
      const videos = Array.from(document.querySelectorAll<HTMLVideoElement>(".device-stage video"));
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const setPlaying = (playing: boolean) => {
        videos.forEach((video) => {
          video.autoplay = playing;
          if (playing) void video.play().catch(() => undefined);
          else video.pause();
        });
        toggle.textContent = playing ? "⏸" : "▶";
        toggle.setAttribute("aria-label", playing ? "Pausar demonstrações" : "Reproduzir demonstrações");
        toggle.setAttribute("aria-pressed", String(playing));
      };
      const onClick = () => setPlaying(videos.every((video) => video.paused));
      const onMotionChange = () => setPlaying(!motion.matches);
      toggle.hidden = false;
      toggle.addEventListener("click", onClick);
      motion.addEventListener("change", onMotionChange);
      setPlaying(!motion.matches);
      cleanups.push(() => {
        toggle.removeEventListener("click", onClick);
        motion.removeEventListener("change", onMotionChange);
        videos.forEach((video) => video.pause());
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
