import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GuideBlock, GuideItem } from "./guide.data";

export function highlightSearchTerm(
  text: string,
  searchTerm: string
): React.ReactNode {
  const trimmed = searchTerm.trim();
  if (!trimmed) return text;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <mark key={index} className="bg-primary/15 text-foreground">
          {part}
        </mark>
      );
    }
    return part;
  });
}

interface GuideBlocksProps {
  blocks: GuideBlock[];
  related?: GuideItem["related"];
  searchTerm?: string;
}

export function GuideBlocks({
  blocks,
  related,
  searchTerm = "",
}: GuideBlocksProps) {
  return (
    <div className="space-y-4">
      {blocks.map((block, bIdx) => (
        <div key={bIdx} className="space-y-2">
          {block.heading ? (
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-4 first:mt-0 mb-2">
              {highlightSearchTerm(block.heading, searchTerm)}
            </h3>
          ) : null}

          {block.ordered ? (
            <ol className="space-y-2 list-none pl-0">
              {block.lines.map((line, lIdx) => (
                <li
                  key={lIdx}
                  className="flex items-start gap-2.5 text-sm text-foreground-secondary leading-relaxed"
                >
                  <span
                    className="font-mono text-xs font-bold text-primary shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    {String(lIdx + 1).padStart(2, "0")}.
                  </span>
                  <span>{highlightSearchTerm(line, searchTerm)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <ul className="space-y-2 list-none pl-0">
              {block.lines.map((line, lIdx) => (
                <li
                  key={lIdx}
                  className="flex items-start gap-2.5 text-sm text-foreground-secondary leading-relaxed"
                >
                  <span
                    className="size-1.5 bg-primary shrink-0 mt-2 inline-block"
                    aria-hidden="true"
                  />
                  <span>{highlightSearchTerm(line, searchTerm)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {related ? (
        <div className="mt-5 pt-4 border-t border-border flex items-center">
          <Link
            href={related.href}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary hover:underline group/link"
          >
            <span>{related.label}</span>
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
