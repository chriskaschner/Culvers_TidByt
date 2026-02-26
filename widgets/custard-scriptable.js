// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: ice-cream;

// Custard Calendar — Culver's Flavor of the Day widget
// https://github.com/chriskaschner/custard-scriptable

const WORKER_BASE = "https://custard.chriskaschner.com";
const DEFAULT_SLUG = "mt-horeb";
const CULVERS_BLUE = new Color("#005696");
const CULVERS_BLUE_DARK = new Color("#3A8ADE");

// ── Helpers ──────────────────────────────────────────────

function accentColor() {
  return Color.dynamic(CULVERS_BLUE, CULVERS_BLUE_DARK);
}

function bgColor() {
  return Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E"));
}

function primaryText() {
  return Color.dynamic(new Color("#000000"), new Color("#FFFFFF"));
}

function secondaryText() {
  return Color.dynamic(new Color("#6E6E73"), new Color("#98989F"));
}

function rowBgColor() {
  return Color.dynamic(new Color("#F2F2F7"), new Color("#2C2C2E"));
}

function formatDateLabel(dateStr) {
  const parts = dateStr.split("-");
  const d = new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2])
  );
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

function isToday(dateStr) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dateStr === today;
}

function nextRefresh() {
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(6, 0, 0, 0);
  return next;
}

function sanitizeSlug(raw) {
  const slug = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return slug.length > 0 ? slug.slice(0, 60) : DEFAULT_SLUG;
}

// ── Data fetching + cache ────────────────────────────────

async function fetchFlavors(slug) {
  const url = `${WORKER_BASE}/api/v1/flavors?slug=${encodeURIComponent(slug)}`;
  const req = new Request(url);
  req.timeoutInterval = 10;

  try {
    const resp = await req.loadJSON();
    if (resp && resp.flavors && resp.flavors.length > 0) {
      writeCache(slug, resp);
      return resp;
    }
  } catch (e) {
    console.log(`Fetch failed: ${e}`);
  }

  return readCache(slug);
}

function writeCache(slug, data) {
  const fm = FileManager.local();
  const dir = fm.joinPath(fm.documentsDirectory(), "custard-calendar");
  if (!fm.fileExists(dir)) {
    fm.createDirectory(dir);
  }
  const path = fm.joinPath(dir, `${slug}.json`);
  fm.writeString(path, JSON.stringify(data));
}

function readCache(slug) {
  const fm = FileManager.local();
  const path = fm.joinPath(
    fm.documentsDirectory(),
    `custard-calendar/${slug}.json`
  );
  if (fm.fileExists(path)) {
    try {
      return JSON.parse(fm.readString(path));
    } catch (e) {
      console.log(`Cache read failed: ${e}`);
    }
  }
  return null;
}

// ── DrawContext: ice cream cone icon ─────────────────────

function drawConeImage(size) {
  const w = size;
  const h = size;
  const dc = new DrawContext();
  dc.size = new Size(w, h);
  dc.opaque = false;
  dc.respectScreenScale = true;

  // Cone (triangle)
  const conePath = new Path();
  const coneTop = h * 0.45;
  const coneBottom = h * 0.95;
  const coneHalfWidth = w * 0.22;
  const centerX = w / 2;
  conePath.move(new Point(centerX - coneHalfWidth, coneTop));
  conePath.addLine(new Point(centerX + coneHalfWidth, coneTop));
  conePath.addLine(new Point(centerX, coneBottom));
  conePath.closeSubpath();
  dc.addPath(conePath);
  dc.setFillColor(new Color("#D4A843"));
  dc.fillPath();

  // Scoop
  const scoopRadius = w * 0.3;
  const scoopCenterY = coneTop - scoopRadius * 0.4;
  const scoopRect = new Rect(
    centerX - scoopRadius,
    scoopCenterY - scoopRadius,
    scoopRadius * 2,
    scoopRadius * 2
  );
  dc.setFillColor(new Color("#FFF5CC"));
  dc.fillEllipse(scoopRect);

  // Scoop outline
  dc.setStrokeColor(new Color("#D4A843", 0.4));
  dc.setLineWidth(1);
  dc.strokeEllipse(scoopRect);

  return dc.getImage();
}

// ── Small Widget ─────────────────────────────────────────

