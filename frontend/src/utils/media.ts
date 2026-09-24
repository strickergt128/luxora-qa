export type EmbedInfo = { kind: "file" | "youtube" | "vimeo"; src: string };

export function classifyVideoUrl(url?: string): EmbedInfo {
  if (!url) return { kind: "file", src: "" };
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const host = u.hostname.toLowerCase();

    // YouTube
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      let id = "";
      if (host.includes("youtu.be")) {
        id = u.pathname.replace("/", "");
      } else {
        id = u.searchParams.get("v") || "";
        if (!id && u.pathname.includes("/embed/")) {
          id = u.pathname.split("/embed/")[1];
        }
      }
      if (id) return { kind: "youtube", src: `https://www.youtube.com/embed/${id}` };
    }

    // Vimeo
    if (host.includes("vimeo.com")) {
      let id = "";
      if (host.includes("player.vimeo.com")) {
        const m = u.pathname.match(/\/video\/(\d+)/);
        if (m) id = m[1];
      } else {
        const m = u.pathname.match(/\/(\d+)/);
        if (m) id = m[1];
      }
      if (id) return { kind: "vimeo", src: `https://player.vimeo.com/video/${id}` };
    }
  } catch {
    // fall through
  }
  // default: treat as a direct file or any other host
  return { kind: "file", src: url };
}