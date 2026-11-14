"use client";

import { type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function useSectionReveal(sectionRef: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (!sectionRef.current) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const targets = sectionRef.current?.querySelectorAll("[data-reveal]");
        if (!targets || targets.length === 0) return;

        gsap.fromTo(
          targets,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.08,
            ease: "power3.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        const targets = sectionRef.current?.querySelectorAll("[data-reveal]");
        if (!targets || targets.length === 0) return;
        gsap.set(targets, { clearProps: "transform", opacity: 1 });
      });

      return () => mm.revert();
    },
    { scope: sectionRef }
  );
}
