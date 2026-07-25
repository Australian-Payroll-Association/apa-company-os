import React from "react";

// Minimal markdown renderer for assistant replies, shared by the admin and team
// chat widgets so both format identically. Supports **bold**, `inline code`,
// "- " bullet lists, line breaks, and clickable links — both [label](url) markdown
// links and bare URLs (https://… and internal /team/… or /admin/… paths). Links
// are how the assistants point people at a profile or record, so they must render
// as real anchors, not dead text.

// Split tokens, longest/most-specific first so a markdown link is captured whole
// before its inner path can match as a bare URL.
const TOKEN =
  /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+|\/(?:team|admin)\/[^\s)]+)/g;

const MD_LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function Anchor({ href, children }: { href: string; children: React.ReactNode }) {
  // External links open in a new tab; internal portal links navigate in place.
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return <a href={href}>{children}</a>;
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    const md = MD_LINK.exec(part);
    if (md) {
      return (
        <Anchor key={key} href={md[2]}>
          {md[1]}
        </Anchor>
      );
    }
    if (/^https?:\/\//.test(part) || /^\/(?:team|admin)\//.test(part)) {
      // Keep trailing sentence punctuation out of the href.
      const [, url, trail] = /^(.*?)([.,;:!?]*)$/.exec(part) as RegExpExecArray;
      return (
        <React.Fragment key={key}>
          <Anchor href={url}>{url}</Anchor>
          {trail}
        </React.Fragment>
      );
    }
    return part;
  });
}

export function BotText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = (key: string) => {
    if (list.length) {
      out.push(<ul key={key}>{list}</ul>);
      list = [];
    }
  };
  lines.forEach((line, i) => {
    if (/^\s*[-*] /.test(line)) {
      list.push(<li key={`li-${i}`}>{renderInline(line.replace(/^\s*[-*] /, ""), `l${i}`)}</li>);
    } else {
      flush(`ul-${i}`);
      if (line.trim()) out.push(<p key={`p-${i}`}>{renderInline(line, `t${i}`)}</p>);
    }
  });
  flush("ul-end");
  return <>{out}</>;
}