function buildSmall(data, slug) {
  const w = new ListWidget();
  w.backgroundColor = bgColor();
  w.setPadding(12, 14, 12, 14);
  w.url = `https://www.culvers.com/restaurants/${slug}`;

  // Header row with cone
  const headerStack = w.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();

  const coneImg = drawConeImage(16);
  const coneEl = headerStack.addImage(coneImg);
  coneEl.imageSize = new Size(16, 16);
  headerStack.addSpacer(4);

  const header = headerStack.addText("Flavor of the Day");
  header.font = Font.semiboldSystemFont(11);
  header.textColor = accentColor();

  w.addSpacer(6);

  if (!data || !data.flavors || data.flavors.length === 0) {
    const err = w.addText("No flavor data");
    err.font = Font.systemFont(13);
    err.textColor = secondaryText();
    return w;
  }

  // Find today's flavor, fall back to first
  let todayFlavor = data.flavors.find((f) => isToday(f.date));
  if (!todayFlavor) {
    todayFlavor = data.flavors[0];
  }

  const flavorText = w.addText(todayFlavor.title);
  flavorText.font = Font.boldSystemFont(17);
  flavorText.textColor = primaryText();
  flavorText.minimumScaleFactor = 0.6;
  flavorText.lineLimit = 2;

  w.addSpacer();

  const storeName = data.name || slug;
  const storeText = w.addText(storeName);
  storeText.font = Font.systemFont(10);
  storeText.textColor = secondaryText();
  storeText.lineLimit = 1;

  return w;
}

// ── Medium Widget ────────────────────────────────────────

function buildMedium(data, slug) {
  const w = new ListWidget();
  w.backgroundColor = bgColor();
  w.setPadding(12, 16, 12, 16);
  w.url = `https://www.culvers.com/restaurants/${slug}`;

  // Header row
  const headerStack = w.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();

  const coneImg = drawConeImage(18);
  const coneEl = headerStack.addImage(coneImg);
  coneEl.imageSize = new Size(18, 18);
  headerStack.addSpacer(5);

  const title = headerStack.addText("Custard Calendar");
  title.font = Font.boldSystemFont(14);
  title.textColor = accentColor();

  headerStack.addSpacer();

  const storeName = data ? data.name || slug : slug;
  const storeEl = headerStack.addText(storeName);
  storeEl.font = Font.systemFont(11);
  storeEl.textColor = secondaryText();
  storeEl.lineLimit = 1;

  w.addSpacer(8);

  if (!data || !data.flavors || data.flavors.length === 0) {
    const err = w.addText("No flavor data available");
    err.font = Font.systemFont(13);
    err.textColor = secondaryText();
    return w;
  }

  // Show up to 3 days starting from today
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  let startIdx = data.flavors.findIndex((f) => f.date >= todayStr);
  if (startIdx === -1) startIdx = 0;
  const upcoming = data.flavors.slice(startIdx, startIdx + 3);

  const dateColors = [
    accentColor(),
    Color.dynamic(new Color("#5856D6"), new Color("#7D7AFF")),
    Color.dynamic(new Color("#34C759"), new Color("#30D158")),
  ];

  for (let i = 0; i < upcoming.length; i++) {
    const flavor = upcoming[i];
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.setPadding(4, 8, 4, 8);
    row.cornerRadius = 6;
    if (isToday(flavor.date)) {
      row.backgroundColor = rowBgColor();
    }

    const dateLabel = row.addText(formatDateLabel(flavor.date));
    dateLabel.font = Font.semiboldSystemFont(12);
    dateLabel.textColor = dateColors[i % dateColors.length];
    dateLabel.lineLimit = 1;

    row.addSpacer(10);

    const flavorLabel = row.addText(flavor.title);
    flavorLabel.font = isToday(flavor.date)
      ? Font.boldSystemFont(13)
      : Font.systemFont(13);
    flavorLabel.textColor = primaryText();
    flavorLabel.lineLimit = 1;
    flavorLabel.minimumScaleFactor = 0.75;

    if (i < upcoming.length - 1) {
      w.addSpacer(2);
    }
  }

  w.addSpacer();
  return w;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const slug = sanitizeSlug(args.widgetParameter || DEFAULT_SLUG);
  const data = await fetchFlavors(slug);
  const family = config.widgetFamily;

  let widget;
  if (family === "medium") {
    widget = buildMedium(data, slug);
  } else {
    widget = buildSmall(data, slug);
  }

  widget.refreshAfterDate = nextRefresh();

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    // Preview both sizes when running in-app
    const small = buildSmall(data, slug);
    small.refreshAfterDate = nextRefresh();
    await small.presentSmall();

    const medium = buildMedium(data, slug);
    medium.refreshAfterDate = nextRefresh();
    await medium.presentMedium();
  }
  Script.complete();
}

await main();
