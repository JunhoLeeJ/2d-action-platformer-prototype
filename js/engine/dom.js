"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectOverlap(cx, cy, r, rect) {
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - closestX, dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}
