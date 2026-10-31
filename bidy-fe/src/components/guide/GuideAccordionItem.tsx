"use client";

import React from "react";
import { Plus } from "lucide-react";
import { GuideItem } from "./guide.data";
import { GuideBlocks, highlightSearchTerm } from "./GuideBlocks";

interface GuideAccordionItemProps {
  item: GuideItem;
  isExpanded: boolean;
  onToggle: () => void;
  searchTerm?: string;
  isLast?: boolean;
}

export function GuideAccordionItem({
  item,
  isExpanded,
  onToggle,
  searchTerm = "",
  isLast = false,
}: GuideAccordionItemProps) {
  const buttonId = `guide-btn-${item.id}`;
  const panelId = `guide-panel-${item.id}`;

  return (
    <li className={`border-t border-border ${isLast ? "border-b" : ""}`}>
      <button
        id={buttonId}
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="w-full py-5 px-2 flex justify-between items-center text-left group hover:bg-accent-subtle transition-colors cursor-pointer"
      >
        <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors pr-4">
          {highlightSearchTerm(item.title, searchTerm)}
        </span>
        <Plus
          className={`w-5 h-5 text-muted-foreground group-hover:text-primary transition-transform duration-200 shrink-0 ${
            isExpanded ? "rotate-45" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isExpanded ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="pb-6 px-2"
        >
          <GuideBlocks
            blocks={item.blocks}
            related={item.related}
            searchTerm={searchTerm}
          />
        </div>
      ) : null}
    </li>
  );
}
