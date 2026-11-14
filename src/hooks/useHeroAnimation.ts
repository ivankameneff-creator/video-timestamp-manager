"use client";

import { type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function useHeroAnimation(containerRef: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (!containerRef.current) return;

      const mm = gsap.matchMedia();

      // Animations complètes uniquement si l'utilisateur n'a pas activé reduced-motion
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "power4.out" },
        });

        // 1. De-zoom lent cinématique du plan vidéo d'arrière-plan (GPU: transform + opacity)
        tl.fromTo(
          "[data-hero-media]",
          { scale: 1.12, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1.8, ease: "power3.out" },
          0
        )
          // 2. Apparition du HUD Timecode supérieur
          .fromTo(
            "[data-hero-hud]",
            { y: -16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 },
            0.25
          )
          // 3. Révélation par masque des lignes du titre principal (yPercent uniquement)
          .fromTo(
            "[data-hero-line]",
            { yPercent: 115, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 1.15, stagger: 0.12 },
            0.35
          )
          // 4. Sous-titre éditorial et barre d'accès rapide aux modes
          .fromTo(
            "[data-hero-fade]",
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, stagger: 0.1 },
            0.75
          );

        // 5. Parallaxe et zoom lent liés au scroll vers le plan suivant (60 FPS GPU)
        gsap.to("[data-hero-media]", {
          yPercent: 18,
          scale: 1.06,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        gsap.to("[data-hero-content]", {
          yPercent: -12,
          opacity: 0.2,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      // Fallback accessible immédiat sous prefers-reduced-motion
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          "[data-hero-media], [data-hero-hud], [data-hero-line], [data-hero-fade]",
          {
            clearProps: "transform",
            opacity: 1,
          }
        );
      });

      return () => mm.revert();
    },
    { scope: containerRef }
  );
}
