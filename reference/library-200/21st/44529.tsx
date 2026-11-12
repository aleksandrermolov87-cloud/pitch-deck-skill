"use client";

/*
MIT License

Copyright (c) 2026 EZPZ

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/**
 * Customize words, palette and fontFamily through props.
 * Place inside a width-constrained container; the SVG scales at 4:5.
 * Keep each line short. Use decorative when nearby text repeats the message.
 */

import { useId, type CSSProperties } from "react";

export interface EZPZTypeFoldProps {
  words?: readonly [string, string, string];
  background?: string;
  ink?: string;
  paper?: string;
  fontFamily?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  decorative?: boolean;
}

/** A single typographic composition folded across three clipped planes. */
export default function EZPZTypeFold({
  words = ["BIG IDEAS.", "MADE", "EZPZ."],
  background = "var(--color-background, #eae4d9)",
  ink = "var(--color-primary, #1736c7)",
  paper = "var(--color-card, #fcf7ec)",
  fontFamily = '"Helvetica Neue", Arial, sans-serif',
  className, style, label, decorative = false,
}: EZPZTypeFoldProps) {
  const id = useId().replace(/:/g, "");
  const titleId = `${id}-title`;
  const letteringId = `${id}-lettering`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1800" width="1440" height="1800"
      className={className} style={{ display: "block", width: "100%", height: "auto", ...style }}
      role={decorative ? undefined : "img"} aria-hidden={decorative || undefined}
      aria-labelledby={decorative ? undefined : titleId} focusable="false">
      {decorative ? null : <title id={titleId}>{label ?? words.join(" ")}</title>}
      <rect width="1440" height="1800" fill={background}/>
      <defs>
        <g id={letteringId} fontFamily={fontFamily} fontWeight="700" fill={ink}>
          {words.map((word, i) => <text key={i} x="18" y={238 + i * 226} fontSize="270"
            textLength="1014" lengthAdjust="spacingAndGlyphs">{word}</text>)}
        </g>
        {[0, 1, 2].map(i => <clipPath key={i} id={`${id}-clip-${i}`}><rect width="350" height="790"/></clipPath>)}
      </defs>
      <g transform="translate(0 30)" aria-hidden="true">
        {[0, 1, 2].map(i => <g key={i}
          transform={`matrix(.8660254 ${i === 1 ? -.5 : .5} 0 1 ${265 + .8660254 * 350 * i} ${387 + (i === 1 ? 175 : 0)})`}>
          <rect width="350" height="790" fill={paper}/>
          <rect width="350" height="790" fill="black" opacity={i === 0 ? .12 : i === 2 ? .08 : 0}/>
          <g clipPath={`url(#${id}-clip-${i})`}>
            <use href={`#${letteringId}`} transform={`translate(${-350 * i} 0)`}/>
          </g>
        </g>)}
      </g>
    </svg>
  );
}

