"use client";

import { useEffect, useRef } from "react";

type Shape = {
  rotation: number;
  scale: number;
  opacity: number;
  fill: string;
  stroke: string;
  linewidth: number;
  translation: { set: (x: number, y: number) => void };
  add: (shape: Shape) => void;
  noFill: () => void;
  noStroke: () => void;
};
type TwoScene = {
  appendTo: (element: HTMLElement) => TwoScene;
  renderer: { domElement: SVGElement };
  makeGroup: (...shapes: Shape[]) => Shape;
  makeCircle: (x: number, y: number, radius: number) => Shape;
  makeEllipse: (x: number, y: number, width: number, height: number) => Shape;
  makeStar: (x: number, y: number, inner: number, outer: number, sides: number) => Shape;
  makePolygon: (x: number, y: number, radius: number, sides: number) => Shape;
  update: () => void;
  pause: () => void;
  release: () => void;
  clear: () => void;
};
type TwoRuntime = {
  new (options: { type: string; width: number; height: number }): TwoScene;
  Types: { svg: string };
  Instances: TwoScene[];
};
type TwoWindow = Window & { Two?: TwoRuntime };
let runtimePromise: Promise<TwoRuntime | undefined> | undefined;

function loadTwo() {
  if ((window as TwoWindow).Two) return Promise.resolve((window as TwoWindow).Two);
  runtimePromise ??= new Promise<TwoRuntime | undefined>((resolve) => {
    const script = document.createElement("script");
    script.src = "/template/pingfangvideo/js/two.min.js?v=0.8.24";
    script.async = true;
    script.dataset.dunhuangRuntime = "true";
    script.addEventListener("load", () => resolve((window as TwoWindow).Two), { once: true });
    script.addEventListener(
      "error",
      () => {
        script.remove();
        runtimePromise = undefined;
        resolve(undefined);
      },
      { once: true }
    );
    document.body.appendChild(script);
  });
  return runtimePromise;
}

function createScene(Two: TwoRuntime, element: HTMLElement) {
  const two = new Two({ type: Two.Types.svg, width: 240, height: 240 }).appendTo(element);
  two.renderer.domElement.setAttribute("viewBox", "0 0 240 240");
  two.renderer.domElement.setAttribute("focusable", "false");
  const outer = two.makeGroup();
  const petals = two.makeGroup();
  for (const radius of [108, 100]) {
    const ring = two.makeCircle(0, 0, radius);
    ring.noFill();
    ring.stroke = "#c89b4a";
    ring.linewidth = radius === 108 ? 1.4 : 0.6;
    outer.add(ring);
  }
  for (let index = 0; index < 16; index++) {
    const angle = (index * Math.PI) / 8;
    const bead = two.makeCircle(Math.sin(angle) * 104, Math.cos(angle) * 104, 2);
    bead.fill = "#e8d9b7";
    bead.noStroke();
    outer.add(bead);
  }
  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4;
    const petal = two.makeEllipse(Math.sin(angle) * 57, -Math.cos(angle) * 57, 17, 36);
    petal.rotation = angle;
    petal.fill = index % 2 === 0 ? "#2f6174" : "#4a644d";
    petal.stroke = "#c89b4a";
    petal.linewidth = 1.2;
    petals.add(petal);
  }
  const star = two.makeStar(0, 0, 27, 45, 8);
  star.fill = "#a33f2c";
  star.stroke = "#e8d9b7";
  star.linewidth = 1;
  const center = two.makeCircle(0, 0, 16);
  center.fill = "#17120d";
  center.stroke = "#c89b4a";
  center.linewidth = 2;
  const jewel = two.makePolygon(0, 0, 8, 4);
  jewel.fill = "#c89b4a";
  jewel.noStroke();
  const ornament = two.makeGroup(outer, petals, star, center, jewel);
  ornament.translation.set(120, 120);
  return { Two, two, outer, petals, ornament };
}

export function DunhuangCaisson() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scene: ReturnType<typeof createScene> | undefined;
    let frame = 0;
    let revision = 0;
    const stop = () => {
      revision++;
      cancelAnimationFrame(frame);
      if (scene) {
        scene.two.pause();
        scene.two.release();
        scene.two.clear();
        const index = scene.Two.Instances.indexOf(scene.two);
        if (index >= 0) scene.Two.Instances.splice(index, 1);
        scene.two.renderer.domElement.remove();
        scene = undefined;
      }
      element.hidden = true;
    };
    const sync = () => {
      stop();
      if (document.documentElement.dataset.theme !== "dunhuang-caisson" || motion.matches || document.visibilityState === "hidden") return;
      const current = revision;
      void loadTwo().then((Two) => {
        if (!Two || current !== revision) return;
        scene = createScene(Two, element);
        element.hidden = false;
        let started: number | undefined;
        const draw = (time: number) => {
          started ??= time;
          const progress = Math.min((time - started) / 4200, 1);
          const eased = 1 - (1 - progress) ** 3;
          scene!.outer.rotation = (1 - eased) * -0.24;
          scene!.petals.rotation = (1 - eased) * 0.32;
          scene!.ornament.scale = 0.92 + eased * 0.08;
          scene!.ornament.opacity = 0.3 + eased * 0.7;
          scene!.two.update();
          frame = progress < 1 ? requestAnimationFrame(draw) : 0;
        };
        frame = requestAnimationFrame(draw);
      });
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      stop();
    };
  }, []);
  return <div className="dunhuang-caisson-motion" ref={host} aria-hidden="true" hidden />;
}
